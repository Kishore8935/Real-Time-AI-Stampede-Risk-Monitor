# Comprehensive UI & Logic Enhancement Plan

## Objective
Revamp the landing page ([landing.html](file:///c:/college/capstone2/v3_web/templates/landing.html)) and backend logic ([app.py](file:///c:/college/capstone2/v3_web/app.py)) to give the user full control over the analysis parameters *before* starting a video or live feed. The goal is to make the system flexible for any venue type by exposing the underlying mathematical variables through an intuitive UI.

## 1. Parameters to Expose for Customization

Here is the full list of parameters we can expose, grouped logically:

### A. Core Weights (The "Risk Formula")
*   **Auto-Calibration Toggle:** ON/OFF. If ON, it hides/disables the manual weight sliders and tunes itself based on the first 8 seconds.
*   **Density vs. Motion Bias (Slider):** A single slider (0% to 100%). If set to 70%, Density is 70% and Motion is 30%. 
*   **Crowd Pressure Toggle:** ON/OFF. 
    *   *Logic:* If **OFF**, the system just uses Density and Motion (summing to 100% based on the bias slider). If **ON**, Crowd Pressure takes a fixed **25%** slice of the risk formula, and Density/Motion are scaled down to share the remaining **75%**. (e.g., a 70/30 bias becomes 52.5% Density, 22.5% Motion, 25% Pressure).

### B. Visuals & Rendering
*   **Overlay Transparency (Slider):** Controls how "see-through" the green/orange/red grid cells are. (Low/Medium/High or a 0-100% opacity slider).
*   **Grid Resolution (Dropdown):** Choose how granular the tracking is.
    *   Coarse (16x9 cells)
    *   Standard (32x18 cells) - *Current Default*
    *   Detailed (64x36 cells)

### C. Sensitivity & Thresholds (Advanced Options)
*   **Critical Density Limit (Number):** How many people in a single cell constitutes "maximum density"? Currently hardcoded to `8`. Small venues might want `4`, massive stadiums might want `15`.
*   **High & Critical Risk Triggers (Sliders):** At what risk score does the system turn from Green to Orange (currently 50) and Orange to Red (currently 75)?
*   **Alert Stickiness (Hysteresis):** How long does the alarm stay on after the crowd clears? Allows the user to choose between "Instant Off" or "Wait 5 seconds to be sure".

---

## 2. Frontend Changes ([landing.html](file:///c:/college/capstone2/v3_web/templates/landing.html))

We will update the landing page to feature a **"Configuration Panel"** alongside the upload box.

**UI Layout:**
1.  **Main View:** The Video Upload box.
2.  **Settings Drawer/Panel:** Below or beside the upload box, grouped into styling cards:
    *   *Card 1: Risk Weights* (Auto-Calib toggle, Density/Motion slider, Crowd pressure toggle).
    *   *Card 2: Visuals* (Transparency slider, Grid density dropdown).
    *   *Card 3: Advanced* (Hidden behind an "Advanced Settings" dropdown for power users to tweak limits).
3.  **Submission:** When the user clicks "Analyse Video", all these values are bundled into a JavaScript `FormData` object and sent to the backend.

---

## 3. Backend Changes ([app.py](file:///c:/college/capstone2/v3_web/app.py) & [risk_fusion.py](file:///c:/college/capstone2/v2/motion/risk_fusion.py))

To support dynamic parameters per-session, we must remove the hardcoded global constants at the top of [app.py](file:///c:/college/capstone2/v3_web/app.py).

*   **[MODIFY] `/upload` Endpoint:**
    *   Update this endpoint to accept `Form(...)` fields for every setting mentioned above.
    *   Store these settings in the global `_config` dictionary or pass them directly into the background processing thread.
*   **[MODIFY] [processing_thread](file:///c:/college/capstone2/v3_web/app.py#143-367) in [app.py](file:///c:/college/capstone2/v3_web/app.py):**
    *   When instantiating [RiskFusion](file:///c:/college/capstone2/v2/motion/risk_fusion.py#48-209), pass the *user-defined* parameters instead of the old global constants (e.g., `pressure_weight`, `density_weight`, `thresh_critical`).
    *   When drawing overlays (`cv2.addWeighted`), use the dynamic overlay alpha configured by the user.
*   **[MODIFY] [dashboard.html](file:///c:/college/capstone2/v3_web/templates/dashboard.html):**
    *   Make the dashboard "read-only" for these specific configuration values (or just focus on displaying the active weights and transparency), since the user locks them in on the landing page before starting.

## 4. Verification Plan
1.  Open the landing page, set Auto-Calibration to OFF, Density/Motion bias to 80/20, turn Crowd Pressure OFF, and set Transparency to "High".
2.  Upload a video.
3.  Verify the backend logs show the RiskFusion engine was initialized with `w_density=0.8`, `w_motion=0.2`, `w_pressure=0.0`.
4.  Verify the resulting dashboard video feed reflects the highly transparent grid overlay.
