# Crowd Risk Monitor: AI Agent Handover Context

Hello! If you are an AI assistant reading this file, the user has transitioned this project to a new editor/environment and needs you to take over. This document contains all the context required to understand the current architecture, mathematical models, project state, and immediate next steps.

---

## 1. Project Overview
**Real-Time AI-Based Stampede Risk Monitor**
This is a capstone project designed to predict and detect crowd crushes and stampedes in real-time using computer vision. Unlike basic "head counter" systems, this project models physical crowd dynamics (specifically compressive asphyxia risks) by combining object detection and optical flow.

**Tech Stack:**
*   **Backend:** Python 3, FastAPI, OpenCV (`cv2`), NumPy, Ultralytics (YOLO11n).
*   **Frontend:** HTML5, CSS3 (Vanilla, CSS variables, glassmorphism), JS (Vanilla, Chart.js for live graphing).
*   **Architecture:** The server runs a continuous background thread utilizing a webcam or uploaded video. The AI loop runs asynchronously and caches results safely. The frontend polls `/api/stats` every 500ms and reads `/video_feed` (MJPEG stream) for live rendering.

---

## 2. The Core Mathematical Model (Risk Fusion)
The system calculates a "Risk Score" (0–100) per grid cell and for the overall scene using **THREE distinct signals**.

1.  **Density (`v2/density/` - YOLOv11):** 
    Detects `person` class bodies. Normalizes the count against a critical threshold (e.g., 8 people per cell = 1.0 density).
2.  **Motion & Chaos (`v2/motion/flow.py` - Farneback Optical Flow):**
    Calculates optical flow. Extracts the *magnitude* of movement (speed) and the *variance in direction* (directional chaos/turbulence).
3.  **Crowd Pressure (`v2/motion/risk_fusion.py` - Keith Still's Formula):**
    `Crowd Pressure (P) = Density (ρ) × Velocity Standard Deviation (σᵥ)`
    This is the most novel capstone feature. It distinguishes between a dense but safe queue (high ρ, low σᵥ → Low P) and a dangerous mosh pit/stampede (high ρ, high σᵥ → High P).

**The Fusion Formula:**
`Risk Score = (W_density × Density) + (W_motion × Motion) + (W_pressure × Crowd_Pressure)`
*(Default Weights: 50% Density, 25% Motion, 25% Pressure)*

---

## 3. Key Files & Directory Structure
*Note: The project went through iterations (v1, v2). The current production-ready web application is housed in `v3_web/` but relies on modules from `v2/`.*

*   **`v3_web/app.py`**: The main FastAPI server. Contains the API endpoints (`/upload`, `/video_feed`, `/api/stats`, `/api/calibration-mode/*`) and the core `processing_thread` loop which orchestrates YOLO, Flow, Risk Fusion, and frame drawing.
*   **`v2/motion/risk_fusion.py`**: The mathematical heart of the system. Fuses the signals, applies density gates (ignores motion in empty cells), applies hysteresis (sticky alerts to prevent flickering), and computes the final global risk score.
*   **`v2/motion/flow.py`**: Computes Farneback Optical flow. *Crucial optimization:* It downscales frames before computing flow to prevent RAM exhaustion/OOM crashes.
*   **`v3_web/templates/landing.html`**: The UI where users drop a video. Currently acts as a gateway to start analysis.
*   **`v3_web/templates/dashboard.html`**: The main monitoring UI. Features a live video feed with grid overlays, a live charting graph of the risk score, cell breakdown statistics, an Auto-Calibration toggle, and an animated SVG Crowd Pressure gauge.

---

## 4. Current Progress & Recent Wins
We just successfully implemented the **"Crowd Pressure"** metric. This solved a major reviewer criticism regarding "false positives" (the system previously panicked at dense, calm crowds). 
We also successfully stabilized the server from previous OpenCV Out-Of-Memory (OOM) errors by strictly managing array sizes and downscaling optical flow.

---

## 5. Immediate Next Steps (Pending Tasks)
The user wants to implement **Phase 5: Pre-Analysis Customization UI**.

Currently, variables like `DENSITY_WEIGHT`, `THRESH_CRITICAL` (max people per cell limit), and `OVERLAY_ALPHA` are hardcoded at the top of `v3_web/app.py`. 
The reviewer wants the system to be highly customizable for *any* venue.

**Your immediate goal:**
1.  **Redesign `landing.html`**: Add a comprehensive UI configuration menu. It should have sliders for Density vs. Motion bias, a toggle to enable/disable Crowd Pressure, a slider for Overlay Transparency, and advanced settings for sensitivity thresholds.
2.  **Refactor `app.py` & `RiskFusion`**: Update the `POST /upload` endpoint to read these parameters dynamically via a `FormData` submission, rather than relying on global constants. Initialize the `RiskFusion` class with these user-defined parameters for that specific session.

*You can refer to the full proposed plan for this in the user's conversation history if needed, but the objective is: Dynamic Session Configuration from the Landing Page.*
