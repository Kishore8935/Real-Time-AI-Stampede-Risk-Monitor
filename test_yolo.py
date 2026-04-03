from ultralytics import YOLO
import cv2
import time

# Load lightweight model
model = YOLO("yolov8n.pt")

cap = cv2.VideoCapture("input.mp4")


while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Resize for CPU speed
    frame = cv2.resize(frame, (640, 480))

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
    fps = 1 / (end_time - start_time)

    cv2.putText(annotated,
                f"People: {person_count}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2)

    cv2.putText(annotated,
                f"FPS: {fps:.2f}",
                (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 255),
                2)

    cv2.imshow("YOLO CPU Detection", annotated)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
