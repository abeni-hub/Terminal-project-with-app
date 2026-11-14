import os
import cv2
import logging
import numpy as np
from typing import Tuple, Optional
from app.config import settings

logger = logging.getLogger("PlateDetector")

class PlateDetector:
    """
    Dedicated YOLOv11 License Plate Detector.
    Detects plate bounding boxes inside cropped vehicle images.
    Includes OpenCV contour & multi-scale edge fallback.
    """
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.YOLO_PLATE_MODEL_PATH
        self.model = None
        self.yolo_available = False
        self._init_plate_model()

    def _init_plate_model(self):
        try:
            from ultralytics import YOLO
            if os.path.exists(self.model_path) or self.model_path.endswith(".pt"):
                logger.info(f"⏳ Loading YOLOv11 License Plate model from '{self.model_path}'...")
                self.model = YOLO(self.model_path)
                self.yolo_available = True
                logger.info("✅ YOLOv11 License Plate Detector ready.")
        except Exception as e:
            logger.info(f"ℹ️ Custom YOLO plate model not loaded ({e}). Using OpenCV multi-scale detector fallback.")
            self.yolo_available = False

    def detect_plate_region(self, vehicle_crop: np.ndarray) -> Optional[Tuple[np.ndarray, Tuple[int, int, int, int]]]:
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        height, width = vehicle_crop.shape[:2]

        # 1. Run YOLOv11 Plate Detection if model available
        if self.yolo_available and self.model is not None:
            try:
                results = self.model(vehicle_crop, verbose=False, imgsz=320, conf=settings.PLATE_CONF_THRESHOLD)
                if results and len(results) > 0 and len(results[0].boxes) > 0:
                    best_box = None
                    best_conf = 0.0
                    for box in results[0].boxes:
                        conf = float(box.conf[0].item())
                        if conf > best_conf:
                            best_conf = conf
                            best_box = box

                    if best_box is not None:
                        xyxy = best_box.xyxy[0].cpu().numpy().astype(int)
                        x1, y1, x2, y2 = xyxy
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(width, x2), min(height, y2)
                        w, h = x2 - x1, y2 - y1

                        if w > 20 and h > 10:
                            # Add 10% padding to prevent clipping edge letters/numbers
                            pad_w = int(w * 0.10)
                            pad_h = int(h * 0.10)
                            crop_x1 = max(0, x1 - pad_w)
                            crop_y1 = max(0, y1 - pad_h)
                            crop_x2 = min(width, x2 + pad_w)
                            crop_y2 = min(height, y2 + pad_h)
                            crop = vehicle_crop[crop_y1:crop_y2, crop_x1:crop_x2].copy()
                            return crop, (crop_x1, crop_y1, crop_x2 - crop_x1, crop_y2 - crop_y1)
            except Exception as e:
                logger.error(f"YOLO plate detection error: {e}")

        # 2. Fallback: OpenCV multi-scale contour & aspect ratio analysis
        gray = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2GRAY) if len(vehicle_crop.shape) == 3 else vehicle_crop
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 30, 150)

        contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:25]

        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            aspect_ratio = float(w) / h if h > 0 else 0

            # License plate aspect ratio is typically between 1.8 and 6.5
            if 1.8 <= aspect_ratio <= 6.5 and w > 40 and h > 12:
                pad_w = int(w * 0.10)
                pad_h = int(h * 0.10)
                crop_x1 = max(0, x - pad_w)
                crop_y1 = max(0, y - pad_h)
                crop_x2 = min(width, x + w + pad_w)
                crop_y2 = min(height, y + h + pad_h)
                crop = vehicle_crop[crop_y1:crop_y2, crop_x1:crop_x2].copy()
                return crop, (crop_x1, crop_y1, crop_x2 - crop_x1, crop_y2 - crop_y1)

        # 3. Ultimate Fallback: Center-bottom ROI (where plates are commonly mounted on vehicles/paper)
        cw, ch = int(width * 0.7), int(height * 0.4)
        cx, cy = (width - cw) // 2, int(height * 0.5)
        crop = vehicle_crop[cy:min(height, cy+ch), cx:min(width, cx+cw)].copy()
        return crop, (cx, cy, cw, ch)
