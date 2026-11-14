import cv2
import numpy as np
from typing import Tuple, Optional
from app.camera.base import BaseCameraProvider

class ONVIFCameraProvider(BaseCameraProvider):
    """ONVIF ANPR Camera Provider."""

    def __init__(self, camera_id: str, source_address: str):
        super().__init__(camera_id, source_address)
        # Formats ONVIF stream URL or uses RTSP fallback
        if not source_address.startswith("rtsp://") and not source_address.startswith("http://"):
            source_address = f"rtsp://{source_address}"
        self.stream_url = source_address
        self.cap = None

    def connect(self) -> bool:
        try:
            self.cap = cv2.VideoCapture(self.stream_url)
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
