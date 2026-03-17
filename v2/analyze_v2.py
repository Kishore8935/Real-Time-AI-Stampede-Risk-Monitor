# =============================================================================
# v2/analyze_v2.py — Enhanced Stampede Risk Analysis Pipeline
#
# What's NEW compared to process_video2.py (v1):
# ───────────────────────────────────────────────
# 1. OPTICAL FLOW  — measures HOW FAST and HOW CHAOTICALLY the crowd moves
# 2. RISK FUSION   — combines density + motion into a single Risk Score (0–100)
# 3. HYSTERESIS    — alerts upgrade instantly, downgrade slowly (no flickering)
# 4. RISK SCORE BAR — a 0–100 gauge on screen showing overall danger level
#
# How the pipeline works (step by step):
# ───────────────────────────────────────
#   Frame N  →  (1) YOLO detects persons  →  DensityEstimator  →  raw_density_grid
#               (2) Compare Frame N vs N-1 →  OpticalFlowAnalyzer → motion_grid + chaos_grid
#               (3) Combine density + motion → RiskFusion → risk_score_grid + global_score
#               (4) Draw coloured overlay + HUD + risk bar → write to output video
# =============================================================================

import sys
import os
import math
import time

import cv2
import numpy as np
from ultralytics import YOLO

# ── Import density modules from parent directory ──────────────────────────────
# We reuse the v1 density package rather than duplicating it.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from density.estimator      import DensityEstimator
from density.smoother       import TemporalSmoother
from density.region_history import RegionHistory

# ── Import new motion modules ─────────────────────────────────────────────────
from motion.flow        import OpticalFlowAnalyzer
from motion.risk_fusion import RiskFusion, RISK_LOW, RISK_HIGH, RISK_CRITICAL

# =============================================================================
# CONFIGURATION — all tunable parameters at the top of this file
# =============================================================================
INPUT_VIDEO  = "30744-382777820_medium.mp4"   # ← change this
OUTPUT_VIDEO = "30744-382777820_medium_v2.mp4"

YOLO_MODEL    = "yolo11n.pt"
YOLO_CONF_MIN = 0.02            # ultra-low conf catches partially-occluded persons

TARGET_CELL_AREA = 14400        # auto-grid: target cell area in pixels²
                                # sqrt(14400) = 120 → each cell ≈ 120x120px

INFERENCE_EVERY  = 2            # run YOLO every Nth frame (1 = every frame)
EMA_ALPHA        = 0.3          # EMA smoothing for stability metrics

# Risk Fusion weights — must sum to 1.0
DENSITY_WEIGHT = 0.70           # density contributes 70% (dominant signal)
MOTION_WEIGHT  = 0.30           # motion  contributes 30% (secondary signal)

# Thresholds for risk labels
THRESH_CRITICAL  = 8            # persons/cell considered max density for normalisation
MAX_MOTION       = 3.0          # motion magnitude (px/frame) considered maximum
HIGH_SCORE_THR   = 0.50         # risk score ≥ 0.50 → High  (Orange)
CRIT_SCORE_THR   = 0.75         # risk score ≥ 0.75 → Critical (Red)
DENSITY_GATE     = 0.20         # cells below this density fraction never get coloured
                                 # = 0.20 × THRESH_CRITICAL ≈ 1.6 persons minimum
HYSTERESIS_FRAMES = 8           # frames a cell must stay calm to downgrade

# Colours (BGR)
COLOR_LOW      = (0, 200,   0)  # Green  — low risk, people present
COLOR_HIGH     = (0, 165, 255)  # Orange — moderate risk
COLOR_CRITICAL = (0,   0, 255)  # Red    — critical risk

OVERLAY_ALPHA = {
    RISK_LOW:      0.22,   # lightest — just a hint of green
    RISK_HIGH:     0.40,
    RISK_CRITICAL: 0.55,
}

# =============================================================================
# Initialise
# =============================================================================
print("[v2] Loading YOLO model...")
model = YOLO(YOLO_MODEL)

parent_dir = os.path.join(os.path.dirname(__file__), "..")
cap = cv2.VideoCapture(os.path.join(parent_dir, INPUT_VIDEO))
if not cap.isOpened():
    raise RuntimeError(f"Cannot open video: {INPUT_VIDEO}")

