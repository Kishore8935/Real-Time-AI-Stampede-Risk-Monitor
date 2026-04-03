# =============================================================================
# density/smoother.py — TemporalSmoother
#
# Responsibility: Apply Exponential Moving Average (EMA) smoothing to the
# raw density grid frame-by-frame, reducing detection noise.
#
# Formula:  smoothed[t] = α * raw[t]  +  (1 - α) * smoothed[t-1]
# With α = 0.4:
#   - 40% weight on the CURRENT frame (new information)
#   - 60% weight on the PREVIOUS smoothed state (memory)
# =============================================================================

import numpy as np


class TemporalSmoother:
    """
    Per-cell EMA smoother for the density grid.

    Parameters
    ----------
    grid_rows, grid_cols : int
        Grid dimensions (must match DensityEstimator).
    alpha : float
        EMA blending factor. 0 < alpha < 1.
        Higher = reacts faster but noisier.
        Lower  = smoother but slower to react.
    """

    def __init__(self, grid_rows: int, grid_cols: int, alpha: float = 0.4):
        self.alpha    = alpha
        self._smoothed = np.zeros((grid_rows, grid_cols), dtype=np.float32)
        self._ready   = False   # False until we have the first frame

    def update(self, raw_grid: np.ndarray) -> np.ndarray:
        """
        Apply EMA and return the updated smoothed grid.

        Parameters
        ----------
        raw_grid : np.ndarray, shape (grid_rows, grid_cols)
            Raw count grid from DensityEstimator for the current frame.

        Returns
        -------
        smoothed : np.ndarray, same shape
            EMA-smoothed density grid.
        """
        if not self._ready:
            # First frame: initialise smoothed state with the raw grid
            self._smoothed = raw_grid.copy()
            self._ready = True
        else:
            # Core EMA — one vectorised line, runs on the entire grid at once
            self._smoothed = self.alpha * raw_grid + (1.0 - self.alpha) * self._smoothed

        return self._smoothed.copy()

    def reset(self):
        """Reset internal state (call when switching to a new video clip)."""
        self._smoothed[:] = 0.0
        self._ready = False
