# =============================================================================
# density/estimator.py — DensityEstimator
#
# Responsibility: Convert a list of detected person bounding boxes into a
# raw 2D count grid. One integer per cell = number of persons whose
# bounding-box centre lands inside that cell.
# =============================================================================

import numpy as np


class DensityEstimator:
    """
    Maps person detections to a grid of raw person counts.

    Parameters
    ----------
    grid_rows, grid_cols : int
        Number of rows and columns in the analysis grid.
    frame_width, frame_height : int
        The resolution of the processed video frame (pixels).
    """

    def __init__(self, grid_rows: int, grid_cols: int,
                 frame_width: int, frame_height: int):
        self.grid_rows  = grid_rows
        self.grid_cols  = grid_cols
        self.cell_w     = frame_width  // grid_cols
        self.cell_h     = frame_height // grid_rows

    def compute(self, person_boxes: list) -> np.ndarray:
        """
        Build the raw count grid from detected person boxes.

        Parameters
        ----------
        person_boxes : list of (x1, y1, x2, y2, conf)
            Bounding box coordinates + confidence for each detected person.

        Returns
        -------
        raw_grid : np.ndarray, shape (grid_rows, grid_cols), dtype float32
            raw_grid[r][c] = number of persons in cell (r, c).
        """
        grid = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)

        for (x1, y1, x2, y2, conf) in person_boxes:
            # Use bounding box centre to assign to a cell
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            col = min(cx // self.cell_w, self.grid_cols - 1)
            row = min(cy // self.cell_h, self.grid_rows - 1)

            grid[row, col] += 1.0

        return grid
