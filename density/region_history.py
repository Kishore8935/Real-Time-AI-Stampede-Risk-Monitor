# =============================================================================
# density/region_history.py — RegionHistory
#
# Responsibility: Maintain a rolling window of the last W smoothed density
# values for EACH grid cell. Used to compute stability metrics that prove
# the smoothing is working, and will later feed the risk fusion layer.
# =============================================================================

import numpy as np
from collections import deque


class RegionHistory:
    """
    Per-cell circular buffer of smoothed density values.

    Stores the last `window` frames of density for every (row, col) cell.
    Exposes statistical queries: mean, std, Coefficient of Variation (CoV),
    and Classification Flip Rate (CFR).

    Parameters
    ----------
    grid_rows, grid_cols : int
        Grid dimensions.
    window : int
        Rolling window length in frames.
        Default 30 ≈ 3 seconds at 10 FPS processing rate.
    """

    def __init__(self, grid_rows: int, grid_cols: int, window: int = 30):
        self.grid_rows = grid_rows
        self.grid_cols = grid_cols
        self.window    = window

        # 2D array of deques — one per cell
        self._density_buf = [
            [deque(maxlen=window) for _ in range(grid_cols)]
            for _ in range(grid_rows)
        ]
        # Parallel buffer for label history (for CFR)
        self._label_buf = [
            [deque(maxlen=window) for _ in range(grid_cols)]
            for _ in range(grid_rows)
        ]

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    def update(self, smoothed_grid: np.ndarray, label_grid: np.ndarray = None):
        """
        Append the current smoothed grid (and optionally labels) to buffers.

        Parameters
        ----------
        smoothed_grid : np.ndarray (float32), shape (grid_rows, grid_cols)
        label_grid    : np.ndarray (int32),   shape (grid_rows, grid_cols) — optional
        """
        for r in range(self.grid_rows):
            for c in range(self.grid_cols):
                self._density_buf[r][c].append(float(smoothed_grid[r, c]))
                if label_grid is not None:
                    self._label_buf[r][c].append(int(label_grid[r, c]))

    # ------------------------------------------------------------------
    # Per-cell statistics
    # ------------------------------------------------------------------

    def mean(self, r: int, c: int) -> float:
        h = self._density_buf[r][c]
        return float(np.mean(h)) if h else 0.0

    def std(self, r: int, c: int) -> float:
        h = self._density_buf[r][c]
        return float(np.std(h)) if len(h) > 1 else 0.0

    def cov(self, r: int, c: int) -> float:
        """
        Coefficient of Variation for cell (r, c).
        CoV = std / mean.  Lower = more stable.
        Returns 0 if the cell is consistently empty.
        """
        m = self.mean(r, c)
        return self.std(r, c) / m if m > 0.1 else 0.0

    def flip_rate(self, r: int, c: int) -> float:
        """
        Classification Flip Rate for cell (r, c).
        CFR = (number of label changes) / (window - 1).
        Target: < 0.1 for stable scenes.
        """
        h = list(self._label_buf[r][c])
        if len(h) < 2:
            return 0.0
        flips = sum(1 for i in range(1, len(h)) if h[i] != h[i - 1])
        return flips / (len(h) - 1)

    # ------------------------------------------------------------------
    # Global summary (for console logging)
    # ------------------------------------------------------------------

    def global_cov_summary(self) -> float:
        """Mean CoV across all cells that have any activity."""
        covs = [
            self.cov(r, c)
            for r in range(self.grid_rows)
            for c in range(self.grid_cols)
            if self.mean(r, c) > 0.1
        ]
        return float(np.mean(covs)) if covs else 0.0

    def global_flip_rate(self) -> float:
        """Mean CFR across all cells that have label history."""
        rates = [
            self.flip_rate(r, c)
            for r in range(self.grid_rows)
            for c in range(self.grid_cols)
            if len(self._label_buf[r][c]) >= 2
        ]
        return float(np.mean(rates)) if rates else 0.0

    def print_stability_report(self, frame_num: int):
        """
        Print a one-line stability summary to the console.
        Call every 30 processed frames to monitor system health.
        """
        cov  = self.global_cov_summary()
        cfr  = self.global_flip_rate()
        print(f"  [Stability @ frame {frame_num}]  "
              f"Global CoV: {cov:.3f}  |  "
              f"Global CFR: {cfr:.3f}  |  "
              f"(target CoV < 0.2, CFR < 0.1)")
