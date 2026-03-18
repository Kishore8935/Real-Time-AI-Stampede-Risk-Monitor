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
# OUTPUTS (v3 — extended with Divergence & Curl):
#   - motion_grid    : float32 [rows, cols] — avg speed per cell (px/frame)
#   - chaos_grid     : float32 [rows, cols] — directional variance per cell
#   - divergence_grid: float32 [rows, cols] — avg divergence per cell
#                      Negative = crowd SQUEEZING inward (dangerous!)
#                      Positive = crowd dispersing outward (safe)
#   - curl_grid      : float32 [rows, cols] — avg curl magnitude per cell
#                      High = rotational / turbulent swirling motion
#   - flow_field     : float32 [H, W, 2]   — raw (dx, dy) vectors in small-frame scale
#
# DIVERGENCE & CURL PHYSICS:
# ───────────────────────────
# Think of the crowd as a fluid. Each pixel has a velocity (dx, dy).
#
# DIVERGENCE = ∂vx/∂x + ∂vy/∂y
#   "Is the fluid expanding or contracting at this point?"
#   If people all walk away from a point → positive (dispersing, safe).
#   If people all walk TOWARD a point   → negative (converging, CRUSHES form here).
#
# CURL = ∂vy/∂x - ∂vx/∂y
#   "Is the fluid rotating at this point?"
#   High curl magnitude means people are circling or swirling around a point.
#   This is the turbulence signal — often appears at bottleneck edges.
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
# to 480px uses ~8x less memory and is ~8x faster with no meaningful loss.
# =============================================================================

import cv2
import numpy as np

# Maximum pixel length of the longer side used for optical flow computation.
FLOW_MAX_SIDE = 480


class OpticalFlowAnalyzer:
    """
    Computes dense optical flow between consecutive frames and extracts
    per-grid-cell motion statistics including Divergence and Curl.

    Parameters
    ----------
    grid_rows, grid_cols  : int -- grid dimensions (must match DensityEstimator)
    frame_width, frame_height : int -- native video resolution
    flow_max_side         : int -- max pixel side for flow computation (default 480)
    """

    def __init__(self, grid_rows: int, grid_cols: int,
                 frame_width: int, frame_height: int,
                 flow_max_side: int = FLOW_MAX_SIDE):
        self.grid_rows = grid_rows
        self.grid_cols = grid_cols
        self.cell_w    = frame_width  // grid_cols
        self.cell_h    = frame_height // grid_rows

        longer = max(frame_width, frame_height)
        self.scale = min(1.0, flow_max_side / longer)

        self._scaled_cell_w = max(1, round(self.cell_w * self.scale))
        self._scaled_cell_h = max(1, round(self.cell_h * self.scale))

        self._prev_small = None

    def update(self, frame: np.ndarray):
        """
        Takes the current BGR frame and computes optical flow vs previous frame.

        Returns
        -------
        motion_grid     : float32 [rows, cols] -- avg motion magnitude per cell
        chaos_grid      : float32 [rows, cols] -- directional chaos per cell
        divergence_grid : float32 [rows, cols] -- avg divergence per cell
                          Negative = inward squeeze (dangerous!), Positive = dispersing
        curl_grid       : float32 [rows, cols] -- avg curl magnitude per cell (swirl)
        flow_field      : float32 [H, W, 2]   -- raw (dx, dy) in small-frame scale
        """
        motion_grid     = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)
        chaos_grid      = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)
        divergence_grid = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)
        curl_grid       = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)

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
            return (motion_grid, chaos_grid, divergence_grid, curl_grid,
                    np.zeros((sh, sw, 2), dtype=np.float32))

        # Step 2: Farneback Dense Optical Flow
        flow = cv2.calcOpticalFlowFarneback(
            self._prev_small, small,
            flow=None,
            pyr_scale=0.5, levels=3,
            winsize=13, iterations=3,
            poly_n=5, poly_sigma=1.2, flags=0
        )

        # Step 3: magnitude & angle
        magnitude, angle = cv2.cartToPolar(flow[:, :, 0], flow[:, :, 1])
        magnitude_native = magnitude / max(self.scale, 1e-6)

        # ── Step 4: Divergence and Curl ────────────────────────────────────────
        # Divergence = d(vx)/dx + d(vy)/dy
        # Curl       = d(vy)/dx - d(vx)/dy
        vx = flow[:, :, 0]
        vy = flow[:, :, 1]

        # np.gradient returns (grad_row_direction, grad_col_direction)
        # i.e., (d/dy, d/dx) because row index = y axis
        dvx_dy, dvx_dx = np.gradient(vx)
        dvy_dy, dvy_dx = np.gradient(vy)

        divergence_map = dvx_dx + dvy_dy   # negative = crowd squeezing inward
        curl_map       = dvy_dx - dvx_dy   # magnitude = rotational swirl strength

        # Step 5: per-cell aggregation
        scw = self._scaled_cell_w
        sch = self._scaled_cell_h

        for r in range(self.grid_rows):
            for c in range(self.grid_cols):
                y1 = r * sch;  y2 = min(y1 + sch, small.shape[0])
                x1 = c * scw;  x2 = min(x1 + scw, small.shape[1])

                cell_mag = magnitude_native[y1:y2, x1:x2]
                cell_ang = angle[y1:y2, x1:x2]
                cell_div = divergence_map[y1:y2, x1:x2]
                cell_crl = curl_map[y1:y2, x1:x2]

                if cell_mag.size == 0:
                    continue

                motion_grid[r, c] = float(np.mean(cell_mag))

                cos_std = float(np.std(np.cos(cell_ang)))
                sin_std = float(np.std(np.sin(cell_ang)))
                chaos_grid[r, c] = cos_std + sin_std

                # Mean signed divergence — important to keep sign for squeeze detection
                divergence_grid[r, c] = float(np.mean(cell_div))

                # Mean absolute curl — CW and CCW swirl are both dangerous
                curl_grid[r, c] = float(np.mean(np.abs(cell_crl)))

        self._prev_small = small
        return motion_grid, chaos_grid, divergence_grid, curl_grid, flow
