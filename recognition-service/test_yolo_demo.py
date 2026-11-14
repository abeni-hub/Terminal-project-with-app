import sys
import os
import cv2
import numpy as np
from ultralytics import YOLO

def run_test(image_path=None, model_path=None, conf_threshold=0.25):
    print("==================================================")
    print("   🧪 YOLO License Plate & Object Detector Test   ")
    print("==================================================")

    # 1. Determine Model Weights Path
    if not model_path:
        # Check if user provided best.pt in recognition-service or root
        if os.path.exists("best.pt"):
            model_path = "best.pt"
        elif os.path.exists("yolo11n.pt"):
            model_path = "yolo11n.pt"
        else:
            model_path = "yolo11n.pt" # YOLO will download automatically if missing

    print(f"📦 Loading Model Weights: '{model_path}'")
    try:
        model = YOLO(model_path)
        print("✅ YOLO Model Loaded Successfully.")
    except Exception as e:
        print(f"❌ Failed to load model '{model_path}': {e}")
        return

    # 2. Determine Test Image Path
    if not image_path:
        if os.path.exists("car_image.jpg"):
            image_path = "car_image.jpg"
        else:
            print("📷 No image specified and 'car_image.jpg' not found. Creating test car image...")
            image_path = "car_image.jpg"
            img = np.ones((480, 640, 3), dtype=np.uint8) * 210
            # Draw car body
            cv2.rectangle(img, (80, 180), (560, 400), (60, 60, 180), -1)
            # Draw windshield
            cv2.rectangle(img, (160, 200), (480, 270), (220, 220, 220), -1)
            # Draw license plate box with text
            cv2.rectangle(img, (240, 330), (400, 375), (255, 255, 255), -1)
            cv2.rectangle(img, (240, 330), (400, 375), (0, 0, 0), 2)
            cv2.putText(img, "AA 34567", (255, 362), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
            cv2.imwrite(image_path, img)

    if not os.path.exists(image_path):
        print(f"❌ Image path '{image_path}' does not exist.")
        return

    print(f"\n🔍 Running Detection on Image: '{image_path}' (Confidence threshold: {conf_threshold})")
    
    # Load original image for visualization & cropping
    img = cv2.imread(image_path)
    if img is None:
        print(f"❌ Failed to load image '{image_path}' with OpenCV.")
        return

    annotated_img = img.copy()

    # 3. Perform YOLO Inference
    results = model(image_path, conf=conf_threshold)

    total_detections = 0
    for i, result in enumerate(results):
        boxes = result.boxes
        total_detections += len(boxes)
        print(f"\n--- Result Set #{i+1}: Found {len(boxes)} bounding box(es) ---")

        for idx, box in enumerate(boxes):
            # Extract tensor values
            xyxy = box.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = map(int, xyxy)
            conf = float(box.conf[0].cpu().item())
            cls_id = int(box.cls[0].cpu().item())
            class_name = model.names[cls_id] if hasattr(model, 'names') and cls_id in model.names else str(cls_id)

            print(f"  📌 Detection #{idx+1}:")
            print(f"     - Class       : {class_name} (ID: {cls_id})")
            print(f"     - Bounding Box: [x1={x1}, y1={y1}, x2={x2}, y2={y2}]")
            print(f"     - Confidence  : {conf:.4f} ({conf * 100:.2f}%)")

            # 4. Save cropped detection box
            crop_filename = f"crop_detection_{idx+1}.jpg"
            # Ensure boundaries are within frame
            h, w = img.shape[:2]
            crop_y1, crop_y2 = max(0, y1), min(h, y2)
            crop_x1, crop_x2 = max(0, x1), min(w, x2)
            crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
            if crop.size > 0:
                cv2.imwrite(crop_filename, crop)
                print(f"     - Cropped image saved to: '{crop_filename}'")

            # 5. Draw bounding box on annotated visualization image
            label_text = f"{class_name} {conf:.2f}"
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_img, label_text, (x1, max(y1 - 10, 20)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # 6. Save visual output image with bounding boxes drawn
    output_visual_path = "output_detected.jpg"
    cv2.imwrite(output_visual_path, annotated_img)
    print(f"\n🖼️ Visual result with drawn bounding boxes saved to: '{output_visual_path}'")

    if total_detections == 0:
        print("\nℹ️ Tip: If testing a custom plate model (`best.pt`), try passing the path explicitly:")
        print(f"    python test_yolo_demo.py {image_path} path/to/best.pt")

if __name__ == "__main__":
    # Allow command line arguments: python test_yolo_demo.py <image_path> <model_path>
    arg_image = sys.argv[1] if len(sys.argv) > 1 else None
    arg_model = sys.argv[2] if len(sys.argv) > 2 else None
    run_test(image_path=arg_image, model_path=arg_model)