fps_in       = cap.get(cv2.CAP_PROP_FPS)
FRAME_W      = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
FRAME_H      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Auto-compute grid so each cell is ≈ TARGET_CELL_AREA pixels²
GRID_COLS = max(2, round(FRAME_W / math.sqrt(TARGET_CELL_AREA)))
GRID_ROWS = max(2, round(FRAME_H / math.sqrt(TARGET_CELL_AREA)))
cell_w    = FRAME_W // GRID_COLS
cell_h    = FRAME_H // GRID_ROWS

print(f"[v2] Resolution   : {FRAME_W}x{FRAME_H}  @ {fps_in:.0f} FPS")
print(f"[v2] Grid (auto)  : {GRID_ROWS}×{GRID_COLS} = {GRID_ROWS*GRID_COLS} cells  ({cell_w}×{cell_h}px each)")
print(f"[v2] YOLO conf    : {YOLO_CONF_MIN}")
print(f"[v2] Risk weights : density={DENSITY_WEIGHT} + motion={MOTION_WEIGHT}")

out_path = os.path.join(parent_dir, OUTPUT_VIDEO)
fourcc   = cv2.VideoWriter_fourcc(*"mp4v")
out      = cv2.VideoWriter(out_path, fourcc, fps_in, (FRAME_W, FRAME_H))

# ── Module instances ──────────────────────────────────────────────────────────
estimator   = DensityEstimator(GRID_ROWS, GRID_COLS, FRAME_W, FRAME_H)
smoother    = TemporalSmoother(GRID_ROWS, GRID_COLS, alpha=EMA_ALPHA)
history     = RegionHistory(GRID_ROWS, GRID_COLS, window=30)

flow_analyzer = OpticalFlowAnalyzer(GRID_ROWS, GRID_COLS, FRAME_W, FRAME_H)
risk_fusion   = RiskFusion(
    grid_rows=GRID_ROWS, grid_cols=GRID_COLS,
    thresh_critical=THRESH_CRITICAL,
    max_motion=MAX_MOTION,
    density_weight=DENSITY_WEIGHT, motion_weight=MOTION_WEIGHT,
    high_score_threshold=HIGH_SCORE_THR,
    critical_score_threshold=CRIT_SCORE_THR,
    density_gate=DENSITY_GATE,
    hysteresis_frames=HYSTERESIS_FRAMES,
)

# ── State (for frame-skip: hold last known values) ────────────────────────────
last_raw_density  = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
last_risk_scores  = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
last_risk_labels  = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.int32)
last_global_score = 0.0
last_scene_status = "Normal"
last_count        = 0
last_fps          = 0.0

frame_count     = 0
processed_count = 0

print(f"\n[v2] Processing '{INPUT_VIDEO}' → '{OUTPUT_VIDEO}'\n")


