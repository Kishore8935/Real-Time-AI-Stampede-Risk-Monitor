# =============================================================================
# v3_web/app.py — Live Crowd Risk Dashboard (FastAPI)
#
# Routes:
#   GET  /            → Landing page (upload a video)
#   GET  /dashboard   → Live analysis dashboard (video stream + stats)
#   GET  /video_feed  → MJPEG stream of processed frames
#   GET  /api/stats   → JSON with current risk score, status, etc.
#   POST /upload      → Receive uploaded video, start processing
#   POST /cancel      → Stop current analysis, return session summary
# =============================================================================

import sys
import os
import math
import time
import threading

import cv2
import numpy as np
from ultralytics import YOLO

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
import uvicorn
import json
from dotenv import load_dotenv

load_dotenv()  # Load .env file automatically

# Optional: new Gemini AI SDK (google-genai)
try:
    from google import genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

# ── Path setup ────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
V2_DIR     = os.path.join(BASE_DIR, "..", "v2")
PARENT_DIR = os.path.join(BASE_DIR, "..")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

sys.path.insert(0, PARENT_DIR)
sys.path.insert(0, V2_DIR)

from density.estimator      import DensityEstimator
from density.smoother       import TemporalSmoother
from density.region_history import RegionHistory
from motion.flow            import OpticalFlowAnalyzer
from motion.risk_fusion     import RiskFusion, RISK_LOW, RISK_HIGH, RISK_CRITICAL

# =============================================================================
# CONFIGURATION
# =============================================================================
YOLO_MODEL        = "yolo11n.pt"
YOLO_CONF_MIN     = 0.02
TARGET_CELL_AREA  = 14400
INFERENCE_EVERY   = 2
EMA_ALPHA         = 0.3
DENSITY_WEIGHT    = 0.50          # Default preset — 50% density
MOTION_WEIGHT     = 0.25          #                  25% motion
PRESSURE_WEIGHT   = 0.25          #                  25% crowd pressure (density×chaos)
THRESH_CRITICAL   = 8
MAX_MOTION        = 3.0
HIGH_SCORE_THR    = 0.50
CRIT_SCORE_THR    = 0.75
DENSITY_GATE      = 0.20
HYSTERESIS_FRAMES = 8

CALIB_SECONDS     = 8            # Seconds of video to sample for calibration
CALIB_MIN_SAMPLES = 30           # Must collect at least this many samples

COLOR_LOW      = (0, 200,   0)
COLOR_HIGH     = (0, 165, 255)
COLOR_CRITICAL = (0,   0, 255)
OVERLAY_ALPHA  = {RISK_LOW: 0.10, RISK_HIGH: 0.20, RISK_CRITICAL: 0.32}

# =============================================================================
# Shared state
# =============================================================================
_lock              = threading.Lock()
_latest_frame_jpg  = None
_processing_active = False
_latest_stats      = {
    "active":         False,
    "risk_score":     0.0,
    "status":         "Idle",
    "person_count":   0,
    "fps":            0.0,
    "high_cells":     0,
    "critical_cells": 0,
    "grid_rows":      0,
    "grid_cols":      0,
    "current_video":  "",
    "calib_mode":     False,
    "calib_status":   "off",
    "density_weight": 70,
    "motion_weight":  30,
}

# Session metrics — tracked for the session summary shown on cancel
_session_peak_risk   = 0.0
_session_peak_status = "Normal"
_session_start_time  = 0.0
_session_frames      = 0

# ── Auto-Calibration state ────────────────────────────────────────────────────
_calib_mode_enabled  = False      # Toggled by the UI switch
_calib_status        = "off"      # "off" | "calibrating" | "done"
_active_density_w    = DENSITY_WEIGHT
_active_motion_w     = MOTION_WEIGHT

# ── Optical Flow Overlay state ────────────────────────────────────────────────
_show_flow_overlay   = False      # Toggled by the dashboard UI
_latest_flow_field   = None       # Stores the last (H, W, 2) flow array

