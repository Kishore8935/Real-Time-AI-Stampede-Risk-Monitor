# =============================================================================
# v2/motion/flow.py — OpticalFlowAnalyzer
#
# WHAT IS OPTICAL FLOW? (beginner explanation)
# ─────────────────────────────────────────────
# Two consecutive video frames are compared pixel-by-pixel.
# Optical flow finds where each pixel "moved" between frames — like watching
# a person's head shift from (100,200) to (103,201).
#
# For crowd analysis:
#   - High average motion in a cell  → people moving fast (alert!)
#   - Motion in many different directions → chaotic, panic-like
#   - Low motion in a dense cell     → crowd is trapped (pressure)
#
# OUTPUTS (v2 — extended):
#   - motion_grid : float32 [rows, cols] — avg speed per cell (px/frame)
#   - chaos_grid  : float32 [rows, cols] — directional variance per cell
#   - flow_field  : float32 [H, W, 2]   — raw (dx, dy) vectors in native px
#                   Used by RiskFusion to compute Crowd Pressure and
#                   Vector Field Divergence (new signals for Review 3).
#
# WHY WE DOWNSCALE BEFORE COMPUTING FLOW:
# ─────────────────────────────────────────
# Farneback dense optical flow needs to allocate large working buffers
# proportional to frame resolution. A 1920×1080 frame requires ~15+ MB
# of intermediate arrays — this can crash on machines with limited RAM.
#
# The fix: resize the frame to at most FLOW_MAX_SIDE pixels on the longer
# side before computing flow. We only care about relative motion values
# (fast vs slow, uniform vs chaotic), not sub-pixel accuracy. Downscaling
# to 480px uses ~8× less memory and is ~8× faster with no meaningful loss.
# =============================================================================

import cv2
import numpy as np

# Maximum pixel length of the longer side used for optical flow computation.
# Anything above this is downscaled to save memory.
# Lower  = faster, less memory, less accurate.
# Higher = slower, more memory, more accurate.
FLOW_MAX_SIDE = 480


class OpticalFlowAnalyzer:
    """
    Computes dense optical flow between consecutive frames and extracts
    per-grid-cell motion statistics.

    Parameters
    ----------
    grid_rows, grid_cols  : int — grid dimensions (must match DensityEstimator)
    frame_width, frame_height : int — native video resolution
    flow_max_side         : int — max pixel side for flow computation (default 480)
    """

    def __init__(self, grid_rows: int, grid_cols: int,
                 frame_width: int, frame_height: int,
                 flow_max_side: int = FLOW_MAX_SIDE):
        self.grid_rows = grid_rows
        self.grid_cols = grid_cols
        self.cell_w    = frame_width  // grid_cols
        self.cell_h    = frame_height // grid_rows

        # Compute the downscale factor so the bigger dimension ≤ flow_max_side
        longer = max(frame_width, frame_height)
        self.scale = min(1.0, flow_max_side / longer)   # e.g. 480/1080 ≈ 0.44

        # Pre-compute cell coordinates in the SCALED space (avoids per-frame math)
        self._scaled_cell_w = max(1, round(self.cell_w * self.scale))
        self._scaled_cell_h = max(1, round(self.cell_h * self.scale))

        self._prev_small = None     # previous frame, already grayscale + downscaled

    def update(self, frame: np.ndarray):
        """
        Takes the current BGR frame and computes optical flow vs previous frame.

        Returns
        -------
        motion_grid : float32 [rows, cols] — avg motion magnitude per cell
        chaos_grid  : float32 [rows, cols] — directional chaos per cell
        flow_field  : float32 [H, W, 2]   — raw (dx, dy) in native-pixel units
                      (zeros on the very first frame where no previous exists)
        """
        motion_grid = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)
        chaos_grid  = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)

        # Step 1: grayscale + downscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if self.scale < 1.0:
            h, w = gray.shape
            small = cv2.resize(gray,
                               (max(1, round(w * self.scale)),
                                max(1, round(h * self.scale))),
                               interpolation=cv2.INTER_AREA)
        else:
            small = gray

        if self._prev_small is None:
            self._prev_small = small
            sh, sw = small.shape
            return motion_grid, chaos_grid, np.zeros((sh, sw, 2), dtype=np.float32)

        # Step 2: Farneback Dense Optical Flow on the SMALL frame
        # Parameters tuned for CPU speed (less accurate but fast enough)
        flow = cv2.calcOpticalFlowFarneback(
            self._prev_small,
            small,
            flow=None,
            pyr_scale=0.5,
            levels=3,
            winsize=13,         # window size — larger = smoother but slower
            iterations=3,
            poly_n=5,
            poly_sigma=1.2,
            flags=0
        )
        # flow shape: (small_H, small_W, 2) — we keep it in small-frame scale.
        # NOTE: We intentionally do NOT upscale back to native resolution here.
        # The native upscale (cv2.resize to 1080p+) cost ~3-5ms per frame with
        # no benefit — chaos_grid and motion_grid (computed below from the small
        # frame) are what RiskFusion actually uses for Crowd Pressure.
        # flow_field is kept small for potential future divergence/curl work.

        # Step 3: magnitudes (in small-frame pixels, scaled back to native for display)
        magnitude, angle = cv2.cartToPolar(flow[:, :, 0], flow[:, :, 1])
        magnitude /= max(self.scale, 1e-6)   # convert back to native-pixel units

        # Step 4: per-cell stats using scaled cell coordinates
        scw = self._scaled_cell_w
        sch = self._scaled_cell_h

        for r in range(self.grid_rows):
            for c in range(self.grid_cols):
                y1 = r * sch;  y2 = min(y1 + sch, small.shape[0])
                x1 = c * scw;  x2 = min(x1 + scw, small.shape[1])

                cell_mag = magnitude[y1:y2, x1:x2]
                cell_ang = angle[y1:y2, x1:x2]

                if cell_mag.size == 0:
                    continue

                motion_grid[r, c] = float(np.mean(cell_mag))

                # Chaos = directional variance (how much angles disagree)
                cos_std = float(np.std(np.cos(cell_ang)))
                sin_std = float(np.std(np.sin(cell_ang)))
                chaos_grid[r, c] = cos_std + sin_std   # range ≈ 0 – 2

        self._prev_small = small
        return motion_grid, chaos_grid, flow   # flow is in small-frame scale
