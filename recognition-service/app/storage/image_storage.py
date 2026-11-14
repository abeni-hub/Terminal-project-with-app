import os
import cv2
import base64
import time
import datetime
import logging
import numpy as np
from typing import Tuple, Optional
from app.config import settings

logger = logging.getLogger("ImageStorage")

class ImageStorage:
    """
    Image Storage Manager:
    Saves vehicle snapshots and plate crops to disk with structured directory organization.
    Converts images to Base64 data URIs for API payloads.
    """
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or settings.STORAGE_DIR
        os.makedirs(self.base_dir, exist_ok=True)

    def save_anpr_images(
        self,
        camera_id: str,
        track_id: int,
        vehicle_crop: Optional[np.ndarray],
        plate_crop: Optional[np.ndarray]
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """
        Saves vehicle and plate crop images to disk.
        Returns Tuple[vehicle_file_path, plate_file_path, vehicle_b64, plate_b64].
        """
        if not settings.SAVE_CAPTURED_IMAGES:
            v_b64 = self.to_base64(vehicle_crop) if vehicle_crop is not None else None
            p_b64 = self.to_base64(plate_crop) if plate_crop is not None else None
            return None, None, v_b64, p_b64

        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        target_folder = os.path.join(self.base_dir, today_str, camera_id)
        os.makedirs(target_folder, exist_ok=True)

        timestamp_ms = int(time.time() * 1000)
        vehicle_path = None
        plate_path = None

        if vehicle_crop is not None and vehicle_crop.size > 0:
            vehicle_path = os.path.join(target_folder, f"veh_track_{track_id}_{timestamp_ms}.jpg")
            cv2.imwrite(vehicle_path, vehicle_crop)

        if plate_crop is not None and plate_crop.size > 0:
            plate_path = os.path.join(target_folder, f"plate_track_{track_id}_{timestamp_ms}.jpg")
            cv2.imwrite(plate_path, plate_crop)

        v_b64 = self.to_base64(vehicle_crop)
        p_b64 = self.to_base64(plate_crop)

        return vehicle_path, plate_path, v_b64, p_b64

    @staticmethod
    def to_base64(image: Optional[np.ndarray]) -> Optional[str]:
        if image is None or image.size == 0:
            return None
        try:
            ret, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if ret:
                b64_str = base64.b64encode(buffer).decode('utf-8')
                return f"data:image/jpeg;base64,{b64_str}"
        except Exception as e:
            logger.error(f"Base64 conversion error: {e}")
        return None