# =============================================================================
# Rendering helpers — defined BEFORE the main loop so Python can find them
# =============================================================================
def render(frame, risk_labels, risk_scores,
           person_count, fps, global_score, scene_status,
           grid_rows, grid_cols, cell_w, cell_h):
    """
    Draw the full overlay on the frame:
      - Coloured risk zones (Orange = High, Red = Critical)
      - Top-left HUD: person count, FPS
      - Bottom banner: scene status + risk score gauge
    """
    COLOR_MAP = {
        RISK_LOW:      COLOR_LOW,
        RISK_HIGH:     COLOR_HIGH,
        RISK_CRITICAL: COLOR_CRITICAL,
    }

    # ── Draw coloured cells ───────────────────────────────────────────────────
    # RISK_LOW : only draw if risk_score > 0 (passed density gate, people present)
    # RISK_HIGH / RISK_CRITICAL : draw always when labelled
    for level in (RISK_LOW, RISK_HIGH, RISK_CRITICAL):
        if level == RISK_LOW:
            mask = (risk_labels == RISK_LOW) & (risk_scores > 0.0)
        else:
            mask = (risk_labels == level)
        if not np.any(mask):
            continue
        overlay = frame.copy()
        alpha   = OVERLAY_ALPHA[level]
        color   = COLOR_MAP[level]
        for r in range(grid_rows):
            for c in range(grid_cols):
                if not mask[r, c]:
                    continue
                x1, y1 = c * cell_w, r * cell_h
                cv2.rectangle(overlay, (x1, y1), (x1 + cell_w, y1 + cell_h), color, -1)
        cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame)

    # ── HUD: person count + FPS ───────────────────────────────────────────────
    hud = frame.copy()
    cv2.rectangle(hud, (0, 0), (260, 90), (0, 0, 0), -1)
    cv2.addWeighted(hud, 0.5, frame, 0.5, 0, frame)
    cv2.putText(frame, f"Persons: {person_count}", (10, 34),
                cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 255, 0), 2, cv2.LINE_AA)
    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 70),
                cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 230, 255), 2, cv2.LINE_AA)

    # ── Bottom banner: status + risk gauge ────────────────────────────────────
    H, W = frame.shape[:2]
    banner_h = 56
    y0 = H - banner_h
    bg = frame.copy()
    cv2.rectangle(bg, (0, y0), (W, H), (0, 0, 0), -1)
    cv2.addWeighted(bg, 0.6, frame, 0.4, 0, frame)

    if "CRITICAL" in scene_status or "Critical" in scene_status:
        s_color = COLOR_CRITICAL
    elif "Warning" in scene_status or "High" in scene_status or "Elevated" in scene_status:
        s_color = COLOR_HIGH
    else:
        s_color = (0, 200, 0)

    cv2.rectangle(frame, (0, y0), (6, H), s_color, -1)
    cv2.putText(frame, scene_status, (14, y0 + 36),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, s_color, 2, cv2.LINE_AA)
    _draw_risk_gauge(frame, global_score, W - 260, y0 + 8, 240, 40)
    return frame


def _draw_risk_gauge(frame, score, x, y, width, height):
    """Horizontal 0-100 risk bar. Green → Orange → Red."""
    cv2.rectangle(frame, (x, y), (x + width, y + height), (50, 50, 50), -1)
    cv2.rectangle(frame, (x, y), (x + width, y + height), (120, 120, 120), 1)
    filled = int(width * score / 100.0)
    if filled > 0:
        bar_color = (0, 200, 0) if score < 35 else (COLOR_HIGH if score < 65 else COLOR_CRITICAL)
        cv2.rectangle(frame, (x, y), (x + filled, y + height), bar_color, -1)
    label = f"Risk: {score:.0f}/100"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
    cv2.putText(frame, label, (x + (width - tw) // 2, y + height // 2 + th // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)


# =============================================================================
# Main Loop
# =============================================================================
while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1

    # ── YOLO + density on every Nth frame ────────────────────────────────────
    if frame_count % INFERENCE_EVERY == 0:
        t_start = time.time()

        results = model(frame, verbose=False, classes=[0], conf=YOLO_CONF_MIN)
        person_boxes = [
            (*map(float, box.xyxy[0].tolist()), float(box.conf[0]))
            for box in results[0].boxes
        ]
        last_count    = len(person_boxes)
        last_raw_density = estimator.compute(person_boxes)

        # EMA for stability metrics
        smoothed = smoother.update(last_raw_density)
        history.update(smoothed, last_risk_labels)

        # ── Optical flow ─────────────────────────────────────────────────────
        motion_grid, chaos_grid = flow_analyzer.update(frame)

        # ── Risk Fusion ───────────────────────────────────────────────────────
        last_risk_scores, last_risk_labels, last_global_score = risk_fusion.compute(
            last_raw_density, motion_grid, chaos_grid
        )
        last_scene_status = risk_fusion.get_scene_status(last_risk_labels)

        last_fps = 1.0 / max(time.time() - t_start, 1e-6)
        processed_count += 1

        if processed_count % 30 == 0:
            history.print_stability_report(frame_count)
            print(f"  Scene: {last_scene_status}  |  Risk Score: {last_global_score:.1f}/100")

    # ── Render ────────────────────────────────────────────────────────────────
    output_frame = render(
        frame.copy(),
        last_risk_labels, last_risk_scores,
        last_count, last_fps,
        last_global_score, last_scene_status,
        GRID_ROWS, GRID_COLS, cell_w, cell_h
    )
    out.write(output_frame)

cap.release()
out.release()
print(f"\n[v2] Done. Frames: {frame_count} read, {processed_count} processed.")
print(f"[v2] Output: {out_path}")
