# =============================================================================
# density/classifier.py — DensityClassifier
#
# Per-cell labels:
#   LOW      (0)  →  0 to THRESH_HIGH-1 persons     → no colour
#   HIGH     (1)  →  THRESH_HIGH to THRESH_CRITICAL-1  → Orange
#   CRITICAL (2)  →  >= THRESH_CRITICAL               → Red
#
# Scene-level status (returned by get_scene_status):
#   "Normal"
#   "High Density Cell Detected"
#   "High Density Warning"          (>= HIGH_CELL_COUNT high cells)
#   "Critical Density Cell Detected"
#   "CRITICAL RISK"                 (>= CRITICAL_CELL_COUNT critical cells)
# =============================================================================

import numpy as np

# Label constants — import these elsewhere for consistency
LOW      = 0
HIGH     = 1
CRITICAL = 2

LABEL_NAMES = {
    LOW:      "Low",
    HIGH:     "High",
    CRITICAL: "Critical",
}

# Scene-level status hierarchy (higher number = more severe)
STATUS_HIERARCHY = {
    "Normal":                         0,
    "High Density Cell Detected":     1,
    "High Density Warning":           2,
    "Critical Density Cell Detected": 3,
    "CRITICAL RISK":                  4,
}


class DensityClassifier:
    """
    Converts the smoothed density grid into per-cell risk labels AND
    computes the overall scene-level alert status.

    Parameters
    ----------
    thresh_high     : int  — persons/cell threshold for High   (default 5)
    thresh_critical : int  — persons/cell threshold for Critical (default 8)
    high_cell_count     : int  — number of High cells to trigger scene Warning
    critical_cell_count : int  — number of Critical cells to trigger CRITICAL RISK
    """

    def __init__(self,
                 thresh_high: int     = 5,
                 thresh_critical: int = 8,
                 high_cell_count: int     = 3,
                 critical_cell_count: int = 2):
        self.thresh_high         = thresh_high
        self.thresh_critical     = thresh_critical
        self.high_cell_count     = high_cell_count
        self.critical_cell_count = critical_cell_count

    def classify(self, smoothed_grid: np.ndarray) -> np.ndarray:
        """
        Per-cell classification.

        Returns label_grid (int32): LOW=0, HIGH=1, CRITICAL=2
        """
        label_grid = np.full_like(smoothed_grid, LOW, dtype=np.int32)
        label_grid[smoothed_grid >= self.thresh_high]     = HIGH
        label_grid[smoothed_grid >= self.thresh_critical] = CRITICAL
        return label_grid

    def get_scene_status(self, smoothed_grid: np.ndarray) -> str:
        """
        Scene-level alert status based on how many risky cells exist.

        Returns one of the STATUS_HIERARCHY keys.
        """
        high_cells     = int(np.sum((smoothed_grid >= self.thresh_high) &
                                    (smoothed_grid <  self.thresh_critical)))
        critical_cells = int(np.sum(smoothed_grid >= self.thresh_critical))

        if critical_cells >= self.critical_cell_count:
            return "CRITICAL RISK"
        elif critical_cells > 0:
            return "Critical Density Cell Detected"
        elif high_cells >= self.high_cell_count:
            return "High Density Warning"
        elif high_cells > 0:
            return "High Density Cell Detected"
        else:
            return "Normal"
