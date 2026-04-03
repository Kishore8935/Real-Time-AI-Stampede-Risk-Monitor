"""
=============================================================================
optical_flow_demo.py  —  Standalone Farneback Optical Flow Demonstration
=============================================================================

HOW OPTICAL FLOW WORKS (for your explanation):
    1. Take two consecutive video frames (frame_A and frame_B).
    2. For EVERY pixel in the image, calculate:
         - In which direction did this pixel move?   → stored as an ANGLE
         - How far did it move (speed)?              → stored as MAGNITUDE
    3. This gives us a "flow field" — a 2D grid of (angle, magnitude) pairs.
    4. We use this flow field to detect:
         - HIGH magnitude regions  → crowd is moving fast (panic/rush)
         - CHAOTIC angle patterns  → crowd is moving randomly (crush/bottleneck)

VISUALIZATION MODES produced by this script:
    [A] Original Frame         — what the camera sees (with motion arrows)
    [B] HSV Color Flow Map     — Direction = color, Speed = brightness
                                 Blue=left, Green=up, Red=right, Yellow=down
    [C] Grid Magnitude Heatmap — Divide into cells, colour each by avg speed

USAGE:
    python optical_flow_demo.py --video path/to/your_video.mp4
=============================================================================
"""

import cv2
import numpy as np
import argparse
import os
import sys

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
INPUT_VIDEO   = "crowd3.mp4"           # Default video — override with --video
OUTPUT_VIDEO  = "optical_flow_demo_output_2.mp4"
GRID_ROWS     = 8                     # Grid rows
GRID_COLS     = 12                    # Grid columns
DOWNSCALE_MAX = 480                   # Max dimension for flow computation
ARROW_STEP    = 20                    # Draw motion arrows every N pixels
HIGH_MOTION   = 3.0                   # px/frame — elevated threshold
CRIT_MOTION   = 6.0                   # px/frame — critical threshold
DISPLAY_W     = 1920                  # Display window width in pixels

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def get_scale_factor(h, w, max_dim=DOWNSCALE_MAX):
    longer = max(h, w)
    return min(1.0, max_dim / longer)


def compute_farneback_flow(gray_prev, gray_curr, scale):
    """
    Compute dense optical flow using Gunnar Farneback's algorithm.
    Downscale first for speed/memory, then rescale vectors back up.
    """
    if scale < 1.0:
        small_h = int(gray_prev.shape[0] * scale)
        small_w = int(gray_prev.shape[1] * scale)
        g_prev = cv2.resize(gray_prev, (small_w, small_h))
        g_curr = cv2.resize(gray_curr, (small_w, small_h))
    else:
        g_prev, g_curr = gray_prev, gray_curr

    flow = cv2.calcOpticalFlowFarneback(
        g_prev, g_curr, None,
        pyr_scale=0.5, levels=3, winsize=15,
        iterations=3, poly_n=5, poly_sigma=1.2, flags=0
    )

    if scale < 1.0:
        flow = cv2.resize(flow, (gray_prev.shape[1], gray_prev.shape[0]))
        flow /= scale  # restore native-pixel magnitudes

    return flow


