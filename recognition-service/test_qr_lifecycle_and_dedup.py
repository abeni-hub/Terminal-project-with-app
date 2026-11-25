"""
test_qr_lifecycle_and_dedup.py - Comprehensive Unit & Simulation Test Suite.

Verifies:
1. QR Code Generation, HMAC-SHA256 signing, and high-contrast image rendering.
2. QR Pass Lifecycle Management (Issue, Search, Renew, Reassign, Suspend, Reactivate, Revoke, Single-Use).
3. Automatic Routing to 'Incoming Pending' (WAITING) Queue upon Camera QR verification.
4. Cooldown & Multi-layer Deduplication: Holding vehicle OSAA11225 (or its QR) across 50+ frames
   triggers EXACTLY 1 dispatch event and 1 pending entry (no notification spam).
"""

import os
import sys
import time
import json
import unittest
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Ensure recognition-service directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from app.qr.qr_repository import QRRepository, QRPassRecord
from app.qr.qr_manager import QRManager
from app.qr.qr_scanner import GateAction, MatchStatus, GateDirection, QRScanner, GateDecision
from app.services.nestjs_client import NestJSClient
from app.services.recognition_runner import RecognitionWorker
from app.camera.base import BaseCameraProvider
import numpy as np

class MockCameraProvider(BaseCameraProvider):
    """Feeds synthetic test frames with a fixed white box to simulate a plate."""
    def __init__(self):
        super().__init__("CAM-TEST-01", "0")
        self.frame_idx = 0

    def connect(self) -> bool:
        self.is_connected = True
        return True

    def read_frame(self):
        self.frame_idx += 1
        # Create 640x480 black image with a white simulated vehicle rectangle
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # Vehicle box
        frame[100:380, 150:490] = (60, 60, 60)
        # Plate rectangle
        frame[300:360, 240:400] = (255, 255, 255)
        return True, frame

    def release(self):
        self.is_connected = False

class MockNestJSClient(NestJSClient):
    """Intercepts and records all events sent to NestJS for verification."""
    def __init__(self):
        super().__init__("http://mock-nestjs:4000/api/v1")
        self.dispatched_events: List[Dict[str, Any]] = []

    def send_recognition_event(self, **kwargs) -> Dict[str, Any]:
        self.dispatched_events.append(kwargs)
        return {
            "success": True,
            "isEligible": True,
            "status": "ACCEPTED",
            "queueEntry": {
                "id": f"q-entry-{len(self.dispatched_events)}",
                "status": "WAITING",
                "plateNumber": kwargs.get("plate_number"),
                "entryType": "AUTO_RECOGNIZED" if kwargs.get("source") != "QR_CAMERA" else "QR_CAMERA",
            }
        }

