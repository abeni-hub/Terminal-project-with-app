import cv2
import numpy as np
import time
import random
from typing import Tuple, Optional
from app.camera.base import BaseCameraProvider

class MockSyntheticCameraProvider(BaseCameraProvider):
    """
    Mock Synthetic Camera Provider.
    Generates synthetic frames with rendered Ethiopian plates (e.g., AA12345, 3AA98765, ET45678)
    for zero-hardware end-to-end testing and demo environments.
    """

    MOCK_PLATES = [
        "AA12345", "AA67890", "3AA11223", "3AA44556",
        "ET99887", "AA55555", "3AA88888", "UNKNOWN999",
    ]

    def __init__(self, camera_id: str, source_address: str):
        super().__init__(camera_id, source_address)
        self.last_frame_time = 0
        self.plate_index = 0

    def connect(self) -> bool:
        self.is_connected = True
        return True

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        # Simulate ~10 FPS frame stream
        time.sleep(0.1)

        # Create synthetic dark background frame (720p)
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        frame[:] = (30, 30, 35)

        # Draw vehicle hood / bumper outline
        cv2.rectangle(frame, (200, 300), (1080, 700), (60, 60, 70), -1)
        cv2.rectangle(frame, (200, 300), (1080, 700), (100, 100, 110), 3)

        # Pick plate text periodically (cycles every ~8 seconds)
        current_time = time.time()
        if current_time - self.last_frame_time > 8.0:
            self.last_frame_time = current_time
            self.plate_index = (self.plate_index + 1) % len(self.MOCK_PLATES)

        plate_text = self.MOCK_PLATES[self.plate_index]

        # Draw license plate box (White background with black border)
        cv2.rectangle(frame, (440, 480), (840, 580), (240, 240, 240), -1)
        cv2.rectangle(frame, (440, 480), (840, 580), (0, 0, 0), 4)

        # Draw blue band on left side of plate (Ethiopian / Transport style)
        cv2.rectangle(frame, (440, 480), (490, 580), (180, 50, 0), -1)
        cv2.putText(frame, "ETH", (445, 540), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

        # Render plate text inside box
        cv2.putText(frame, plate_text, (510, 545), cv2.FONT_HERSHEY_DUPLEX, 1.4, (10, 10, 10), 3)

        # Add timestamp & camera name overlay
        cv2.putText(frame, f"CAMERA: {self.camera_id} [MOCK SYNTHETIC MODE]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(frame, time.strftime("%Y-%m-%d %H:%M:%S"), (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        self.is_connected = True
        return True, frame

    def release(self) -> None:
        self.is_connected = False
