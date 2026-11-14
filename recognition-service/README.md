# Standalone Python ALPR Recognition Service

## Overview
This is the standalone **Automatic License Plate Recognition (ALPR)** service built for the Addis Ababa Transport Office Terminal Digital Roster System.

It processes live PC camera/webcam streams, detects license plates, extracts plate numbers using **EasyOCR / Tesseract / OpenCV**, normalizes OCR text output, draws **live green bounding boxes + text banners on video**, and sends recognition events directly to the NestJS backend via HTTP API (`POST /api/v1/recognition/process`).

> **Note**: The Recognition Service does NOT directly access PostgreSQL. All business logic, eligibility validation, and database operations remain inside NestJS.

---

## 📹 PC Camera & Web Stream Quickstart

### Method 1: Dedicated PC Camera Runner (Recommended)
```bash
python run_pc_camera.py
```
This script automatically detects your plugged-in PC webcams (Device index 0, 1, 2) and launches the live recognition worker on `CAM-PC-01`.

### Method 2: Standard FastAPI Execution
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🎨 Visual Features & Live HUD Overlay
When running live webcam stream, the service renders a high-visibility heads-up display:
- 🟢 **Bright Green Bounding Box**: Highlights detected plate region.
- 🏷️ **Black Text Banner**: Displays `PLATE: AA12345 (95%)` above detected box.
- 📊 **Status Bar**: Live stream status header on video feed.
- 📺 **MJPEG Live Feed**: View live preview in browser at `http://localhost:8000/preview/CAM-PC-01`.

---

## 📸 Supported Camera Provider Types
- **`USB` / PC Camera**: Local laptop or USB webcams (`cv2.VideoCapture(0)`).
- **`ANDROID_PHONE`**: Android smartphone cameras via IP Webcam / HTTP video stream.
- **`VIDEO_FILE`**: Pre-recorded video files (`.mp4`, `.avi`) with looping support for testing.
- **`MOCK_SYNTHETIC`**: Generates synthetic Ethiopian plates (`AA12345`, `3AA98765`, `ET45678`) with synthetic plate bounding boxes for zero-hardware demo and automated testing.
- **`RTSP`**: RTSP network camera streams (`rtsp://admin:pass@ip:554/stream`).
- **`ONVIF`**: Enterprise ONVIF ANPR camera protocol.

---

## 🌐 Key API Endpoints
- `GET http://localhost:8000/health`: Health status.
- `GET http://localhost:8000/detect-pc-cameras`: Scans and returns connected PC webcam indices.
- `GET http://localhost:8000/cameras`: Active camera worker status.
- `POST http://localhost:8000/cameras/start`: Start worker for USB / RTSP / Android camera.
- `GET http://localhost:8000/preview/{camera_id}`: Live MJPEG stream with visual overlay.
