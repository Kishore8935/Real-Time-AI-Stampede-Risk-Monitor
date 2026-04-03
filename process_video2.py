# =============================================================================
# process_video2.py — Crowd Density Analysis Pipeline
#
# Pipeline:
#   VideoCapture → YOLO detection → DensityEstimator → TemporalSmoother
#                → DensityClassifier (per-cell + scene status)
#                → RegionHistory → DensityVisualizer
#
# Key design choices (matching Stampede-Predictor reference):
#   - conf = 0.02 (ultra-low, catches occluded persons in dense crowds)
#   - 8×8 grid (64 cells, finer spatial resolution)
#   - Two-level thresholds: High (≥5) and Critical (≥8) per cell
#   - Scene status: derived from count of risky cells
#   - Orange = High, Red = Critical (no bounding boxes)
#   - No frame resize — native video resolution preserved
# =============================================================================

from ultralytics import YOLO
import cv2
import numpy as np
import time

from config import (
    YOLO_MODEL, YOLO_CONF_MIN,
    EMA_ALPHA,
    TARGET_CELL_AREA,
    THRESH_HIGH, THRESH_CRITICAL,
    HIGH_CELL_COUNT, CRITICAL_CELL_COUNT,
    INFERENCE_EVERY,
    HISTORY_WINDOW,
)

from density.estimator      import DensityEstimator
from density.smoother       import TemporalSmoother
from density.classifier     import DensityClassifier
from density.visualizer     import DensityVisualizer
from density.region_history import RegionHistory

# =============================================================================
# Configuration — change input/output paths here
# =============================================================================
INPUT_VIDEO  = "istockphoto-1487462573-640_adpp_is.mp4"
OUTPUT_VIDEO = "processed_istockphoto1.mp4"

# =============================================================================
# Initialise
# =============================================================================
print("[INFO] Loading YOLO model...")
model = YOLO(YOLO_MODEL)

cap = cv2.VideoCapture(INPUT_VIDEO)
if not cap.isOpened():
    raise RuntimeError(f"Cannot open video: {INPUT_VIDEO}")

fps_input    = cap.get(cv2.CAP_PROP_FPS)
FRAME_WIDTH  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
FRAME_HEIGHT = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Auto-compute grid so cell area stays ~TARGET_CELL_AREA px² for any resolution.
# Formula: cols = sqrt(W*H / target_area * W/H) = W / sqrt(target_area)
import math
GRID_COLS = max(2, round(FRAME_WIDTH  / math.sqrt(TARGET_CELL_AREA)))
GRID_ROWS = max(2, round(FRAME_HEIGHT / math.sqrt(TARGET_CELL_AREA)))
cell_w = FRAME_WIDTH  // GRID_COLS
cell_h = FRAME_HEIGHT // GRID_ROWS

print(f"[INFO] Input FPS      : {fps_input:.1f}")
print(f"[INFO] Resolution     : {FRAME_WIDTH}x{FRAME_HEIGHT}")
print(f"[INFO] Grid (auto)    : {GRID_ROWS}x{GRID_COLS}  ({GRID_ROWS*GRID_COLS} cells, each {cell_w}x{cell_h}px)")
print(f"[INFO] YOLO conf      : {YOLO_CONF_MIN}")
print(f"[INFO] Thresholds     : High>={THRESH_HIGH}, Critical>={THRESH_CRITICAL}")

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out    = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, fps_input, (FRAME_WIDTH, FRAME_HEIGHT))

# --- Density module instances ---
estimator  = DensityEstimator(GRID_ROWS, GRID_COLS, FRAME_WIDTH, FRAME_HEIGHT)
smoother   = TemporalSmoother(GRID_ROWS, GRID_COLS, alpha=EMA_ALPHA)
classifier = DensityClassifier(
    thresh_high=THRESH_HIGH,
    thresh_critical=THRESH_CRITICAL,
    high_cell_count=HIGH_CELL_COUNT,
    critical_cell_count=CRITICAL_CELL_COUNT,
)
visualizer = DensityVisualizer(GRID_ROWS, GRID_COLS, FRAME_WIDTH, FRAME_HEIGHT)
history    = RegionHistory(GRID_ROWS, GRID_COLS, window=HISTORY_WINDOW)

# =============================================================================
# State (holds last known values so skipped frames can still render)
# =============================================================================
last_smoothed    = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
last_labels      = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.int32)
last_scene_status = "Normal"
last_count       = 0
last_fps         = 0.0

frame_count     = 0
processed_count = 0

print(f"\n[INFO] Processing '{INPUT_VIDEO}'  →  '{OUTPUT_VIDEO}'")
print(f"[INFO] YOLO runs every {INFERENCE_EVERY} frame(s).  EMA α={EMA_ALPHA}\n")

# =============================================================================
# Main Loop
# =============================================================================
while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1
    # No resize — process at native resolution

    # ------------------------------------------------------------------
    # YOLO inference on every Nth frame
    # ------------------------------------------------------------------
    if frame_count % INFERENCE_EVERY == 0:
        t_start = time.time()

        results = model(frame, verbose=False, classes=[0], conf=YOLO_CONF_MIN)
        boxes   = results[0].boxes

        person_boxes = [
            (*map(float, box.xyxy[0].tolist()), float(box.conf[0]))
            for box in boxes
        ]
        last_count = len(person_boxes)

        # --- Density pipeline ---
        raw_grid          = estimator.compute(person_boxes)
        last_smoothed     = smoother.update(raw_grid)   # EMA — for stability metrics only

        # Classify on RAW counts (not smoothed) — matches reference repo logic.
        # Smoothing would dampen counts below thresholds, hiding real density.
        last_labels       = classifier.classify(raw_grid)
        last_scene_status = classifier.get_scene_status(raw_grid)
        history.update(last_smoothed, last_labels)

        last_fps = 1.0 / max(time.time() - t_start, 1e-6)
        processed_count += 1

        # Stability log every 30 processed frames
        if processed_count % 30 == 0:
            history.print_stability_report(frame_count)
            print(f"  Scene Status: {last_scene_status}")

    # ------------------------------------------------------------------
    # Render (always uses the most recent smoothed state)
    # ------------------------------------------------------------------
    output_frame = visualizer.draw(
        frame,
        last_labels,
        last_smoothed,
        last_count,
        last_fps,
        scene_status=last_scene_status,
    )
    out.write(output_frame)

# =============================================================================
# Cleanup
# =============================================================================
cap.release()
out.release()

print(f"\n[DONE] Frames read     : {frame_count}")
print(f"[DONE] Frames processed: {processed_count}")
print(f"[DONE] Output          : {OUTPUT_VIDEO}")
