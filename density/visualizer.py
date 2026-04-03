# =============================================================================
# density/visualizer.py — DensityVisualizer
#
# Colour scheme (matches Stampede-Predictor reference):
#   LOW      → no colour (transparent)
#   HIGH     → Orange  (0, 165, 255) BGR  — moderate danger
#   CRITICAL → Red     (0,   0, 255) BGR  — severe danger
#
# Scene status banner (bottom of frame):
#   "Normal"                         → Green
#   "High Density Cell Detected"     → Orange
#   "High Density Warning"           → Orange
#   "Critical Density Cell Detected" → Red
#   "CRITICAL RISK"                  → Red (flashing border)
# =============================================================================

import cv2
import numpy as np
from density.classifier import LOW, HIGH, CRITICAL

# BGR colours per label level
CELL_COLORS = {
    HIGH:     (0, 165, 255),   # Orange
    CRITICAL: (0,   0, 255),   # Red
}

# Overlay opacity per level
CELL_ALPHA = {
    HIGH:     0.40,
    CRITICAL: 0.55,
}

# Banner colour per scene status keyword
def _status_color(status: str):
    if "CRITICAL" in status or "Critical" in status:
        return (0, 0, 255)       # Red
    elif "Warning" in status or "High" in status or "Detected" in status:
        return (0, 165, 255)     # Orange
    else:
        return (0, 180, 0)       # Green


class DensityVisualizer:
    """
    Renders the density heatmap directly on the raw video frame.

    Parameters
    ----------
    grid_rows, grid_cols : int
    frame_width, frame_height : int
    """

    def __init__(self, grid_rows: int, grid_cols: int,
                 frame_width: int, frame_height: int):
        self.grid_rows  = grid_rows
        self.grid_cols  = grid_cols
        self.cell_w     = frame_width  // grid_cols
        self.cell_h     = frame_height // grid_rows
        self._frame_w   = frame_width
        self._frame_h   = frame_height

    def draw(self, base_frame: np.ndarray,
             label_grid: np.ndarray,
             smoothed_grid: np.ndarray,
             person_count: int,
             fps: float,
             scene_status: str = "Normal") -> np.ndarray:
        """
        Compose the final heatmap frame.

        Parameters
        ----------
        base_frame    : Raw video frame (no bounding boxes)
        label_grid    : Per-cell LOW/HIGH/CRITICAL labels
        smoothed_grid : EMA-smoothed density counts
        person_count  : Total persons this frame (HUD)
        fps           : Processing FPS (HUD)
        scene_status  : Scene-level alert string from DensityClassifier
        """
        result = base_frame.copy()

        # --- Draw HIGH cells (Orange) ---
        self._draw_level(result, label_grid, HIGH)

        # --- Draw CRITICAL cells (Red, on top of High) ---
        self._draw_level(result, label_grid, CRITICAL)

        # --- HUD (top-left: person count + FPS) ---
        self._draw_hud(result, person_count, fps)

        # --- Scene status banner (bottom of frame) ---
        self._draw_status_banner(result, scene_status)

        return result

    # ------------------------------------------------------------------
    def _draw_level(self, frame: np.ndarray, label_grid: np.ndarray, level: int):
        """Fill all cells of the given level with the corresponding colour."""
        color = CELL_COLORS[level]
        alpha = CELL_ALPHA[level]

        mask = (label_grid == level)
        if not np.any(mask):
            return

        overlay = frame.copy()
        for r in range(self.grid_rows):
            for c in range(self.grid_cols):
                if not mask[r, c]:
                    continue
                x1 = c * self.cell_w
                y1 = r * self.cell_h
                cv2.rectangle(overlay, (x1, y1),
                              (x1 + self.cell_w, y1 + self.cell_h),
                              color, -1)

        cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame)

    def _draw_grid(self, frame: np.ndarray):
        """Faint grid lines."""
        color = (50, 50, 50)
        h, w = frame.shape[:2]
        for r in range(1, self.grid_rows):
            cv2.line(frame, (0, r * self.cell_h), (w, r * self.cell_h), color, 1)
        for c in range(1, self.grid_cols):
            cv2.line(frame, (c * self.cell_w, 0), (c * self.cell_w, h), color, 1)

    def _draw_hud(self, frame: np.ndarray, person_count: int, fps: float):
        """Top-left HUD strip: person count and FPS."""
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (230, 90), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.50, frame, 0.50, 0, frame)

        cv2.putText(frame, f"Persons: {person_count}",
                    (10, 34), cv2.FONT_HERSHEY_SIMPLEX,
                    0.85, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.putText(frame, f"FPS: {fps:.1f}",
                    (10, 72), cv2.FONT_HERSHEY_SIMPLEX,
                    0.85, (0, 230, 255), 2, cv2.LINE_AA)

    def _draw_status_banner(self, frame: np.ndarray, scene_status: str):
        """
        Full-width status banner at the bottom of the frame.
        Shows the scene-level alert string with background matching severity.
        """
        h, w = frame.shape[:2]
        banner_h = 48
        y0 = h - banner_h

        color  = _status_color(scene_status)
        banner = frame.copy()
        cv2.rectangle(banner, (0, y0), (w, h), (0, 0, 0), -1)
        cv2.addWeighted(banner, 0.55, frame, 0.45, 0, frame)

        # Coloured left accent bar
        cv2.rectangle(frame, (0, y0), (6, h), color, -1)

        # Status text
        text = f"Status: {scene_status}"
        font_scale = 0.75
        thickness  = 2
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX,
                                       font_scale, thickness)
        tx = (w - tw) // 2
        ty = y0 + (banner_h + th) // 2 - 2

        cv2.putText(frame, text, (tx, ty),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    font_scale, color, thickness, cv2.LINE_AA)

        # --- Legend (right side of banner) ---
        items = [
            ("High (5-7)",  CELL_COLORS[HIGH]),
            ("Critical(8+)", CELL_COLORS[CRITICAL]),
        ]
        lx = w - 170
        ly = y0 + 14
        for label, lc in items:
            cv2.rectangle(frame, (lx, ly - 10), (lx + 14, ly + 4), lc, -1)
            cv2.putText(frame, label, (lx + 18, ly + 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38,
                        (220, 220, 220), 1, cv2.LINE_AA)
            ly += 20
