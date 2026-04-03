from ultralytics import YOLO
import cv2
import time

# Load YOLO model (nano for CPU)
model = YOLO("yolov8n.pt")

input_path = "crowd.mp4"
output_path = "output_processed.mp4"

cap = cv2.VideoCapture(input_path)

# Get original video FPS
fps_input = cap.get(cv2.CAP_PROP_FPS)
print("Original Video FPS:", fps_input)

# CPU-friendly resolution
new_width = 480
new_height = 360

# Output writer
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out = cv2.VideoWriter(output_path, fourcc, fps_input, (new_width, new_height))

frame_count = 0
processed_frames = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1

    # Resize for speed
    frame = cv2.resize(frame, (new_width, new_height))

    # Process every 3rd frame only
    if frame_count % 2 != 0:
        # Write original resized frame to keep video smooth
        out.write(frame)
        continue

    start_time = time.time()

    results = model(frame, verbose=False)
    boxes = results[0].boxes

    person_count = 0

    for box in boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])

        if model.names[cls] == "person" and conf > 0.4:
            person_count += 1

    annotated = results[0].plot()

    end_time = time.time()
    processing_time = end_time - start_time
    fps_processing = 1 / processing_time

    processed_frames += 1

    # Overlay info
    cv2.putText(annotated,
                f"People: {person_count}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2)

    cv2.putText(annotated,
                f"Proc FPS: {fps_processing:.2f}",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 255),
                2)

    out.write(annotated)

    print(f"Frame {frame_count} | People: {person_count} | Processing FPS: {fps_processing:.2f}")

cap.release()
out.release()

print("Total frames read:", frame_count)
print("Total frames processed:", processed_frames)
print("Processing complete. Output saved as:", output_path)


