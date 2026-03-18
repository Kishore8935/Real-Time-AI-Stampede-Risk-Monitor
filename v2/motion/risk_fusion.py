# =============================================================================
# v2/motion/risk_fusion.py — RiskFusion
#
# WHAT IS RISK FUSION? (beginner explanation)
# ─────────────────────────────────────────────
# We have THREE signals now:
#   1. DENSITY  — how many people are in each cell
#   2. MOTION   — how fast and chaotically those people are moving
#   3. CROWD PRESSURE — density × directional chaos (Keith Still's formula)
#
# What is Crowd Pressure?
# ──────────────────────
# People die in stampedes from compressive asphyxia — their lungs are crushed
# by the crowd around them. This happens when:
#   - There are MANY people in a small area (high density), AND
#   - Those people are all pushing in DIFFERENT directions (high chaos)
#
# A crowd of 8 people/m² all walking calmly in ONE direction has high density
# but LOW pressure (think: an orderly queue). The same 8 people/m² where half
# are pushing left and half right creates ENORMOUS physical pressure.
#
# Formula (Keith Still, 2012):  P = ρ × σ_v
# Where:  ρ = local density (normalised 0–1)
#         σ_v = velocity standard deviation (our chaos_norm)
#
# Why is this better than just density?
#   - A packed concert mosh pit may have density=0.9 and chaos=0.8 → P=0.72 (truly dangerous)
#   - A packed orderly queue has density=0.9 and chaos=0.05 → P=0.045 (safe, suppress alarm)
#   This is EXACTLY the false-positive problem that broke the 70/30 weight debate.
#
# Risk Fusion now combines all three into ONE number (0–100):
#   risk_score = w_density×density + w_motion×motion + w_pressure×pressure
#   Default:    0.50          ×density + 0.25        ×motion  + 0.25        ×pressure
#
# HYSTERESIS — unchanged (see original comments).
# =============================================================================

import numpy as np

# Risk label constants
RISK_LOW      = 0
RISK_HIGH     = 1
RISK_CRITICAL = 2

RISK_NAMES = {RISK_LOW: "Low", RISK_HIGH: "High", RISK_CRITICAL: "Critical"}