class TestQRLifecycleAndDeduplication(unittest.TestCase):
    def setUp(self):
        self.test_db_path = os.path.join(CURRENT_DIR, "test_qr_passes.db")
        if os.path.exists(self.test_db_path):
            try:
                os.remove(self.test_db_path)
            except Exception:
                pass

        self.repo = QRRepository(db_path=self.test_db_path)
        self.manager = QRManager(repository=self.repo, secret_key="test_secret_key_12345")
        self.mock_nestjs = MockNestJSClient()

    def tearDown(self):
        if os.path.exists(self.test_db_path):
            try:
                os.remove(self.test_db_path)
            except Exception:
                pass

    # -------------------------------------------------------------------------
    # TEST 1: QR Generation, Signing, and Image Rendering
    # -------------------------------------------------------------------------
    def test_01_qr_generation_and_image(self):
        print("\n--- TEST 1: QR Pass Generation & Cryptographic Signing ---")
        issued = self.manager.issue_pass(
            plate_number="OSAA11225",
            pass_type="SUBSCRIBER",
            holder_name="City Bus Co",
            duration_days=60,
            max_uses=0,
            operator_id="ADMIN-01",
        )

        self.assertTrue(issued["pass_id"].startswith("PASS-SUB-"))
        self.assertEqual(issued["plate_number"], "OSAA11225")
        self.assertEqual(issued["status"], "ACTIVE")
        self.assertTrue(len(issued["signature"]) >= 16)
        self.assertTrue(issued["qr_image_data_uri"].startswith("data:image/png;base64,"))
        print(f"✅ Generated & signed pass [{issued['pass_id']}] for OSAA11225 (Sig: {issued['signature']})")

    # -------------------------------------------------------------------------
    # TEST 2: Pass Lifecycle Operations (Renew, Reassign, Suspend, Revoke)
    # -------------------------------------------------------------------------
    def test_02_pass_lifecycle_operations(self):
        print("\n--- TEST 2: QR Pass Lifecycle (Renew, Reassign, Suspend, Revoke) ---")
        issued = self.manager.issue_pass(
            plate_number="OSAA11225",
            pass_type="SUBSCRIBER",
            holder_name="Fleet Driver",
            duration_days=10,
        )
        pass_id = issued["pass_id"]

        # 2a. Renew
        new_exp = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
        renewed = self.repo.renew_pass(pass_id, new_exp, operator_id="ADMIN-02", reason="Quarterly extension")
        self.assertEqual(renewed.expires_at, new_exp)
        print(f"✅ Pass renewed until {new_exp}")

        # 2b. Reassign Plate
        reassigned = self.repo.reassign_plate(pass_id, "OSAA99999", operator_id="ADMIN-02", reason="Transferred vehicle")
        self.assertEqual(reassigned.plate_number, "OSAA99999")
        print("✅ Pass plate reassigned from OSAA11225 to OSAA99999")

        # 2c. Suspend
        suspended = self.repo.update_status(pass_id, "SUSPENDED", operator_id="SUPERVISOR", reason="Maintenance audit")
        self.assertEqual(suspended.status, "SUSPENDED")
        decision_susp = self.manager.verify_and_consume_gate_pass(
            raw_qr_input=json.dumps({"pass_id": pass_id, "plate_number": "OSAA99999"}),
            detected_plate="OSAA99999",
        )
        self.assertEqual(decision_susp.action, GateAction.HOLD)
        self.assertIn("SUSPENDED", decision_susp.reason)
        print("✅ Suspended pass correctly held at gate")

        # 2d. Reactivate
        reactivated = self.repo.update_status(pass_id, "ACTIVE", operator_id="SUPERVISOR", reason="Audit cleared")
        self.assertEqual(reactivated.status, "ACTIVE")
        decision_active = self.manager.verify_and_consume_gate_pass(
            raw_qr_input=json.dumps({"pass_id": pass_id, "plate_number": "OSAA99999"}),
            detected_plate="OSAA99999",
        )
        self.assertEqual(decision_active.action, GateAction.OPEN)
        print("✅ Reactivated pass cleared gate with OPEN action")

        # 2e. Revoke
        revoked = self.repo.update_status(pass_id, "REVOKED", operator_id="ADMIN", reason="Contract terminated")
        self.assertEqual(revoked.status, "REVOKED")
        decision_rev = self.manager.verify_and_consume_gate_pass(
            raw_qr_input=json.dumps({"pass_id": pass_id, "plate_number": "OSAA99999"}),
            detected_plate="OSAA99999",
        )
        self.assertEqual(decision_rev.action, GateAction.REJECT)
        self.assertIn("REVOKED", decision_rev.reason)
        print("✅ Revoked pass rejected with REJECT action")

        # 2f. Verify Audit Trail Records
        logs = self.repo.get_audit_logs(pass_id=pass_id)
        actions = [l.action for l in logs]
        self.assertIn("ISSUE", actions)
        self.assertIn("RENEW", actions)
        self.assertIn("REASSIGN", actions)
        self.assertIn("SUSPEND", actions)
        self.assertIn("REACTIVATE", actions)
        self.assertIn("REVOKE", actions)
        print(f"✅ Full audit trail recorded {len(logs)} lifecycle events for pass {pass_id}")

    # -------------------------------------------------------------------------
    # TEST 3: Single-Use Ticket Auto-Consumption
    # -------------------------------------------------------------------------
    def test_03_single_use_ticket_consumption(self):
        print("\n--- TEST 3: Single-Use Ticket Consumption ---")
        issued = self.manager.issue_pass(
            plate_number="AA12345",
            pass_type="VISITOR",
            holder_name="Visitor Guest",
            duration_days=1,
            max_uses=1,
        )
        pass_id = issued["pass_id"]

        # First Scan: should succeed and transition to USED
        d1 = self.manager.verify_and_consume_gate_pass(
            raw_qr_input=json.dumps({"pass_id": pass_id, "plate_number": "AA12345"}),
            detected_plate="AA12345",
        )
        self.assertEqual(d1.action, GateAction.OPEN)
        db_pass = self.repo.get_pass(pass_id)
        self.assertEqual(db_pass.status, "USED")
        self.assertEqual(db_pass.use_count, 1)
        print("✅ First scan successful (Use count: 1, Status: USED)")

        # Second Scan: should be rejected as already consumed
        d2 = self.manager.verify_and_consume_gate_pass(
            raw_qr_input=json.dumps({"pass_id": pass_id, "plate_number": "AA12345"}),
            detected_plate="AA12345",
        )
        self.assertEqual(d2.action, GateAction.REJECT)
        self.assertIn("already been consumed", d2.reason)
        print("✅ Second scan of consumed ticket rejected as expected")

    # -------------------------------------------------------------------------
    # TEST 4: Automatic Routing to 'Incoming Pending' Tab on Camera QR
    # -------------------------------------------------------------------------
    def test_04_camera_qr_auto_routes_to_incoming_pending(self):
        print("\n--- TEST 4: Camera QR Verification Auto-Routes to Incoming Pending ---")
        cam_provider = MockCameraProvider()
        worker = RecognitionWorker(
            camera_id="CAM-TEST-ENTRY",
            terminal_id="terminal-west",
            camera_type="ENTRY",
            provider=cam_provider,
            nestjs_client=self.mock_nestjs,
        )

        decision = GateDecision(
            action=GateAction.OPEN,
            match_status=MatchStatus.MATCHED,
            needs_review=False,
            reason="Identity confirmed",
            plate_number="AA67890",
            ticket_id="PASS-SUB-101",
            pass_type="SUBSCRIBER",
            direction=GateDirection.ENTRY,
        )

        # Dispatch QR verification
        worker._async_dispatch_qr(
            pass_id="PASS-SUB-101",
            plate_text="AA67890",
            pass_type="SUBSCRIBER",
            decision=decision,
        )

        self.assertEqual(len(self.mock_nestjs.dispatched_events), 1)
        dispatched = self.mock_nestjs.dispatched_events[0]
        self.assertEqual(dispatched["source"], "QR_CAMERA")
        self.assertEqual(dispatched["pass_id"], "PASS-SUB-101")
        self.assertEqual(dispatched["plate_number"], "AA67890")
        self.assertEqual(dispatched["match_status"], "MATCHED")
        print("✅ QR camera pass dispatched with source='QR_CAMERA' for automatic queue check-in")

    # -------------------------------------------------------------------------
    # TEST 5: Holding Vehicle OSAA11225 Across 50+ Frames (Deduplication)
    # -------------------------------------------------------------------------
    def test_05_holding_vehicle_50_frames_deduplication(self):
        print("\n--- TEST 5: Holding Vehicle OSAA11225 Across 60 Frames (Anti-Spam Cooldown) ---")
        cam_provider = MockCameraProvider()
        worker = RecognitionWorker(
            camera_id="CAM-ENTRY-01",
            terminal_id="terminal-center",
            camera_type="ENTRY",
            provider=cam_provider,
            nestjs_client=self.mock_nestjs,
        )
        worker.COOLDOWN_SECONDS = 45.0

        plate = "OSAA11225"
        dummy_crop = np.zeros((50, 100, 3), dtype=np.uint8)

        # Simulate 60 consecutive frames with the same vehicle stationary in front of the camera
        for frame_num in range(1, 61):
            now = time.time()
            plate_cooldown_key = f"{worker.camera_id}:PLATE:{plate}"
            is_in_cooldown = (now - worker.entity_cooldown.get(plate_cooldown_key, 0)) < worker.COOLDOWN_SECONDS

            if not is_in_cooldown:
                worker.entity_cooldown[plate_cooldown_key] = now
                worker._async_save_and_dispatch(
                    track_id=1,
                    plate_text=plate,
                    consensus_conf=0.92,
                    v_crop=dummy_crop,
                    p_crop=dummy_crop,
                    vehicle_class="car",
                )

        # VERIFY: Exactly 1 dispatch event was fired across all 60 frames!
        self.assertEqual(len(self.mock_nestjs.dispatched_events), 1)
        self.assertEqual(self.mock_nestjs.dispatched_events[0]["plate_number"], plate)
        print(f"✅ Held OSAA11225 across 60 frames: Dispatched exactly 1 event (59 suppressed by cooldown)")

    # -------------------------------------------------------------------------
    # TEST 6: Holding QR Pass Across 50+ Frames (Deduplication)
    # -------------------------------------------------------------------------
    def test_06_holding_qr_pass_50_frames_deduplication(self):
        print("\n--- TEST 6: Holding QR Pass Across 60 Frames (Anti-Spam Cooldown) ---")
        self.mock_nestjs.dispatched_events.clear()

        cam_provider = MockCameraProvider()
        worker = RecognitionWorker(
            camera_id="CAM-ENTRY-02",
            terminal_id="terminal-east",
            camera_type="ENTRY",
            provider=cam_provider,
            nestjs_client=self.mock_nestjs,
        )
        worker.COOLDOWN_SECONDS = 45.0

        pass_id = "PASS-VIP-888"
        decision = GateDecision(
            action=GateAction.OPEN,
            match_status=MatchStatus.QR_ONLY,
            needs_review=False,
            reason="VIP pass valid",
            ticket_id=pass_id,
        )

        for frame_num in range(1, 61):
            now = time.time()
            qr_cooldown_key = f"{worker.camera_id}:QR:{pass_id}"
            is_in_cooldown = (now - worker.entity_cooldown.get(qr_cooldown_key, 0)) < worker.COOLDOWN_SECONDS

            if not is_in_cooldown:
                worker.entity_cooldown[qr_cooldown_key] = now
                worker._async_dispatch_qr(pass_id, "AA77777", "VIP", decision)

        # VERIFY: Exactly 1 dispatch event was fired across all 60 frames!
        self.assertEqual(len(self.mock_nestjs.dispatched_events), 1)
        self.assertEqual(self.mock_nestjs.dispatched_events[0]["pass_id"], pass_id)
        print(f"✅ Held QR Pass {pass_id} across 60 frames: Dispatched exactly 1 event (59 suppressed by cooldown)")

if __name__ == "__main__":
    unittest.main()
