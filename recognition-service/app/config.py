import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API & Service Configuration
    NESTJS_API_URL: str = os.getenv("NESTJS_API_URL", "http://localhost:4000/api/v1")
    DEFAULT_MIN_CONFIDENCE: float = float(os.getenv("DEFAULT_MIN_CONFIDENCE", "0.70"))
    HEARTBEAT_INTERVAL_SECONDS: int = int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "30"))

    # FPS & Performance
    FRAME_PROCESSING_FPS: int = int(os.getenv("FRAME_PROCESSING_FPS", "20"))
    FRAME_SLEEP_INTERVAL: float = float(os.getenv("FRAME_SLEEP_INTERVAL", "0.05"))

    # YOLOv11 Model Paths & Thresholds
    YOLO_VEHICLE_MODEL_PATH: str = os.getenv("YOLO_VEHICLE_MODEL_PATH", "yolo11n.pt")
    YOLO_PLATE_MODEL_PATH: str = os.getenv("YOLO_PLATE_MODEL_PATH", "yolo11n-plate.pt")
    VEHICLE_CONF_THRESHOLD: float = float(os.getenv("VEHICLE_CONF_THRESHOLD", "0.35"))
    PLATE_CONF_THRESHOLD: float = float(os.getenv("PLATE_CONF_THRESHOLD", "0.25"))

    # OCR & PaddleOCR Configuration
    OCR_MIN_CONFIDENCE: float = float(os.getenv("OCR_MIN_CONFIDENCE", "0.60"))
    PADDLE_REC_MODEL_DIR: str = os.getenv("PADDLE_REC_MODEL_DIR", "")  # Path to fine-tuned PaddleOCR model
    PADDLE_LANG: str = os.getenv("PADDLE_LANG", "en")

    # Tracking & Voting Configuration
    TRACK_BUFFER_FRAMES: int = int(os.getenv("TRACK_BUFFER_FRAMES", "30"))
    MAJORITY_VOTE_MIN_READINGS: int = int(os.getenv("MAJORITY_VOTE_MIN_READINGS", "2"))

    # Image Storage Settings
    SAVE_CAPTURED_IMAGES: bool = os.getenv("SAVE_CAPTURED_IMAGES", "True").lower() == "true"
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "./uploads/anpr_captures")
    CAPTURED_IMAGES_DIR: str = os.getenv("CAPTURED_IMAGES_DIR", "./uploads/captured_plates")

    class Config:
        env_file = ".env"

settings = Settings()
