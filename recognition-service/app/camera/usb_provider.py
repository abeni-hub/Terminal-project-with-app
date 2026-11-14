import cv2
import numpy as np
from typing import Tuple, Optional
from app.camera.base import BaseCameraProvider

class USBCameraProvider(BaseCameraProvider):
    """OpenCV USB / PC / Laptop Camera Provider."""

    def __init__(self, camera_id: str, source_address: str):
        super().__init__(camera_id, source_address)
        try:
            self.device_index = int(source_address)
        except ValueError:
            self.device_index = 0
        self.cap = None

    def connect(self) -> bool:
        try:
            self.cap = cv2.VideoCapture(self.device_index)
            self.is_connected = self.cap.isOpened()
            return self.is_connected
        except Exception:
            self.is_connected = False
            return False

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        if not self.cap or not self.cap.isOpened():
            if not self.connect():
                return False, None
        ret, frame = self.cap.read()
        if not ret:
            self.is_connected = False
            return False, None
        self.is_connected = True
        return True, frame

    def release(self) -> None:
        if self.cap:
            self.cap.release()
            self.is_connected = False
