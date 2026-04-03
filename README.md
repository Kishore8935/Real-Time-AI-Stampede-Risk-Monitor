<div align="center">
  <!-- Place your logo here if you have one -->
  <!-- <img src="docs/assets/logo.png" alt="Logo" width="120"> -->
  
  # 🚦 Real-Time AI Stampede Risk Monitor 🚦
  
  **A proactive, physics-informed crowd monitoring system that prevents stampedes before they start.**
  
  [YOLOv11 Object Detection] • [Dense Optical Flow] • [Crowd Pressure Calculus]

</div>

---

## 📖 Overview

Mass gatherings—whether religious festivals, concerts, or major transit hubs—frequently experience catastrophic crowd crushes. Traditional surveillance systems are entirely **reactive**, only showing operators *after* a stampede event has occurred. 

The **Real-Time AI Stampede Risk Monitor** is a **proactive** computer vision system designed to predict and alert authorities to physical crush conditions *before* they escalate into fatal stampedes.

Instead of relying on simple head-counting (which fails in truly dense crowds), this system implements **Keith Still's Crowd Dynamics Equations**, specifically monitoring **Crowd Pressure ($P = \rho \times \sigma_v$)**. It merges deep-learning object detection with physics-based dense optical flow to analyze not just *how many* people are present, but *how chaotic* their movement is.

---

## ✨ Key Features

*   **🧠 High-Density Head Tracking (YOLOv11):** Accurately tracks individuals even under heavy occlusion dynamically mapping the density ($\rho$) across localized cell grids.
*   **🌊 Dense Optical Flow (Farneback):** Calculates pixel-by-pixel motion fields to determine both the average speed and, crucially, the **Directional Variance** ($\sigma_v$) or "Chaos" of the crowd's movement.
*   **🗜️ Physical Crowd Pressure Signal:** Fuses density and motion chaos into a single, scientifically validated "Crush Risk" metric that identifies dangerous bottlenecks where pressure can build fatally.
*   **📊 Live Heatmap Dashboard:** A high-performance web dashboard displaying real-time cell-by-cell risk overlays (Green/Yellow/Red) alongside live timelines of density, motion, and crowd pressure.
*   **⚙️ Agentic AI Customization (Upcoming):** A natural-language interface allowing non-technical security operators to configure complex physics thresholds simply by describing the venue (e.g., "I am monitoring a dense subway platform").

---

## 📸 System Previews

*(Replace the placeholder image paths below with actual screenshots of your system running)*

### 1. The Dynamic Configuration Panel
*(Screenshot Placeholder: Show the landing page with the Dual-Column layout, featuring the sliders for Density Bias, Crowd Pressure Toggles, and Advanced Thresholds).*
> **`[PLACEHOLDER: Insert image of landing.html configuration UI here. E.g., docs/assets/landing_ui.png]`**

### 2. Live Monitor & Cell Heatmap
*(Screenshot Placeholder: Show the main dashboard analyzing a crowd video. The video feed should have the Green/Orange/Red grid overlays, and the right-side charts should be visible).*
> **`[PLACEHOLDER: Insert image of dashboard.html analyzing a crowd here. E.g., docs/assets/dashboard_live.png]`**

### 3. Crowd Pressure Identification (True Positive)
*(Screenshot Placeholder: Show a side-by-side or specific frame where density is high, but people are moving chaotically in different directions, triggering a RED "CRITICAL" pressure alert).*
> **`[PLACEHOLDER: Insert image showing a critical pressure spike here. E.g., docs/assets/pressure_spike.png]`**

---

## 🧮 How it Works (The Math)

The core innovation of this project is the **Risk Fusion Engine**, which calculates risk not globally, but locally across a dynamically adjustable grid overlay.

For every grid cell in the camera frame, the system calculates:
1.  **Density Factor ($\delta$):** Bounding boxes from YOLOv11 are mapped to cells. Density is calculated and normalized against a critical threshold (e.g., 8 people per $5m^2$).
2.  **Velocity Factor ($v$):** Farneback Dense Optical Flow calculates the average pixel movement per frame.
3.  **Chaos Factor ($\sigma$):** The directional standard deviation of the optical flow. A unified flow (everyone walking the same way) yields low chaos. Vectors pointing into each other yield high chaos.
4.  **Crowd Pressure ($P$):** A derived product: `Density * Chaos`.

The final **Cell Risk Score** is a weighted mathematical fusion configurable by the operator:
`Risk = (w_d * Density) + (w_m * Motion) + (w_p * Pressure)`

---

## 🛠️ Technology Stack

*   **Computer Vision & AI:**
    *   [Ultralytics YOLOv11](https://github.com/ultralytics/ultralytics) (Nano model for real-time edge performance)
    *   [OpenCV (cv2)](https://opencv.org/) (Farneback Dense Optical Flow, Image Processing)
    *   `numpy` (Matrix operations, Grid Calculus)
*   **Backend & Streaming:**
    *   [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous local web server)
    *   `uvicorn` (ASGI Server)
    *   Python `threading` (Decoupling UI rendering from heavy CV inference loops)
*   **Frontend Interface:**
    *   HTML5 / Vanilla CSS3 / JavaScript (Zero-dependency, high-refresh dashboard)
    *   Multipart Form Data (for robust session configurations)

---

## 🚀 Installation & Usage

### Prerequisites
You will need **Python 3.10+** installed on your machine.

### 1. Clone the Repository
```bash
git clone https://github.com/YourUsername/Real-Time-AI-Stampede-Risk-Monitor.git
cd Real-Time-AI-Stampede-Risk-Monitor
```

### 2. Set up the Virtual Environment
*(It is highly recommended to use a virtual environment to manage dependencies).*
```bash
# On Windows
python -m venv venv
.\venv\Scripts\activate

# On Mac/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
```bash
python v3_web/app.py
```
*The terminal will indicate that the server is running. A YOLO weights file (`yolo11n.pt`) will automatically download on the first run if it is not present.*

### 5. Access the Dashboard
Open your web browser and navigate to:
**[http://localhost:8000](http://localhost:8000)**

From there, you can drag and drop a crowd video, adjust the physics constants in the configuration panel to match your venue, and click **Analyse Video** to launch the live dashboard.

---

## 🎓 Academic / Capstone Details

This project was developed as a Capstone Engineering Project bridging Computer Vision and Crowd Physics. The mathematical approaches utilized inside the `v2/motion/risk_fusion.py` module are heavily adapted from Dr. Keith Still's research on Introduction to Crowd Science.

> *"Mass fatalities at events are rarely the result of panic, but rather the result of Crowd Pressure and flow dynamics where people simply have nowhere to go."*

---
*(Created by Kishore & Team)*
