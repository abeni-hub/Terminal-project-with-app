"""
====================================================================
Addis Ababa Transport Office - PC Camera & ALPR Runner
====================================================================
This script launches the ALPR Recognition Microservice connected
directly to your PC Webcam / USB Camera.

It displays:
- Live bounding box overlay around detected vehicle license plates.
- High-contrast text label banner: PLATE: AA12345 (95%).
- Instant HTTP transmission of plate events to NestJS Backend on port 4000.
"""

import cv2
import sys
import os
import uvicorn

def scan_pc_cameras():
    print("\n🔍 Scanning for connected PC Cameras / Webcams...")
    found = []
    for idx in range(4):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                found.append(idx)
            cap.release()
    return found

def main():
    print("=" * 60)
    print(" 📹  Addis Ababa Terminal System - PC Camera Runner")
    print("=" * 60)

    cameras = scan_pc_cameras()
    if cameras:
        print(f"✅ Found {len(cameras)} active PC Camera(s): Device Index {cameras}")
        selected_index = cameras[0]
    else:
        print("⚠️ No physical PC camera detected. Defaulting to index 0.")
        selected_index = 0

    print(f"\n🚀 Starting Recognition Service with PC Camera index [{selected_index}]...")
    print(f"📺 Live Stream Preview URL: http://localhost:8000/preview/CAM-PC-01")
    print(f"🌐 NestJS Target Endpoint: http://localhost:4000/api/v1/recognition/process\n")

    # Set environment variables for the app
    os.environ["DEFAULT_PC_CAM_INDEX"] = str(selected_index)
    os.environ["NESTJS_API_URL"] = "http://localhost:4000/api/v1"

    from app.main import app, shutdown_event
    import signal

    def handle_shutdown(sig, frame):
        print("\n🛑 Received termination signal (Ctrl+C). Exiting PC Camera Runner...")
        shutdown_event()
        os._exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except (KeyboardInterrupt, SystemExit):
        print("\n🛑 Clean exit triggered.")
        shutdown_event()
        os._exit(0)

if __name__ == "__main__":
    main()
