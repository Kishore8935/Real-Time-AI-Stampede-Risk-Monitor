# =============================================================================
# config.py — Crowd Density Module Configuration
# =============================================================================

# --- YOLO ---
YOLO_MODEL    = "yolo11n.pt"
YOLO_CONF_MIN = 0.02        # Ultra-low — catches occluded persons in dense crowds

# --- Temporal Smoothing (EMA) ---
EMA_ALPHA = 0.3
# Used only for RegionHistory stability metrics — classification uses raw counts

# --- Auto Grid Sizing ---
# Target cell area in pixels². Grid is auto-computed per video so density
# thresholds stay physically meaningful regardless of resolution or aspect ratio.
#   ~14400 px²  ≈ a 120x120px cell  (good for 720p–1080p)
#   ~6400  px²  ≈ a  80x80px cell   (tighter; use for very high res)
TARGET_CELL_AREA = 14400    # adjust if cells feel too big or too small

# --- Per-Cell Density Thresholds (persons per cell) ---
# These thresholds are FIXED regardless of resolution because the auto-grid
# keeps cell area constant. Calibrated for TARGET_CELL_AREA ≈ 14400 px²:
THRESH_HIGH     = 5         # >= 5 persons/cell  → High     (Orange)
THRESH_CRITICAL = 8         # >= 8 persons/cell  → Critical (Red)

# --- Scene-Level Thresholds ---
HIGH_CELL_COUNT     = 3     # >= 3 High cells     → "High Density Warning"
CRITICAL_CELL_COUNT = 2     # >= 2 Critical cells → "CRITICAL RISK"

# --- Frame Skip ---
INFERENCE_EVERY = 2
# Run YOLO on every 2nd frame. Set to 1 to process every frame (slower).

# --- Region History ---
HISTORY_WINDOW = 30         # rolling window length in frames
