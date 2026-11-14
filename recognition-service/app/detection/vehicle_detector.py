import logging
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional
from app.config import settings

logger = logging.getLogger("VehicleDetector")

# Standard COCO vehicle class mappings
COCO_VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

@dataclass
class VehicleDetection:
    bbox: Tuple[int, int, int, int]  # (x, y, w, h)
    confidence: float
    class_name: str
    class_id: int
    crop: np.ndarray

class VehicleDetector:
    """
    YOLOv11 Vehicle Detector for cars, buses, trucks, vans, and motorcycles.
    """
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.YOLO_VEHICLE_MODEL_PATH
        self.model = None
        self.yolo_available = False
        self._init_model()

    def _init_model(self):
        try:
            from ultralytics import YOLO
            logger.info(f"⏳ Loading YOLOv11 Vehicle Detection model from '{self.model_path}'...")
            self.model = YOLO(self.model_path)
            self.yolo_available = True
            logger.info("✅ YOLOv11 Vehicle Detector ready.")
        except Exception as e:
            logger.warning(f"⚠️ Could not load YOLOv11 vehicle model ({e}). Using full-frame fallback.")
            self.yolo_available = False

    def detect(self, frame: np.ndarray) -> List[VehicleDetection]:
        if frame is None or frame.size == 0:
            return []

        height, width = frame.shape[:2]
        detections: List[VehicleDetection] = []

        if self.yolo_available and self.model is not None:
            try:
                results = self.model(
                    frame,
                    verbose=False,
                    imgsz=480,
                    conf=settings.VEHICLE_CONF_THRESHOLD,
                    classes=list(COCO_VEHICLE_CLASSES.keys())
                )
                if results and len(results) > 0:
                    boxes = results[0].boxes
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].cpu().numpy().astype(int)

                        x1, y1, x2, y2 = xyxy
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(width, x2), min(height, y2)
                        w, h = x2 - x1, y2 - y1

                        if w > 40 and h > 40:
                            crop = frame[y1:y2, x1:x2].copy()
                            class_name = COCO_VEHICLE_CLASSES.get(cls_id, "vehicle")
                            detections.append(VehicleDetection(
                                bbox=(x1, y1, w, h),
                                confidence=conf,
                                class_name=class_name,
                                class_id=cls_id,
                                crop=crop
                            ))
            except Exception as e:
                logger.error(f"YOLO vehicle detection error: {e}")

        # Fallback if no vehicle was detected or YOLO unavailable
        if not detections:
            detections.append(VehicleDetection(
                bbox=(0, 0, width, height),
                confidence=1.0,
                class_name="car",
                class_id=2,
                crop=frame.copy()
            ))

        return detections