# Hot-swap / cancel signals
_next_video_path = None
_new_video_event = threading.Event()
_cancel_event    = threading.Event()

# ── Per-session configuration (set from landing page form on each upload) ─────
# These defaults are used until the user changes them via the landing page UI.
_session_config = {
    # Core weights
    "density_bias":       0.70,  # 0.0-1.0: share of density in density+motion split
    "pressure_enabled":  True,   # bool: include crowd pressure signal
    "pressure_weight":   0.25,   # fraction of total risk score for pressure
    "auto_calib":        False,  # bool: auto-tune density/motion weights
    # Visuals
    "overlay_alpha":     0.20,   # single float: scales all overlay levels
    "grid_size":         "standard",  # "coarse" | "standard" | "detailed"
    # Sensitivity / thresholds
    "thresh_critical":   8,      # int: max people per cell = 1.0 density
    "high_score_thr":    0.50,   # 0.0-1.0: risk score for HIGH alert
    "crit_score_thr":    0.75,   # 0.0-1.0: risk score for CRITICAL alert
    "hysteresis":        8,      # int: frames alert stays on after clearing
}

# =============================================================================
# Rendering
# =============================================================================
def render_frame(frame, risk_labels, risk_scores,
                 person_count, fps, grid_rows, grid_cols, cell_w, cell_h,
                 overlay_alphas=None):
    """Draw colored cell overlays and HUD text onto frame in-place."""
    if overlay_alphas is None:
        overlay_alphas = OVERLAY_ALPHA
    COLOR_MAP = {RISK_LOW: COLOR_LOW, RISK_HIGH: COLOR_HIGH, RISK_CRITICAL: COLOR_CRITICAL}
    for level in (RISK_LOW, RISK_HIGH, RISK_CRITICAL):
        mask = (risk_labels == level) & (risk_scores > 0.0) if level == RISK_LOW \
               else (risk_labels == level)
        if not np.any(mask):
            continue
        overlay = frame.copy()
        for r in range(grid_rows):
            for c in range(grid_cols):
                if not mask[r, c]:
                    continue
                x1, y1 = c * cell_w, r * cell_h
                cv2.rectangle(overlay, (x1, y1), (x1 + cell_w, y1 + cell_h),
                              COLOR_MAP[level], -1)
        cv2.addWeighted(overlay, overlay_alphas[level], frame,
                        1.0 - overlay_alphas[level], 0, frame)

    hud = frame.copy()
    cv2.rectangle(hud, (0, 0), (240, 84), (0, 0, 0), -1)
    cv2.addWeighted(hud, 0.55, frame, 0.45, 0, frame)
    cv2.putText(frame, f"Persons : {person_count}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
    cv2.putText(frame, f"FPS     : {fps:.1f}", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 230, 255), 2, cv2.LINE_AA)
    return frame


