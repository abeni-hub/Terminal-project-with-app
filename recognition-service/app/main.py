import sys
import os
import cv2
import time
import logging
from typing import Dict, Optional, List

# Ensure parent directory (recognition-service) is in sys.path when running python app/main.py
if '__file__' in globals():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
else:
    parent_dir = os.getcwd()

if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from fastapi import FastAPI, HTTPException, Response, BackgroundTasks, File, UploadFile, Body
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import numpy as np

from app.camera.factory import CameraProviderFactory
from app.services.nestjs_client import NestJSClient
from app.services.recognition_runner import RecognitionWorker
from app.services.heartbeat_runner import HeartbeatRunner
from app.detection.plate_detector import PlateDetector
from app.ocr.recognizer import OCRRecognizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RecognitionService")

app = FastAPI(
    title="Addis Ababa Transport Office - High-FPS ANPR Recognition Service",
    version="2.0.0",
    description="Production High-FPS ANPR microservice with Plate Eligibility & Unknown Vehicle Categorization.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global worker registry
workers: Dict[str, RecognitionWorker] = {}
nestjs_client = NestJSClient()
heartbeat_runner = HeartbeatRunner(workers, nestjs_client)
single_plate_detector = PlateDetector()
single_ocr_recognizer = OCRRecognizer()

class StartCameraRequest(BaseModel):
    cameraId: str
    terminalId: str
    cameraType: str = "ENTRY"
    sourceType: str = "USB"
    sourceAddress: str = "0"

@app.post("/scan-image")
async def scan_image(
    file: Optional[UploadFile] = File(None),
    payload: Optional[Dict[str, Any]] = Body(None),
):
    """
    Direct Image OCR Scanner for Mobile Apps & Backend Service.
    Accepts:
    - Multipart image file (field name: 'file' or 'image')
    - OR JSON body with base64 image: {"image": "..."} or {"imageBase64": "..."}
    """
    img_bytes = None
    if file:
        img_bytes = await file.read()
    elif payload and isinstance(payload, dict):
        b64_str = payload.get("image") or payload.get("imageBase64")
        if b64_str:
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            try:
                img_bytes = base64.b64decode(b64_str)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid base64 string: {e}")

    if not img_bytes:
        raise HTTPException(status_code=400, detail="No image file or base64 data provided.")

    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Failed to decode image.")

    # 1. Detect plate crop
    plate_region = single_plate_detector.detect_plate_region(frame)
    if plate_region is not None:
        plate_crop, _ = plate_region
    else:
        plate_crop = frame

    # 2. Run OCR
    raw_text, norm_text, conf = single_ocr_recognizer.recognize(plate_crop)

    # 3. Second pass on full image if crop was unreadable
    if not norm_text and plate_region is not None:
        raw_text, norm_text, conf = single_ocr_recognizer.recognize(frame)

    return {
        "success": bool(norm_text),
        "plateNumber": norm_text,
        "confidence": round(float(conf), 2) if conf else 0.0,
        "rawText": raw_text or norm_text,
    }

@app.on_event("startup")
def startup_event():
    logger.info("Initializing High-FPS ANPR Recognition Service...")
    heartbeat_runner.start()
    # Auto-initialize default PC camera worker (CAM-PC-01) or mock camera
    try:
        pc_provider = CameraProviderFactory.create_provider("CAM-PC-01", "USB", "0")
        worker = RecognitionWorker("CAM-PC-01", "terminal-demo", "ENTRY", pc_provider, nestjs_client)
        workers["CAM-PC-01"] = worker
        worker.start()
        logger.info("✅ High-FPS PC Camera worker auto-started on CAM-PC-01 (Device 0)")
    except Exception as e:
        logger.warning(f"PC camera 0 not available at startup ({e}). Falling back to mock camera.")
        mock_provider = CameraProviderFactory.create_provider("CAM-DEMO-01", "MOCK_SYNTHETIC", "MOCK")
        worker = RecognitionWorker("CAM-DEMO-01", "terminal-demo", "ENTRY", mock_provider, nestjs_client)
        workers["CAM-DEMO-01"] = worker
        worker.start()

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down ANPR Recognition Service...")
    heartbeat_runner.stop()
    for worker in workers.values():
        worker.stop()

@app.get("/health")
def health_check():
    active_fps = {cid: float(f"{w.current_fps:.1f}") for cid, w in workers.items()}
    return {
        "status": "UP",
        "active_workers": len(workers),
        "service": "High-FPS ANPR Recognition Service",
        "fps_performance": active_fps,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

@app.get("/unknown-plates")
def get_unknown_plates():
    """Returns all detected unregistered / unknown car plates across active cameras."""
    all_unknown = []
    for cid, worker in workers.items():
        all_unknown.extend(worker.get_unknown_plates())
    return {
        "total_unknown": len(all_unknown),
        "unknown_plates": all_unknown
    }

@app.get("/eligible-plates")
def get_eligible_plates():
    """Returns all verified eligible car plates across active cameras."""
    all_eligible = []
    for cid, worker in workers.items():
        all_eligible.extend(worker.get_eligible_plates())
    return {
        "total_eligible": len(all_eligible),
        "eligible_plates": all_eligible
    }

@app.get("/detect-pc-cameras")
def detect_pc_cameras():
    """Detects working PC webcams connected to this machine (probes indices 0..3)."""
    available = []
    for idx in range(4):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                available.append({
                    "deviceIndex": idx,
                    "name": f"PC Webcam / USB Camera (Device #{idx})",
                    "available": True
                })
            cap.release()
    if not available:
        available.append({
            "deviceIndex": 0,
            "name": "PC Camera (Default Index 0)",
            "available": False
        })
    return {"pc_cameras": available}

@app.get("/cameras")
def list_active_cameras():
    result = []
    for cid, worker in workers.items():
        status = worker.provider.get_status()
        result.append({
            "cameraId": cid,
            "terminalId": worker.terminal_id,
            "cameraType": worker.camera_type,
            "is_running": worker.is_running,
            "current_fps": float(f"{worker.current_fps:.1f}"),
            "unknown_count": len(worker.unknown_plates),
            "eligible_count": len(worker.eligible_plates),
            "is_connected": status.get("is_connected", False),
            "sourceAddress": status.get("source_address", ""),
            "last_recognized_plate": worker.last_recognized_plate,
        })
    return result

@app.post("/cameras/start")
def start_camera_worker(req: StartCameraRequest):
    if req.cameraId in workers:
        workers[req.cameraId].stop()

    try:
        provider = CameraProviderFactory.create_provider(req.cameraId, req.sourceType, req.sourceAddress)
        worker = RecognitionWorker(req.cameraId, req.terminalId, req.cameraType, provider, nestjs_client)
        workers[req.cameraId] = worker
        worker.start()
        return {"success": True, "message": f"Camera {req.cameraId} started successfully in {req.sourceType} mode."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start camera worker: {e}")

@app.post("/cameras/stop/{camera_id}")
def stop_camera_worker(camera_id: str):
    if camera_id not in workers:
        raise HTTPException(status_code=404, detail="Camera worker not found.")
    workers[camera_id].stop()
    del workers[camera_id]
    return {"success": True, "message": f"Camera {camera_id} stopped."}

def generate_mjpeg_stream(camera_id: str):
    worker = workers.get(camera_id)
    while True:
        if not worker or worker.latest_frame is None:
            time.sleep(0.02)
            continue
        frame = worker.latest_frame
        ret, jpeg = cv2.imencode('.jpg', frame)
        if not ret:
            time.sleep(0.02)
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        time.sleep(0.03)

@app.get("/preview/{camera_id}")
def get_camera_preview(camera_id: str):
    if camera_id not in workers:
        raise HTTPException(status_code=404, detail="Camera worker not running.")
    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

if __name__ == "__main__":
    import uvicorn
    import signal

    def handle_shutdown(sig, frame):
        logger.info("🛑 Received termination signal (Ctrl+C). Shutting down all workers...")
        shutdown_event()
        os._exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 KeyboardInterrupt caught. Cleaning up...")
        shutdown_event()
        os._exit(0)
