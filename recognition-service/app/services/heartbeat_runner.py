import time
import threading
import logging
from typing import Dict
from app.services.nestjs_client import NestJSClient
from app.services.recognition_runner import RecognitionWorker

logger = logging.getLogger("HeartbeatRunner")

class HeartbeatRunner:
    def __init__(self, workers: Dict[str, RecognitionWorker], nestjs_client: NestJSClient):
        self.workers = workers
        self.nestjs_client = nestjs_client
        self.is_running = False
        self.stop_event = threading.Event()
        self.thread = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        self.stop_event.set()

    def _run_loop(self):
        while self.is_running:
            try:
                for camera_id, worker in list(self.workers.items()):
                    status = "ACTIVE" if worker.provider.is_connected else "OFFLINE"
                    details = f"Camera streaming via {worker.provider.__class__.__name__}"
                    self.nestjs_client.send_heartbeat(camera_id, status, details)

                if self.stop_event.wait(timeout=30):
                    break
            except Exception as e:
                logger.error(f"Heartbeat runner error: {e}")
                if self.stop_event.wait(timeout=10):
                    break