def draw_flow_overlay(frame, flow_field, grid_rows, grid_cols, cell_w, cell_h, scale=1.0):
    """
    Draw sampled optical flow arrows onto the frame.
    One arrow per grid cell, showing average X/Y direction.
    flow_field: (H, W, 2) in small-frame pixel units.
    scale: the inverse of OpticalFlowAnalyzer.scale (to convert back to native pixels).
    """
    if flow_field is None:
        return
    fh, fw = flow_field.shape[:2]
    step_y = max(1, fh // grid_rows)
    step_x = max(1, fw // grid_cols)

    # Arrow amplification: makes small movements visible on screen
    AMPLIFY = 6.0

    for r in range(grid_rows):
        for c in range(grid_cols):
            # Sample center of cell in the small (downscaled) frame
            sy = int((r + 0.5) * step_y)
            sx = int((c + 0.5) * step_x)
            sy = min(sy, fh - 1)
            sx = min(sx, fw - 1)

            dx = float(flow_field[sy, sx, 0]) * AMPLIFY / max(scale, 1e-6)
            dy = float(flow_field[sy, sx, 1]) * AMPLIFY / max(scale, 1e-6)

            # Native-pixel center of this grid cell on the output frame
            cx = int((c + 0.5) * cell_w)
            cy = int((r + 0.5) * cell_h)
            ex = int(cx + dx)
            ey = int(cy + dy)

            # Skip negligible arrows (static cells) — avoids noise
            mag = (dx ** 2 + dy ** 2) ** 0.5
            if mag < 2.0:
                continue

            # Color arrows cyan for normal, orange for fast movement (mag > 20)
            color = (0, 165, 255) if mag > 20 else (0, 230, 255)
            cv2.arrowedLine(frame, (cx, cy), (ex, ey), color, 2,
                            tipLength=max(0.15, 10.0 / max(mag, 1)))


# =============================================================================
# Background processing thread
# =============================================================================
def processing_thread():
    global _latest_frame_jpg, _latest_stats, _next_video_path, _processing_active
    global _session_peak_risk, _session_peak_status, _session_start_time, _session_frames
    global _calib_status, _active_density_w, _active_motion_w, _calib_mode_enabled
    global _session_config, _latest_flow_field

    print("[v3] YOLO loading…")
    model = YOLO(YOLO_MODEL)
    print("[v3] Ready — waiting for video upload.")

    while True:
        _new_video_event.wait()
        _new_video_event.clear()
        _cancel_event.clear()

        with _lock:
            current_path = _next_video_path
            _next_video_path = None
            _processing_active = True

        if not current_path:
            continue

        # ── Read session configuration set at upload time ─────────────────────
        with _lock:
            cfg = _session_config.copy()

        # Derive density/motion weights from the bias slider
        # bias=0.70 means density=70%, motion=30% of the non-pressure slice
        density_bias    = float(cfg["density_bias"])
        pressure_on     = bool(cfg["pressure_enabled"])
        p_weight        = float(cfg["pressure_weight"]) if pressure_on else 0.0
        remaining       = 1.0 - p_weight
        d_weight        = density_bias * remaining
        m_weight        = (1.0 - density_bias) * remaining
        _calib_mode_enabled = bool(cfg["auto_calib"])

        # Compute overlay alphas from the user's single transparency value
        base_alpha = float(cfg["overlay_alpha"])
        session_overlay_alphas = {
            RISK_LOW:      base_alpha * 0.5,   # safe cells = half as bright
            RISK_HIGH:     base_alpha,
            RISK_CRITICAL: min(1.0, base_alpha * 1.6),  # critical pops more
        }

        # Grid size from dropdown
        grid_presets = {"coarse": 14400 * 4, "standard": 14400, "detailed": 14400 // 4}
        cell_area = grid_presets.get(cfg["grid_size"], 14400)

        # Reset session metrics
        _session_peak_risk   = 0.0
        _session_peak_status = "Normal"
        _session_start_time  = time.time()
        _session_frames      = 0

        # Reset calibration state for this session
        if _calib_mode_enabled:
            _calib_status     = "calibrating"
            _active_density_w = d_weight
            _active_motion_w  = m_weight
        else:
            _calib_status     = "off"
            _active_density_w = d_weight
            _active_motion_w  = m_weight

        calib_density_samples = []
        calib_motion_samples  = []

        cap = cv2.VideoCapture(current_path)
        if not cap.isOpened():
            print(f"[v3] Cannot open '{current_path}'")
            with _lock:
                _latest_stats["status"] = "Error: cannot open video"
                _processing_active = False
            continue

        FRAME_W   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        FRAME_H   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        GRID_COLS = max(2, round(FRAME_W / math.sqrt(cell_area)))
        GRID_ROWS = max(2, round(FRAME_H / math.sqrt(cell_area)))
        cell_w    = FRAME_W // GRID_COLS
        cell_h    = FRAME_H // GRID_ROWS
        video_name = os.path.basename(current_path)

        print(f"[v3] '{video_name}'  {FRAME_W}×{FRAME_H}  "
              f"grid {GRID_ROWS}×{GRID_COLS} ({cell_w}×{cell_h}px)")

        estimator     = DensityEstimator(GRID_ROWS, GRID_COLS, FRAME_W, FRAME_H)
        smoother      = TemporalSmoother(GRID_ROWS, GRID_COLS, alpha=EMA_ALPHA)
        history       = RegionHistory(GRID_ROWS, GRID_COLS, window=30)
        flow_analyzer = OpticalFlowAnalyzer(GRID_ROWS, GRID_COLS, FRAME_W, FRAME_H)
        risk_fusion   = RiskFusion(
            grid_rows=GRID_ROWS, grid_cols=GRID_COLS,
            thresh_critical=int(cfg["thresh_critical"]),
            max_motion=MAX_MOTION,
            density_weight=_active_density_w,
            motion_weight=_active_motion_w,
            pressure_weight=p_weight,
            high_score_threshold=float(cfg["high_score_thr"]),
            critical_score_threshold=float(cfg["crit_score_thr"]),
            density_gate=DENSITY_GATE,
            hysteresis_frames=int(cfg["hysteresis"]),
        )
        print(f"[config] d={d_weight:.2f} m={m_weight:.2f} p={p_weight:.2f} "
              f"alpha={base_alpha:.2f} grid={cfg['grid_size']} "
              f"thresh={cfg['thresh_critical']} calib={_calib_mode_enabled}")
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        # Target sample count: FPS / INFERENCE_EVERY * CALIB_SECONDS
        # e.g. 25fps / 2 * 8s = 100 samples
        calib_sample_target = max(CALIB_MIN_SAMPLES,
                                  int((video_fps / INFERENCE_EVERY) * CALIB_SECONDS))
        print(f"[calib] Calibration target: {calib_sample_target} processed samples "
              f"({CALIB_SECONDS}s at {video_fps:.0f}fps)")

        last_raw_density      = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
        last_risk_scores      = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
        last_risk_labels      = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.int32)
        last_pressure_grid    = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
        last_divergence_grid  = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
        last_curl_grid        = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)
        last_global_score     = 0.0
        last_avg_pressure     = 0.0
        last_avg_divergence   = 0.0   # scene-level squeeze signal (negative = dangerous)
        last_avg_curl         = 0.0   # scene-level swirl/turbulence signal
        last_scene_status     = "Normal"
        last_count            = 0
        last_fps              = 0.0
        frame_count       = 0
        processed_count   = 0

        # ── Inner loop ────────────────────────────────────────────────────────
        while not _new_video_event.is_set() and not _cancel_event.is_set():
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            frame_count += 1

            try:
                if frame_count % INFERENCE_EVERY == 0:
                    t0 = time.time()
                    results = model(frame, verbose=False, classes=[0], conf=YOLO_CONF_MIN)
                    person_boxes = [
                        (*map(float, b.xyxy[0].tolist()), float(b.conf[0]))
                        for b in results[0].boxes
                    ]
                    last_count       = len(person_boxes)
                    last_raw_density = estimator.compute(person_boxes)
                    smoothed         = smoother.update(last_raw_density)
                    history.update(smoothed, last_risk_labels)

                    motion_grid, chaos_grid, last_divergence_grid, last_curl_grid, _flow_field = \
                        flow_analyzer.update(frame)

                    # Compute scene-level divergence and curl averages
                    # For divergence: use min (most negative = most squeeze) across top 25% worst cells
                    flat_div = last_divergence_grid.flatten()
                    last_avg_divergence = float(np.mean(np.sort(flat_div)[:max(1, len(flat_div)//4)]))
                    # For curl: top 25% strongest swirl cells
                    flat_curl = last_curl_grid.flatten()
                    last_avg_curl = float(np.mean(np.sort(flat_curl)[::-1][:max(1, len(flat_curl)//4)]))

                    # ── Auto-Calibration: collect baseline samples ────────────
                    if _calib_mode_enabled and _calib_status == "calibrating":
                        calib_density_samples.append(float(np.mean(last_raw_density)))
                        calib_motion_samples.append(float(np.mean(motion_grid)))
                        n_samples = len(calib_density_samples)

                        if n_samples >= calib_sample_target:
                            # Compute std-based weights
                            d_std = float(np.std(calib_density_samples))
                            m_std = float(np.std(calib_motion_samples))

                            # Guard: if both signals are completely flat,
                            # use a sensible default rather than 50/50 noise
                            if d_std < 1e-4 and m_std < 1e-4:
                                # Density is always more meaningful in static baseline
                                _active_density_w = 0.70
                                _active_motion_w  = 0.30
                                note = "(flat baseline — kept at 70/30 preset)"
                            else:
                                total = (d_std + 1e-6) + (m_std + 1e-6)
                                _active_density_w = round((d_std + 1e-6) / total, 2)
                                _active_motion_w  = round((m_std + 1e-6) / total, 2)
                                note = ""

                            # Hot-apply to running risk_fusion
                            risk_fusion.w_density = _active_density_w
                            risk_fusion.w_motion  = _active_motion_w
                            _calib_status = "done"
                            print(f"[calib] ✓ {n_samples} samples processed. "
                                  f"Weights locked → "
                                  f"Density={_active_density_w:.2f} ({int(_active_density_w*100)}%)  "
                                  f"Motion={_active_motion_w:.2f} ({int(_active_motion_w*100)}%)  "
                                  f"{note}")

                    last_risk_scores, last_risk_labels, last_global_score, \
                        last_pressure_grid, last_avg_pressure = \
                        risk_fusion.compute(last_raw_density, motion_grid, chaos_grid)
                    last_scene_status = risk_fusion.get_scene_status(last_risk_labels)
                    last_fps = 1.0 / max(time.time() - t0, 1e-6)

                    processed_count += 1
                    _session_frames = processed_count

                    # Track session peak
                    if last_global_score > _session_peak_risk:
                        _session_peak_risk   = last_global_score
                        _session_peak_status = last_scene_status

                    if processed_count % 30 == 0:
                        history.print_stability_report(frame_count)
                        print(f"  Scene: {last_scene_status}  |  "
                              f"Risk Score: {last_global_score:.1f}/100  |  "
                              f"Persons: {last_count}")

                # Update latest flow field for the overlay renderer
                with _lock:
                    _latest_flow_field = _flow_field

                out = render_frame(
                    frame.copy(), last_risk_labels, last_risk_scores,
                    last_count, last_fps, GRID_ROWS, GRID_COLS, cell_w, cell_h,
                    overlay_alphas=session_overlay_alphas
                )
                # Draw optical flow arrows on top when toggled on
                if _show_flow_overlay:
                    with _lock:
                        ff = _latest_flow_field
                    draw_flow_overlay(
                        out, ff, GRID_ROWS, GRID_COLS, cell_w, cell_h,
                        scale=flow_analyzer.scale
                    )
                ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if not ok:
                    continue

                high_c = int(np.sum(last_risk_labels == RISK_HIGH))
                crit_c = int(np.sum(last_risk_labels == RISK_CRITICAL))

                with _lock:
                    _latest_frame_jpg = buf.tobytes()
                    _latest_stats = {
                        "active":                  True,
                        "risk_score":              round(last_global_score, 1),
                        "status":                  last_scene_status,
                        "person_count":            last_count,
                        "fps":                     round(last_fps, 1),
                        "high_cells":              high_c,
                        "critical_cells":          crit_c,
                        "grid_rows":               GRID_ROWS,
                        "grid_cols":               GRID_COLS,
                        "current_video":           video_name,
                        # Crowd Pressure
                        "avg_pressure":            round(last_avg_pressure, 1),
                        # Divergence & Curl (new physics signals)
                        # divergence: negative = crowd squeezing inward (dangerous)
                        # we send it as a 0-100 "squeeze intensity" where 50=neutral
                        "avg_divergence":          round(last_avg_divergence, 3),
                        "avg_curl":                round(last_avg_curl, 3),
                        # Calibration fields
                        "calib_mode":              _calib_mode_enabled,
                        "calib_status":            _calib_status,
                        "density_weight":          round(_active_density_w * 100),
                        "motion_weight":           round(_active_motion_w  * 100),
                        "calib_sample_target":     calib_sample_target,
                        "calib_samples_collected": len(calib_density_samples),
                    }

            except cv2.error as e:
                print(f"[v3] OpenCV error (frame skipped): {e}")
            except Exception as e:
                print(f"[v3] Error (frame skipped): {e}")

        cap.release()

        # Mark as inactive after cancel or new video swap
        with _lock:
            _processing_active = False
            _latest_stats["active"] = False

        if _cancel_event.is_set():
            elapsed = time.time() - _session_start_time
            print(f"[v3] Analysis cancelled after {elapsed:.0f}s. "
                  f"Peak risk: {_session_peak_risk:.1f}/100 ({_session_peak_status})")
            _cancel_event.clear()


# =============================================================================
# FastAPI
# =============================================================================
app = FastAPI(title="Crowd Risk Monitor")


@app.get("/")
def landing():
    return FileResponse(os.path.join(BASE_DIR, "templates", "landing.html"))


@app.get("/dashboard")
def dashboard():
    return FileResponse(os.path.join(BASE_DIR, "templates", "dashboard.html"))


@app.get("/video_feed")
def video_feed():
    def gen():
        while True:
            with _lock:
                frame = _latest_frame_jpg
                active = _processing_active
            if frame is None or not active:
                time.sleep(0.1)
                continue
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            time.sleep(0.033)
    return StreamingResponse(gen(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/api/stats")
def api_stats():
    with _lock:
        data = _latest_stats.copy()
    # Always reflect the live calib state (may differ from last frame's stats
    # if the toggle was changed between frames or before any video was started)
    data["calib_mode"]     = _calib_mode_enabled
    data["calib_status"]   = _calib_status
    data["density_weight"] = round(_active_density_w * 100)
    data["motion_weight"]  = round(_active_motion_w  * 100)
    return JSONResponse(data)


@app.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    # Core weights
    density_bias:      float = Form(0.70),
    pressure_enabled:  str   = Form("true"),
    auto_calib:        str   = Form("false"),
    # Visuals
    overlay_alpha:     float = Form(0.20),
    grid_size:         str   = Form("standard"),
    # Sensitivity
    thresh_critical:   int   = Form(8),
    high_score_thr:    float = Form(0.50),
    crit_score_thr:    float = Form(0.75),
    hysteresis:        int   = Form(8),
):
    global _next_video_path, _session_config, _calib_mode_enabled

    # Save the file
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(save_path, "wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)

    # Store session config BEFORE signalling the processing thread
    with _lock:
        _session_config = {
            "density_bias":      max(0.0, min(1.0, density_bias)),
            "pressure_enabled":  pressure_enabled.lower() not in ("false", "0", "no"),
            "auto_calib":        auto_calib.lower() not in ("false", "0", "no"),
            "overlay_alpha":     max(0.0, min(1.0, overlay_alpha)),
            "grid_size":         grid_size if grid_size in ("coarse", "standard", "detailed") else "standard",
            "thresh_critical":   max(1, thresh_critical),
            "pressure_weight":   0.25,   # fixed 25% slice when pressure is enabled
            "high_score_thr":    max(0.0, min(1.0, high_score_thr)),
            "crit_score_thr":    max(0.0, min(1.0, crit_score_thr)),
            "hysteresis":        max(0, hysteresis),
        }
        _next_video_path = save_path

    _new_video_event.set()
    print(f"[v3] Uploaded: {file.filename} | config: {_session_config}")
    return JSONResponse({"status": "ok", "filename": file.filename})


@app.post("/cancel")
def cancel_analysis():
    """
    Stops the background processing thread mid-stream.
    Returns a session summary (peak risk, duration) for the frontend modal.
    """
    elapsed = time.time() - _session_start_time if _session_start_time else 0
    summary = {
        "peak_risk":      round(_session_peak_risk, 1),
        "peak_status":    _session_peak_status,
        "duration_s":     round(elapsed),
        "frames":         _session_frames,
        "density_weight": round(_active_density_w * 100),
        "motion_weight":  round(_active_motion_w  * 100),
        "calib_mode":     _calib_mode_enabled,
    }
    _cancel_event.set()
    print(f"[v3] Cancel requested.")
    return JSONResponse(summary)


@app.post("/api/calibration-mode")
async def set_calibration_mode(request: dict = None):
    """
    Toggle auto-calibration mode on or off.
    Body: { "enabled": true | false }
    """
    from fastapi import Request
    global _calib_mode_enabled
    return JSONResponse({"status": "ok", "calib_mode": _calib_mode_enabled})


@app.post("/api/calibration-mode/on")
def calib_mode_on():
    global _calib_mode_enabled
    _calib_mode_enabled = True
    print("[calib] Auto-calibration mode ENABLED")
    return JSONResponse({"status": "ok", "calib_mode": True})


@app.post("/api/calibration-mode/off")
def calib_mode_off():
    global _calib_mode_enabled, _calib_status, _active_density_w, _active_motion_w
    _calib_mode_enabled = False
    _calib_status       = "off"
    _active_density_w   = DENSITY_WEIGHT
    _active_motion_w    = MOTION_WEIGHT
    print("[calib] Auto-calibration mode DISABLED — weights reset to 70/30")
    return JSONResponse({"status": "ok", "calib_mode": False})


@app.post("/api/flow-overlay/on")
def flow_overlay_on():
    global _show_flow_overlay
    _show_flow_overlay = True
    print("[flow] Optical flow overlay ENABLED")
    return JSONResponse({"status": "ok", "flow_overlay": True})


@app.post("/api/flow-overlay/off")
def flow_overlay_off():
    global _show_flow_overlay
    _show_flow_overlay = False
    print("[flow] Optical flow overlay DISABLED")
    return JSONResponse({"status": "ok", "flow_overlay": False})


@app.get("/api/session-config")
def get_session_config():
    """
    Returns the _session_config used for the last (or current) analysis.
    The landing page uses this to restore all sliders/toggles after Go Home.
    """
    with _lock:
        cfg = _session_config.copy()
    return JSONResponse(cfg)


# =============================================================================
# AI Parameter Suggestion (Mode B — Gemini)
# =============================================================================

_AI_SYSTEM_PROMPT = """
You are an expert crowd dynamics engineer specializing in stampede risk analysis.
You use Keith Still's mathematical crowd pressure model: P = ρ × σᵥ (local density × directional velocity chaos).

The user will describe the deployment scenario in plain English. They may also provide an image of the physical space.
Your job: select optimal configuration parameters for a real-time stampede risk monitoring system.

If an image is provided, carefully analyze it for:
- Narrow corridors, chokepoints, or funnels (raise density sensitivity, lower thresholds)
- Open areas or plazas (use coarser grid, slightly higher thresholds)
- Elevated camera positions vs. ground level (adjust thresh_critical for apparent density)
- Crowd ingress/egress points (bottleneck awareness)
Mention your visual observations briefly in the explanation field.

IMPORTANT: Respond with ONLY valid raw JSON. No markdown fences, no explanations outside the JSON object.
Be conservative — it is far better to warn early than to miss a crush event.

Return exactly this JSON schema:
{
  "density_bias": <float 0.10–0.90>,
  "pressure_enabled": <true|false>,
  "grid_size": <"coarse"|"standard"|"detailed">,
  "thresh_critical": <int 2–30>,
  "high_score_thr": <float 0.20–0.80>,
  "crit_score_thr": <float 0.40–0.95>,
  "overlay_alpha": <float 0.05–0.60>,
  "hysteresis": <int 0–60>,
  "explanation": <one sentence why you chose these settings, mentioning visual observations if image provided>
}

Guidelines:
- Narrow corridors / bottlenecks: density_bias 0.75+, thresh_critical 6–8, low alert thresholds.
- Open festivals / pilgrimages: density_bias 0.55–0.65, pressure ON, coarse grid.
- Transit (subway / train): density_bias 0.70+, pressure OFF (transit bumping → false positives).
- Drone / top-down cameras: raise thresh_critical by 30–50% (cells cover more real-world area).
- Concerts / mosh pits: pressure crucial, density_bias 0.45–0.55.
- Always ensure crit_score_thr > high_score_thr by at least 0.15.
"""


@app.post("/api/ai-configure")
async def ai_configure(request: Request):
    """
    Mode B: AI Parameter Suggestion with optional image context.
    Body: { "prompt": "<plain English venue description>", "image_base64": "<optional data URL or raw b64>" }
    Returns: JSON with all slider/threshold values + a one-sentence explanation.
    """
    if not _GEMINI_AVAILABLE:
        return JSONResponse({"error": "google-generativeai not installed. Run: pip install google-generativeai"}, status_code=503)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return JSONResponse({"error": "GEMINI_API_KEY environment variable not set."}, status_code=503)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    user_prompt = body.get("prompt", "").strip()
    if not user_prompt:
        return JSONResponse({"error": "Empty prompt"}, status_code=400)

    image_b64 = body.get("image_base64", "").strip()

    # ── Build Gemini content list ────────────────────────────────────────────
    full_text = _AI_SYSTEM_PROMPT.strip() + "\n\nUser scenario: " + user_prompt
    contents = [full_text]

    if image_b64:
        try:
            import base64 as _b64, io as _io
            from PIL import Image as _PILImage

            # Strip data-URL prefix if present (e.g. "data:image/jpeg;base64,")
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            img_bytes = _b64.b64decode(image_b64)
            pil_img   = _PILImage.open(_io.BytesIO(img_bytes)).convert("RGB")

            # Gemini's new SDK accepts PIL Images directly in the contents list
            contents.append(pil_img)
            print(f"[ai-configure] Image received: {pil_img.size[0]}x{pil_img.size[1]}px, sending to Gemini vision.")
        except ImportError:
            print("[ai-configure] Pillow not installed — image ignored. Run: pip install pillow")
        except Exception as e:
            print(f"[ai-configure] Could not decode image — skipping: {e}")

    try:
        client = genai.Client(api_key=api_key)

        # Using the standard reliable model for the new SDK
        # contents is a list: [text_prompt] or [text_prompt, pil_image] for vision
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
        )
        
        raw = response.text.strip()

        # Strip markdown fences if LLM wraps output in ```json ... ```
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json").strip()

        config = json.loads(raw)

        # Validate required keys are present
        required = [
            "density_bias", "pressure_enabled", "grid_size", "thresh_critical",
            "high_score_thr", "crit_score_thr", "overlay_alpha", "hysteresis", "explanation"
        ]
        missing = [k for k in required if k not in config]
        if missing:
            return JSONResponse({"error": f"LLM response missing keys: {missing}"}, status_code=500)

        # Clamp all numeric values to safe ranges
        config["density_bias"]    = max(0.10, min(0.90, float(config["density_bias"])))
        config["high_score_thr"] = max(0.20, min(0.80, float(config["high_score_thr"])))
        config["crit_score_thr"] = max(config["high_score_thr"] + 0.10, min(0.95, float(config["crit_score_thr"])))
        config["overlay_alpha"]  = max(0.05, min(0.60, float(config["overlay_alpha"])))
        config["thresh_critical"] = max(2, min(30, int(config["thresh_critical"])))
        config["hysteresis"]      = max(0, min(60, int(config["hysteresis"])))
        if config["grid_size"] not in ("coarse", "standard", "detailed"):
            config["grid_size"] = "standard"

        print(f"[AI] Configured for: {user_prompt[:60]}... → {config}")
        return JSONResponse(config)

    except json.JSONDecodeError as e:
        return JSONResponse({"error": f"LLM returned invalid JSON: {e}"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


if __name__ == "__main__":
    t = threading.Thread(target=processing_thread, daemon=True)
    t.start()
    print("[v3] Dashboard → http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="error")
