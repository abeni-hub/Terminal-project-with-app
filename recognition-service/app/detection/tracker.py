import logging
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from app.detection.vehicle_detector import VehicleDetection, VehicleDetector

logger = logging.getLogger("VehicleTracker")

@dataclass
class TrackedVehicle:
    track_id: int
    bbox: Tuple[int, int, int, int]  # (x, y, w, h)
    confidence: float
    class_name: str
    crop: np.ndarray

class VehicleTracker:
    """
    ByteTrack persistent vehicle tracking manager.
    Assigns stable Track IDs to vehicles across frames.
    """
    def __init__(self, vehicle_detector: Optional[VehicleDetector] = None):
        self.detector = vehicle_detector or VehicleDetector()
        self.next_fallback_id = 1
        self.active_tracks: Dict[int, Tuple[int, int, int, int]] = {}

    def track(self, frame: np.ndarray) -> List[TrackedVehicle]:
        if frame is None or frame.size == 0:
            return []

        height, width = frame.shape[:2]
        tracked_results: List[TrackedVehicle] = []

        # 1. Try Ultralytics ByteTrack integration if YOLO model available
        if self.detector.yolo_available and self.detector.model is not None:
            try:
                results = self.detector.model.track(
                    frame,
                    persist=True,
                    tracker="bytetrack.yaml",
                    verbose=False,
                    conf=self.detector.model.overrides.get("conf", 0.35)
                )
                if results and len(results) > 0 and results[0].boxes is not None:
                    boxes = results[0].boxes
                    for box in boxes:
                        if box.id is not None:
                            track_id = int(box.id[0].item())
                        else:
                            track_id = self._generate_fallback_id()

                        cls_id = int(box.cls[0].item()) if box.cls is not None else 2
                        conf = float(box.conf[0].item()) if box.conf is not None else 0.8
                        xyxy = box.xyxy[0].cpu().numpy().astype(int)

                        x1, y1, x2, y2 = xyxy
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(width, x2), min(height, y2)
                        w, h = x2 - x1, y2 - y1

                        if w > 40 and h > 40:
                            crop = frame[y1:y2, x1:x2].copy()
                            class_name = self.detector.model.names.get(cls_id, "vehicle")
                            tracked_results.append(TrackedVehicle(
                                track_id=track_id,
                                bbox=(x1, y1, w, h),
                                confidence=conf,
                                class_name=class_name,
                                crop=crop
                            ))
            except Exception as e:
                logger.error(f"ByteTrack tracking error: {e}")

        # 2. Fallback if tracking didn't yield results
        if not tracked_results:
            detections = self.detector.detect(frame)
            for det in detections:
                track_id = self._match_or_create_track(det.bbox)
                tracked_results.append(TrackedVehicle(
                    track_id=track_id,
                    bbox=det.bbox,
                    confidence=det.confidence,
                    class_name=det.class_name,
                    crop=det.crop
                ))

        return tracked_results

    def _generate_fallback_id(self) -> int:
        tid = self.next_fallback_id
        self.next_fallback_id += 1
        return tid

    def _match_or_create_track(self, bbox: Tuple[int, int, int, int]) -> int:
        """Simple IoU tracker fallback when ByteTrack plugin is unavailable."""
        x, y, w, h = bbox
        best_id = None
        best_iou = 0.3

        for tid, prev_box in self.active_tracks.items():
            px, py, pw, ph = prev_box
            # Calculate IoU
            ix = max(x, px)
            iy = max(y, py)
            iw = min(x + w, px + pw) - ix
            ih = min(y + h, py + ph) - iy
            if iw > 0 and ih > 0:
                intersection = iw * ih
                union = (w * h) + (pw * ph) - intersection
                iou = intersection / union if union > 0 else 0
                if iou > best_iou:
                    best_iou = iou
                    best_id = tid

        if best_id is not None:
            self.active_tracks[best_id] = bbox
            return best_id

        new_id = self._generate_fallback_id()
        self.active_tracks[new_id] = bbox
        return new_id
