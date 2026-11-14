from abc import ABC, abstractmethod
from typing import Tuple, Optional, Any
import numpy as np

class BaseCameraProvider(ABC):
    """Abstract base provider interface for all camera types."""

    def __init__(self, camera_id: str, source_address: str):
        self.camera_id = camera_id
        self.source_address = source_address
        self.is_connected = False

    @abstractmethod
    def connect(self) -> bool:
        """Establishes connection to camera stream."""
        pass

    @abstractmethod
    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Reads next frame from stream. Returns (success_bool, frame_array)."""
        pass

    @abstractmethod
    def release(self) -> None:
        """Releases camera stream resources."""
        pass

    def get_status(self) -> dict:
        return {
            "camera_id": self.camera_id,
            "source_address": self.source_address,
            "is_connected": self.is_connected,
        }