class RiskFusion:
    """
    Combines per-cell density counts and motion signals into a risk score.

    Parameters
    ----------
    grid_rows, grid_cols   : grid dimensions
    thresh_critical        : raw density count considered "critical" (for normalisation)
    max_motion             : motion magnitude (pixels/frame) considered maximum
    density_weight         : how much density contributes to risk (default 0.6)
    motion_weight          : how much motion contributes to risk  (default 0.4)
    high_score_threshold   : risk score above which a cell is "High"
    critical_score_threshold: risk score above which a cell is "Critical"
    hysteresis_frames      : frames a cell must stay calm to downgrade its label
    """

    def __init__(self,
                 grid_rows: int,
                 grid_cols: int,
                 thresh_critical: int   = 8,
                 max_motion: float      = 3.0,
                 density_weight: float  = 0.50,
                 motion_weight: float   = 0.25,
                 pressure_weight: float = 0.25,
                 high_score_threshold: float      = 0.50,
                 critical_score_threshold: float  = 0.75,
                 density_gate: float    = 0.20,
                 hysteresis_frames: int = 8):
        # density_gate: cells with density_norm below this fraction are
        # suppressed to risk_score=0. Prevents 1-2 walking people from
        # triggering alerts just because of motion.
        self.density_gate = density_gate

        self.grid_rows  = grid_rows
        self.grid_cols  = grid_cols
        self.thresh_crit = thresh_critical
        self.max_motion  = max_motion
        self.w_density   = density_weight
        self.w_motion    = motion_weight
        self.w_pressure  = pressure_weight
        self.high_thr    = high_score_threshold
        self.crit_thr    = critical_score_threshold
        self.hysteresis  = hysteresis_frames

        # Internal state for hysteresis — countdown timer per cell
        # When a cell triggers Critical, its timer is set to hysteresis_frames.
        # It decrements by 1 each frame. Cell stays Critical until timer = 0.
        self._crit_timer = np.zeros((grid_rows, grid_cols), dtype=np.int32)
        self._high_timer = np.zeros((grid_rows, grid_cols), dtype=np.int32)

    def compute(self, raw_density: np.ndarray,
                motion_grid: np.ndarray,
                chaos_grid: np.ndarray):
        """
        Compute per-cell risk scores and labels.

        Parameters
        ----------
        raw_density  : float32 [rows, cols] — raw YOLO person count per cell
        motion_grid  : float32 [rows, cols] — average motion magnitude per cell
        chaos_grid   : float32 [rows, cols] — directional chaos per cell

        Returns
        -------
        risk_score_grid  : float32 [rows, cols] — risk 0.0–1.0 per cell
        risk_label_grid  : int32   [rows, cols] — RISK_LOW / HIGH / CRITICAL
        global_score     : float   — single 0–100 risk score for the whole scene
        pressure_grid    : float32 [rows, cols] — crowd pressure 0.0–1.0 per cell
        avg_pressure     : float   — mean pressure across all cells (0–100)
        """
        # ── Step 1: Normalise density ────────────────────────────────────────
        # Map raw count → 0.0 to 1.0
        # A cell with thresh_critical people = 1.0 (maximum density concern)
        density_norm = np.clip(raw_density / max(self.thresh_crit, 1), 0.0, 1.0)

        # ── Step 2: Normalise motion ─────────────────────────────────────────
        motion_norm = np.clip(motion_grid / self.max_motion, 0.0, 1.0)
        chaos_norm  = np.clip(chaos_grid  / 2.0,             0.0, 1.0)
        #chaos_norm = np.clip(chaos_grid / 1.2, 0.0, 1.0)

        # Combine speed and chaos into one motion component
        motion_component = 0.6 * motion_norm + 0.4 * chaos_norm

        # ── Step 3: Crowd Pressure (Keith Still's formula) ───────────────────
        # P = ρ × σ_v  (density × velocity standard deviation)
        # In our grid:  density_norm × chaos_norm
        # This is HIGH only when BOTH density AND directional chaos are high.
        # A calm queue packs people (high density) but has low chaos → low P.
        # A panicking mob has both → high P = genuine crush risk.
        pressure_grid = density_norm * chaos_norm  # element-wise product, range 0–1

        # ── Step 4: Fuse all three signals ───────────────────────────────────
        risk_score_grid = (self.w_density  * density_norm       +
                           self.w_motion   * motion_component   +
                           self.w_pressure * pressure_grid)

        # ── Density gate ─────────────────────────────────────────────────────
        # If a cell has fewer than density_gate × thresh_critical persons,
        # suppress its risk score to 0 entirely — motion alone in a sparse
        # cell doesn't constitute a stampede risk.
        sparse_mask = (density_norm < self.density_gate)
        risk_score_grid[sparse_mask] = 0.0
        pressure_grid[sparse_mask]   = 0.0   # pressure is meaningless without people

        # ── Step 5: Apply raw labels from current scores ─────────────────────
        raw_labels = np.zeros_like(risk_score_grid, dtype=np.int32)
        raw_labels[risk_score_grid >= self.high_thr] = RISK_HIGH
        raw_labels[risk_score_grid >= self.crit_thr] = RISK_CRITICAL

        # ── Step 6: Hysteresis ───────────────────────────────────────────────
        # Upgrade instantly, downgrade slowly
        risk_label_grid = np.zeros_like(raw_labels)

        for r in range(self.grid_rows):
            for c in range(self.grid_cols):
                lbl = raw_labels[r, c]

                if lbl == RISK_CRITICAL:
                    # Instant upgrade to Critical, reset timer
                    self._crit_timer[r, c] = self.hysteresis
                    self._high_timer[r, c] = self.hysteresis
                elif lbl == RISK_HIGH:
                    self._high_timer[r, c] = self.hysteresis
                    # Decrement Critical timer (slow downgrade from Critical)
                    self._crit_timer[r, c] = max(0, self._crit_timer[r, c] - 1)
                else:
                    # Low raw — countdown both timers
                    self._crit_timer[r, c] = max(0, self._crit_timer[r, c] - 1)
                    self._high_timer[r, c] = max(0, self._high_timer[r, c] - 1)

                # Assign label based on timers
                if self._crit_timer[r, c] > 0:
                    risk_label_grid[r, c] = RISK_CRITICAL
                elif self._high_timer[r, c] > 0:
                    risk_label_grid[r, c] = RISK_HIGH
                else:
                    risk_label_grid[r, c] = RISK_LOW

        # ── Step 7: Global score ─────────────────────────────────────────────
        # Use the average of the TOP 25% riskiest cells.
        # This prevents one extremely hot cell from dominating,
        # while still being sensitive to emerging hotspots.
        flat   = risk_score_grid.flatten()
        top_n  = max(1, len(flat) // 4)
        global_score = float(np.mean(np.sort(flat)[::-1][:top_n])) * 100
        global_score = round(min(100.0, global_score), 1)

        # Average crowd pressure (0–100 scale) across non-sparse cells
        avg_pressure = round(float(np.mean(pressure_grid)) * 100, 1)

        return risk_score_grid, risk_label_grid, global_score, pressure_grid, avg_pressure

    def get_scene_status(self, risk_label_grid: np.ndarray) -> str:
        """Scene-level alert string based on risk label grid."""
        crit = int(np.sum(risk_label_grid == RISK_CRITICAL))
        high = int(np.sum(risk_label_grid == RISK_HIGH))

        if crit >= 2:      return "⚠ CRITICAL RISK"
        elif crit == 1:    return "Critical Zone Detected"
        elif high >= 3:    return "High Density Warning"
        elif high >= 1:    return "Elevated Risk"
        else:              return "Normal"
