"""
Backward-compatibility alias module for PlateDetector.
Delegates to app.detection.plate_detector.PlateDetector.
"""
from app.detection.plate_detector import PlateDetector

__all__ = ["PlateDetector"]
