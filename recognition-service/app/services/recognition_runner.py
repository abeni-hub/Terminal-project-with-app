import time
import datetime
import threading
import logging
from typing import Dict, List, Optional, Set, Any
import cv2
import numpy as np

from app.config import settings
from app.camera.base import BaseCameraProvider
from app.detection.tracker import VehicleTracker
from app.detection.plate_detector import PlateDetector
from app.ocr.recognizer import OCRRecognizer
from app.voting.majority_vote import MajorityVoter
from app.storage.image_storage import ImageStorage
from app.services.nestjs_client import NestJSClient
from app.qr.qr_scanner import QRScanner, GateFlowManager, GateAction, MatchStatus, GateDirection, QRScanResult, GateDecision

import concurrent.futures

logger = logging.getLogger("RecognitionRunner")

class RecognitionWorker:
    """
    High-FPS Production ANPR Recognition Worker:
    - High-frequency camera processing loop (up to 30+ FPS)
    - Vehicle Tracking & License Plate Detection
    - OCR & Ethiopian Format Validation
    - Plate Eligibility Check & Unknown Vehicle Categorization
    - Live Video HUD Stream with real-time FPS counter
    """
    def __init__(
        self,
        camera_id: str,
        terminal_id: str,
        camera_type: str,
        provider: BaseCameraProvider,
        nestjs_client: NestJSClient,
    ):
        self.camera_id = camera_id
        self.terminal_id = terminal_id
        self.camera_type = camera_type
        self.provider = provider
        self.nestjs_client = nestjs_client

        # Modular Pipeline Instantiation
        self.vehicle_tracker = VehicleTracker()
        self.plate_detector = PlateDetector()
        self.recognizer = OCRRecognizer()
        self.majority_voter = MajorityVoter()
        self.image_storage = ImageStorage()
        self.qr_scanner = QRScanner(throttle_interval=4)
        self.gate_flow_manager = GateFlowManager()

        self.latest_qr_scan: Optional[QRScanResult] = None
        self.latest_gate_decision: Optional[GateDecision] = None
        self.last_qr_gate_decision_time: float = 0.0

        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="ANPR-Worker")

        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.latest_frame: Optional[np.ndarray] = None
        self.last_recognized_plate = ""
        self.sent_track_ids: Set[int] = set()

        # Tracked consensus cache (track_id -> (plate_text, confidence, is_eligible))
        self.track_consensus_cache: Dict[int, Tuple[str, float, bool]] = {}
        self.track_sent_time: Dict[int, float] = {}

        # Recognized & Unknown Plates Categorization Registry
        self.unknown_plates: List[Dict[str, Any]] = []
        self.eligible_plates: List[Dict[str, Any]] = []
        self.plate_eligibility_cache: Dict[str, bool] = {}

        # Real-time FPS Calculation metrics
        self.current_fps: float = 0.0
        self.frame_count: int = 0
        self.fps_start_time: float = time.time()

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info(f"🚀 Started High-FPS ANPR worker for camera {self.camera_id}")

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        self.executor.shutdown(wait=False)
        self.provider.release()
        logger.info(f"🛑 Stopped ANPR worker for camera {self.camera_id}")

    def get_unknown_plates(self) -> List[Dict[str, Any]]:
        return list(self.unknown_plates)

    def get_eligible_plates(self) -> List[Dict[str, Any]]:
        return list(self.eligible_plates)

    def get_latest_gate_decision(self) -> Optional[Dict[str, Any]]:
        return self.latest_gate_decision.to_dict() if self.latest_gate_decision else None

    def get_recent_gate_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.gate_flow_manager.audit_logger.get_recent_logs(limit)

    def _async_save_and_dispatch(
        self,
        track_id: int,
        plate_text: str,
        consensus_conf: float,
        v_crop: np.ndarray,
        p_crop: np.ndarray,
        vehicle_class: str,
    ):
        """Background thread worker for saving images and sending NestJS API dispatch."""
        try:
            timestamp_iso = datetime.datetime.utcnow().isoformat() + "Z"
            veh_path, plate_path, v_b64, p_b64 = self.image_storage.save_anpr_images(
                camera_id=self.camera_id,
                track_id=track_id,
                vehicle_crop=v_crop,
                plate_crop=p_crop
            )

            res = self.nestjs_client.send_recognition_event(
                camera_id=self.camera_id,
                terminal_id=self.terminal_id,
                camera_type=self.camera_type,
                plate_number=plate_text,
                confidence=consensus_conf,
                captured_at=timestamp_iso,
                track_id=track_id,
                vehicle_type=vehicle_class,
                direction=self.camera_type,
                vehicle_image=v_b64,
                plate_image=p_b64,
                image_path=plate_path or "",
            )

            is_eligible = res.get("isEligible", True) if isinstance(res, dict) else True
            self.plate_eligibility_cache[plate_text] = is_eligible

            plate_record = {
                "cameraId": self.camera_id,
                "trackId": track_id,
                "plateNumber": plate_text,
                "confidence": consensus_conf,
                "vehicleType": vehicle_class,
                "timestamp": timestamp_iso,
                "isEligible": is_eligible,
                "imagePath": plate_path,
                "vehicleImage": v_b64,
                "plateImage": p_b64
            }

            if is_eligible:
                self.eligible_plates.append(plate_record)
                logger.info(f"✅ [CAM: {self.camera_id}] ELIGIBLE Plate: {plate_text}")
            else:
                self.unknown_plates.append(plate_record)
                logger.warning(f"🚨 [CAM: {self.camera_id}] UNKNOWN/UNREGISTERED Plate: {plate_text} -> Added to Unknown List")
        except Exception as e:
            logger.error(f"Async ANPR dispatch error: {e}")

    def _run_loop(self):
        self.provider.connect()
        self.fps_start_time = time.time()
        self.frame_count = 0

        while self.is_running:
            try:
                loop_start = time.time()
                ret, frame = self.provider.read_frame()
                if not ret or frame is None:
                    time.sleep(0.05)
                    continue

                # Calculate Live FPS
                self.frame_count += 1
                elapsed = time.time() - self.fps_start_time
                if elapsed >= 1.0:
                    self.current_fps = self.frame_count / elapsed
                    self.frame_count = 0
                    self.fps_start_time = time.time()

                display_frame = frame.copy()
                h, w = display_frame.shape[:2]

                # Step 0: Scan frame for QR Code Pass (Throttled interval)
                qr_result = self.qr_scanner.scan_frame(frame)
                if qr_result and qr_result.found:
                    self.latest_qr_scan = qr_result
                    if qr_result.bbox:
                        qx, qy, qw, qh = qr_result.bbox
                        cv2.rectangle(display_frame, (qx, qy), (qx + qw, qy + qh), (0, 255, 255), 2)
                        t_id = qr_result.validation.payload.ticket_id if qr_result.validation and qr_result.validation.payload else "QR"
                        cv2.putText(display_frame, f"QR PASS: {t_id}", (qx, max(qy - 8, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

                # Step 1: Detect & Track Vehicles (ByteTrack)
                tracked_vehicles = self.vehicle_tracker.track(frame)

                # If no vehicle detected but valid QR pass present: Evaluate QR-Only access
                if not tracked_vehicles and qr_result and qr_result.found:
                    now = time.time()
                    if now - self.last_qr_gate_decision_time > 3.0:
                        direction = GateDirection.ENTRY if self.camera_type == "ENTRY" else GateDirection.EXIT
                        decision = self.gate_flow_manager.evaluate_gate_access(
                            ocr_plate="",
                            ocr_confidence=0.0,
                            qr_input=qr_result,
                            direction=direction,
                            camera_id=self.camera_id,
                        )
                        self.latest_gate_decision = decision
                        self.last_qr_gate_decision_time = now
                        logger.info(f"🚪 [CAM: {self.camera_id}] QR-Only Gate Action: {decision.action.value} ({decision.reason})")

                for vehicle in tracked_vehicles:
                    vx, vy, vw, vh = vehicle.bbox
                    track_id = vehicle.track_id
                    v_crop = vehicle.crop

                    # Draw Vehicle Box (Cyan)
                    cv2.rectangle(display_frame, (vx, vy), (vx + vw, vy + vh), (255, 255, 0), 2)
                    v_label = f"ID:{track_id} {vehicle.class_name.upper()}"
                    cv2.putText(display_frame, v_label, (vx + 5, max(vy - 10, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 2)

                    # Step 2: Check 3-second capture cooldown for this vehicle track
                    now = time.time()

                    # Step 3: License Plate Detection on Vehicle Crop
                    plate_result = self.plate_detector.detect_plate_region(v_crop)
                    if plate_result:
                        p_crop, (px, py, pw, ph) = plate_result
                        abs_px = vx + px
                        abs_py = vy + py

                        # Step 4: Image Enhancement & OCR Recognition
                        raw_text, normalized, confidence = self.recognizer.recognize(p_crop)

                        if normalized:
                            # If a different plate text is read than what was cached for this track, reset cooldown & voter
                            cached_data = self.track_consensus_cache.get(track_id)
                            if cached_data and cached_data[0] != normalized and confidence >= 0.65:
                                logger.info(f"⚡ Swapped plate detected: {cached_data[0]} -> {normalized}. Clearing track cache.")
                                self.track_sent_time.pop(track_id, None)
                                self.track_consensus_cache.pop(track_id, None)
                                self.majority_voter.clear_track(track_id)

                            # Step 5: Check 3-second cooldown for SAME plate
                            if track_id in self.track_sent_time:
                                if now - self.track_sent_time[track_id] < 3.0:
                                    cached_text, cached_conf, cached_elig = self.track_consensus_cache.get(
                                        track_id, (normalized, confidence, True)
                                    )
                                    box_color = (0, 255, 0) if cached_elig else (0, 0, 255)
                                    banner = f"{'ELIGIBLE' if cached_elig else 'CAPTURED UNKNOWN'}: {cached_text}"
                                    cv2.rectangle(display_frame, (abs_px, abs_py), (abs_px + pw, abs_py + ph), box_color, 3)
                                    cv2.putText(display_frame, banner, (abs_px, max(abs_py - 10, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, box_color, 2)
                                    continue
                                else:
                                    # 3 seconds elapsed: clear cooldown for new capture
                                    self.sent_track_ids.discard(track_id)
                                    self.track_consensus_cache.pop(track_id, None)
                                    self.track_sent_time.pop(track_id, None)

                            # Step 6: Multi-frame Majority Voting
                            self.majority_voter.add_observation(track_id, normalized, confidence)
                            consensus_plate, consensus_conf, is_ready = self.majority_voter.get_consensus(track_id)
                            plate_text = consensus_plate or normalized

                            # Step 7: Check Eligibility & Categorize
                            is_eligible = self.plate_eligibility_cache.get(plate_text, True)
                            box_color = (0, 255, 0) if is_eligible else (0, 0, 255)
                            status_label = "ELIGIBLE" if is_eligible else "UNKNOWN PLATE"

                            # Step 7b: Reconcile Plate with Scanned QR Pass
                            direction = GateDirection.ENTRY if self.camera_type == "ENTRY" else GateDirection.EXIT
                            active_qr = self.latest_qr_scan if (self.latest_qr_scan and (now - self.qr_scanner.last_decoded_time < 5.0)) else None
                            decision = self.gate_flow_manager.evaluate_gate_access(
                                ocr_plate=plate_text,
                                ocr_confidence=consensus_conf or confidence,
                                qr_input=active_qr,
                                direction=direction,
                                camera_id=self.camera_id,
                            )
                            self.latest_gate_decision = decision

                            # Draw Plate Box & Status Banner
                            cv2.rectangle(display_frame, (abs_px, abs_py), (abs_px + pw, abs_py + ph), box_color, 3)
                            banner = f"{status_label}: {plate_text} ({int(confidence * 100)}%)"
                            cv2.putText(display_frame, banner, (abs_px, max(abs_py - 10, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, box_color, 2)

                            # Step 8: Record capture & set 3-second cooldown
                            self.sent_track_ids.add(track_id)
                            self.track_sent_time[track_id] = now
                            self.track_consensus_cache[track_id] = (plate_text, consensus_conf or confidence, is_eligible)
                            self.last_recognized_plate = plate_text

                            # Offload image saving & HTTP reporting to ThreadPool
                            self.executor.submit(
                                self._async_save_and_dispatch,
                                track_id,
                                plate_text,
                                consensus_conf or confidence,
                                v_crop,
                                p_crop,
                                vehicle.class_name,
                            )


                # Top Live HUD Banner with FPS Counter
                fps_display = f"{self.current_fps:.1f}" if self.current_fps > 0 else "--"
                status_text = f"CAM: {self.camera_id} | {self.camera_type} | FPS: {fps_display} | UNKNOWN PLATES: {len(self.unknown_plates)}"
                cv2.rectangle(display_frame, (0, 0), (w, 34), (20, 20, 20), -1)
                cv2.putText(display_frame, status_text, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                # Secondary HUD Banner: Real-time Gate Action & QR Status
                if self.latest_gate_decision:
                    g_act = self.latest_gate_decision.action.value
                    g_col = (0, 255, 0) if g_act == "OPEN" else (0, 165, 255) if g_act == "HOLD" else (0, 0, 255)
                    g_text = f"GATE: {g_act} [{self.latest_gate_decision.match_status.value}] - {self.latest_gate_decision.reason[:50]}"
                    cv2.rectangle(display_frame, (0, 35), (w, 62), (10, 10, 10), -1)
                    cv2.putText(display_frame, g_text, (12, 54), cv2.FONT_HERSHEY_SIMPLEX, 0.55, g_col, 2)

                self.latest_frame = display_frame

                # Low-CPU Sleep control (max 20 FPS)
                processing_time = time.time() - loop_start
                target_delay = max(0.04, settings.FRAME_SLEEP_INTERVAL - processing_time)
                time.sleep(target_delay)

            except Exception as e:
                logger.error(f"Error in High-FPS ANPR loop for camera {self.camera_id}: {e}")
                time.sleep(0.05)