def flow_to_hsv(flow, frame_h, frame_w):
    """
    Classic HSV visualization:
      HUE  → direction of motion
      VALUE → magnitude (brighter = faster)
    Same colour region = orderly movement.  Chaotic mix = potential crush.
    """
    mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    hsv = np.zeros((frame_h, frame_w, 3), dtype=np.uint8)
    hsv[..., 0] = ang * 180 / np.pi / 2
    hsv[..., 1] = 255
    hsv[..., 2] = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def flow_to_grid_heatmap(flow, frame_h, frame_w, rows, cols):
    """
    Divide frame into grid, compute average magnitude per cell — exactly
    what our main system does for risk scoring.
    """
    mag = np.sqrt(flow[..., 0]**2 + flow[..., 1]**2)
    cell_h = frame_h // rows
    cell_w = frame_w // cols
    grid_mag = np.zeros((rows, cols), dtype=np.float32)
    heatmap  = np.zeros((frame_h, frame_w, 3), dtype=np.uint8)

    for r in range(rows):
        for c in range(cols):
            y1, y2 = r * cell_h, (r + 1) * cell_h
            x1, x2 = c * cell_w, (c + 1) * cell_w
            cell_mag = float(np.mean(mag[y1:y2, x1:x2]))
            grid_mag[r, c] = cell_mag

            if cell_mag >= CRIT_MOTION:
                color = (0, 0, 220)
            elif cell_mag >= HIGH_MOTION:
                color = (0, 140, 255)
            elif cell_mag > 0.3:
                color = (30, 180, 30)
            else:
                color = (20, 20, 20)

            cv2.rectangle(heatmap, (x1, y1), (x2 - 1, y2 - 1), color, -1)
            cv2.putText(heatmap, f"{cell_mag:.1f}",
                        (x1 + 4, y1 + cell_h // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35,
                        (255, 255, 255), 1, cv2.LINE_AA)

    return heatmap, grid_mag


def draw_arrows(frame, flow, step=ARROW_STEP):
    out = frame.copy()
    h, w = frame.shape[:2]
    for y in range(step, h - step, step):
        for x in range(step, w - step, step):
            fx, fy = flow[y, x]
            mag = np.sqrt(fx**2 + fy**2)
            if mag < 0.5:
                continue
            scale = min(mag * 2, 20)
            ex = int(x + fx / mag * scale)
            ey = int(y + fy / mag * scale)
            color = (0, 0, 220) if mag >= CRIT_MOTION else \
                    (0, 200, 255) if mag >= HIGH_MOTION else (100, 255, 100)
            cv2.arrowedLine(out, (x, y), (ex, ey), color, 1, tipLength=0.4)
    return out


def add_legend(frame, title=""):
    bar = frame.copy()
    cv2.rectangle(bar, (0, 0), (frame.shape[1], 28), (0, 0, 0), -1)
    cv2.addWeighted(bar, 0.65, frame, 0.35, 0, frame)
    cv2.putText(frame, title, (6, 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1, cv2.LINE_AA)
    return frame


def build_legend_strip(w):
    strip = np.zeros((32, w, 3), dtype=np.uint8)
    items = [
        ((30, 180, 30),  "Normal motion"),
        ((0, 140, 255),  f"Elevated (>{HIGH_MOTION}px/frame)"),
        ((0, 0, 220),    f"Critical (>{CRIT_MOTION}px/frame)"),
    ]
    x = 8
    for color, label in items:
        cv2.rectangle(strip, (x, 8), (x + 14, 24), color, -1)
        cv2.putText(strip, label, (x + 18, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (200, 200, 200), 1)
        x += 160
    return strip


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: '{video_path}'")
        sys.exit(1)

    FRAME_W  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    FRAME_H  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    FPS_IN   = cap.get(cv2.CAP_PROP_FPS) or 25
    scale    = get_scale_factor(FRAME_H, FRAME_W)

    print(f"\n{'='*60}")
    print("  Farneback Dense Optical Flow — Demo")
    print(f"{'='*60}")
    print(f"  Video   : {os.path.basename(video_path)}")
    print(f"  Size    : {FRAME_W} x {FRAME_H}  |  {FPS_IN:.1f} FPS")
    print(f"  Grid    : {GRID_ROWS} rows x {GRID_COLS} cols")
    print(f"  Flow computed at ≤{DOWNSCALE_MAX}px (rescaled back)")
    print(f"{'='*60}")
    print("  [A] Original + Arrows  [B] HSV Color Map  [C] Risk Grid")
    print("  Press Q to quit.")
    print(f"{'='*60}\n")

    # Output file (full resolution)
    canvas_w = FRAME_W * 3
    canvas_h = FRAME_H + 32
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, FPS_IN, (canvas_w, canvas_h))

    ret, prev_frame = cap.read()
    if not ret:
        print("[ERROR] Could not read first frame.")
        sys.exit(1)

    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    frame_idx = 0

    while True:
        ret, curr_frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, curr_frame = cap.read()
            if not ret:
                break

        curr_gray = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)
        frame_idx += 1

        # Compute flow
        flow = compute_farneback_flow(prev_gray, curr_gray, scale)

        # Panel A — original + arrows
        panel_a = draw_arrows(curr_frame, flow)
        add_legend(panel_a, f"[A] Original + Motion Arrows  (frame {frame_idx})")

        # Panel B — HSV color map
        panel_b = flow_to_hsv(flow, FRAME_H, FRAME_W)
        add_legend(panel_b, "[B] HSV Flow Map  (colour=direction, brightness=speed)")

        # Panel C — grid heatmap blended over frame
        heatmap, grid_mag = flow_to_grid_heatmap(flow, FRAME_H, FRAME_W, GRID_ROWS, GRID_COLS)
        panel_c = cv2.addWeighted(curr_frame, 0.4, heatmap, 0.6, 0)
        add_legend(panel_c, "[C] Risk Grid Heatmap  (our system's approach)")

        # Stats every 30 frames
        if frame_idx % 30 == 0:
            avg_mag  = float(np.mean(grid_mag))
            peak_mag = float(np.max(grid_mag))
            crit_c   = int(np.sum(grid_mag >= CRIT_MOTION))
            high_c   = int(np.sum((grid_mag >= HIGH_MOTION) & (grid_mag < CRIT_MOTION)))
            print(f"  Frame {frame_idx:5d}  |  Avg: {avg_mag:.2f}px  "
                  f"Peak: {peak_mag:.2f}px  |  {high_c} elevated  {crit_c} critical")

        # Assemble full-res canvas for file output
        top_row = np.hstack([panel_a, panel_b, panel_c])
        legend  = build_legend_strip(canvas_w)
        canvas  = np.vstack([top_row, legend])
        writer.write(canvas)

        # Scale down for display so all 3 panels fit on screen
        dw = min(canvas_w, DISPLAY_W)
        dh = int(canvas_h * dw / canvas_w)
        cv2.imshow("Optical Flow Demo — Press Q to quit", cv2.resize(canvas, (dw, dh)))

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        prev_gray = curr_gray

    cap.release()
    writer.release()
    cv2.destroyAllWindows()
    print(f"\n[Done] Output saved to: {OUTPUT_VIDEO}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Farneback Optical Flow Demo")
    parser.add_argument("--video", default=INPUT_VIDEO,
                        help=f"Path to input video (default: {INPUT_VIDEO})")
    args = parser.parse_args()

    if not os.path.isfile(args.video):
        print(f"[ERROR] Video not found: '{args.video}'")
        print(f"        Usage: python {os.path.basename(__file__)} --video path/to/video.mp4")
        sys.exit(1)

    main(args.video)
