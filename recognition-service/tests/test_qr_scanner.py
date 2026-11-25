"""
Unit & Simulation Tests for QR Code Scanner & Gate Flow Engine
Tests:
- Valid QR + matching plate
- Expired QR
- Mismatched plate
- QR-only access and policy enforcement
- Damaged / angled / low-contrast QR fallbacks (CLAHE, rotation)
- Multi-format token parsing (JSON, pipe, colon, query string)
- Cryptographic HMAC signature validation and tamper detection
- Frame throttling & low-CPU performance
- SQLite audit logging and persistence
"""

import sys
import os
import unittest
import datetime
import tempfile
import json
import numpy as np
import cv2
import qrcode

# Add parent dir to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.qr.qr_scanner import (
    PassType,
    ValidationStatus,
    MatchStatus,
    GateAction,
    GateDirection,
    QRPayload,
    QRValidationResult,
    QRScanResult,
    GateDecision,
    QRPayloadParser,
    QRImageDecoder,
    QRScanner,
    GateAuditLogger,
    GateFlowManager,
)


class TestQRScannerAndGateFlow(unittest.TestCase):

    def setUp(self):
        self.secret_key = "test_parking_gate_secret_key"
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.audit_logger = GateAuditLogger(db_path=self.temp_db.name)
        self.gate_manager = GateFlowManager(
            allow_qr_only=True,
            require_plate_match_for_subscribers=True,
            audit_logger=self.audit_logger,
        )
        self.scanner = QRScanner(throttle_interval=3, secret_key=self.secret_key)

    def tearDown(self):
        if os.path.exists(self.temp_db.name):
            try:
                os.remove(self.temp_db.name)
            except Exception:
                pass

    def _generate_qr_image(self, data: str) -> np.ndarray:
        """Helper to create synthetic QR code image in BGR format."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        pil_img = img.convert("RGB")
        return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Matching Plate + Valid QR
    # ─────────────────────────────────────────────────────────────────────────
    def test_valid_qr_and_matching_plate(self):
        exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=2)
        token = QRPayloadParser.generate_signed_token(
            ticket_id="TKT-1001",
            plate_number="AA12345",
            pass_type=PassType.SUBSCRIBER,
            expires_at=exp,
            secret_key=self.secret_key,
            account_id="ACC-01",
        )

        decision = self.gate_manager.evaluate_gate_access(
            ocr_plate="AA12345",
            ocr_confidence=0.95,
            qr_input=token,
            direction=GateDirection.ENTRY,
        )

        self.assertEqual(decision.action, GateAction.OPEN)
        self.assertEqual(decision.match_status, MatchStatus.MATCHED)
        self.assertFalse(decision.needs_review)
        self.assertIn("Identity confirmed", decision.reason)
        self.assertEqual(decision.plate_number, "AA12345")
        self.assertIsNotNone(decision.audit_id)

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Expired QR Code
    # ─────────────────────────────────────────────────────────────────────────
    def test_expired_qr(self):
        past_exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=3)
        expired_payload = {
            "ticket_id": "TKT-EXPIRED-99",
            "plate_number": "AA12345",
            "pass_type": "VISITOR",
            "expires_at": past_exp.isoformat(),
        }
        token = json.dumps(expired_payload)

        # Direct parser test
        val = self.scanner.decode_raw_string(token)
        self.assertEqual(val.status, ValidationStatus.EXPIRED)
        self.assertFalse(val.is_valid)

        # Gate flow evaluation
        decision = self.gate_manager.evaluate_gate_access(
            ocr_plate="AA12345",
            qr_input=token,
            direction=GateDirection.ENTRY,
        )
        self.assertEqual(decision.action, GateAction.REJECT)
        self.assertEqual(decision.match_status, MatchStatus.REJECTED)
        self.assertIn("expired", decision.reason.lower())

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Plate Mismatch (Camera plate != QR plate)
    # ─────────────────────────────────────────────────────────────────────────
    def test_mismatched_plate_flags_review(self):
        exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=1)
        token = QRPayloadParser.generate_signed_token(
            ticket_id="TKT-MISMATCH-1",
            plate_number="AA12345",
            pass_type=PassType.SUBSCRIBER,
            expires_at=exp,
            secret_key=self.secret_key,
        )

        # Vehicle detected has different plate 'AA99887'
        decision = self.gate_manager.evaluate_gate_access(
            ocr_plate="AA99887",
            ocr_confidence=0.91,
            qr_input=token,
            direction=GateDirection.ENTRY,
        )

        self.assertEqual(decision.action, GateAction.HOLD)
        self.assertEqual(decision.match_status, MatchStatus.PLATE_MISMATCH)
        self.assertTrue(decision.needs_review)
        self.assertIn("mismatch", decision.reason.lower())

    # ─────────────────────────────────────────────────────────────────────────
    # 4. QR-Only Access (Obscured Plate / Pedestrian / Visitor)
    # ─────────────────────────────────────────────────────────────────────────
    def test_qr_only_access_allowed(self):
        exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=6)
        token = json.dumps({
            "ticket_id": "VISITOR-TICKET-77",
            "pass_type": "VISITOR",
            "expires_at": exp.isoformat(),
        })

        # No plate detected
        decision = self.gate_manager.evaluate_gate_access(
            ocr_plate="",
            qr_input=token,
            direction=GateDirection.ENTRY,
        )

        self.assertEqual(decision.action, GateAction.OPEN)
        self.assertEqual(decision.match_status, MatchStatus.QR_ONLY)
        self.assertFalse(decision.needs_review)

    def test_qr_only_subscriber_requires_plate(self):
        exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=5)
        token = json.dumps({
            "ticket_id": "SUB-REG-88",
            "plate_number": "AA55555",
            "pass_type": "SUBSCRIBER",
            "expires_at": exp.isoformat(),
        })

        # Subscriber pass without plate when require_plate_match_for_subscribers is True
        decision = self.gate_manager.evaluate_gate_access(
            ocr_plate=None,
            qr_input=token,
            direction=GateDirection.ENTRY,
        )

        self.assertEqual(decision.action, GateAction.HOLD)
        self.assertEqual(decision.match_status, MatchStatus.QR_ONLY)
        self.assertTrue(decision.needs_review)

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Plate-Only Access (Traditional ALPR Fallback)
    # ─────────────────────────────────────────────────────────────────────────
    def test_plate_only_access(self):
        decision = self.gate_manager.evaluate_gate_access(
            ocr_plate="AA33445",
            ocr_confidence=0.89,
            qr_input=None,
            direction=GateDirection.ENTRY,
        )

        self.assertEqual(decision.action, GateAction.OPEN)
        self.assertEqual(decision.match_status, MatchStatus.PLATE_ONLY)
        self.assertEqual(decision.plate_number, "AA33445")

    # ─────────────────────────────────────────────────────────────────────────
    # 6. Damaged / Angled / Low-Contrast QR Image Preprocessing Fallbacks
    # ─────────────────────────────────────────────────────────────────────────
    def test_tilted_qr_decoding_fallback(self):
        """Simulates camera viewing a phone or windshield tilted at an angle."""
        raw_payload = json.dumps({"ticket_id": "TKT-TILT-15", "pass_type": "VISITOR"})
        qr_img = self._generate_qr_image(raw_payload)

        # Rotate by 15 degrees
        rotated_img = QRImageDecoder.rotate_image(qr_img, 15.0)

        decoder = QRImageDecoder()
        res = decoder.decode(rotated_img)

        self.assertIsNotNone(res, "Decoder should recover tilted QR code using rotation fallback")
        text, method, bbox, _ = res
        self.assertIn("TKT-TILT-15", text)
        self.assertIsNotNone(bbox)

    def test_low_contrast_glare_clahe_fallback(self):
        """Simulates washed-out phone screen or outdoor glare."""
        raw_payload = json.dumps({"ticket_id": "TKT-GLARE-44", "pass_type": "VISITOR"})
        qr_img = self._generate_qr_image(raw_payload)

        # Artificially compress contrast (simulate extreme glare: dynamic range 180-240)
        low_contrast = (qr_img.astype(np.float32) * 0.2 + 180).astype(np.uint8)

        decoder = QRImageDecoder()
        res = decoder.decode(low_contrast)

        self.assertIsNotNone(res, "Decoder should recover low-contrast QR using CLAHE enhancement")
        text, method, _, _ = res
        self.assertIn("TKT-GLARE-44", text)

    def test_roi_and_embedded_frame_decoding(self):
        """Simulates QR code located inside an 800x600 camera frame with ROI bounding box."""
        raw_payload = json.dumps({"ticket_id": "TKT-KIOSK-01", "pass_type": "STAFF"})
        qr_img = self._generate_qr_image(raw_payload)
        qh, qw = qr_img.shape[:2]

        # Embed QR inside a full 600x800 video frame at (100, 150)
        full_frame = np.ones((600, 800, 3), dtype=np.uint8) * 128
        full_frame[150:150 + qh, 100:100 + qw] = qr_img

        # Scan with ROI around kiosk area (x=80, y=130, w=qw+40, h=qh+40)
        roi = (80, 130, qw + 40, qh + 40)
        scanner = QRScanner(roi=roi)
        scan_res = scanner.scan_frame(full_frame, force=True)

        self.assertIsNotNone(scan_res)
        self.assertTrue(scan_res.found)
        self.assertIn("TKT-KIOSK-01", scan_res.raw_text)
        # Check that bounding box coordinates were offset correctly to full frame
        self.assertGreaterEqual(scan_res.bbox[0], 80)
        self.assertGreaterEqual(scan_res.bbox[1], 130)

    # ─────────────────────────────────────────────────────────────────────────
    # 7. Multi-Format Token Parsing (Pipe, Colon, Query String)
    # ─────────────────────────────────────────────────────────────────────────
    def test_pipe_delimited_token_parsing(self):
        pipe_token = "PASS:TKT-PIPE-77|AA66778|SUBSCRIBER|ACC-99|2026-12-31T23:59:59Z|SIG123"
        payload = QRPayloadParser.parse_raw(pipe_token)

        self.assertIsNotNone(payload)
        self.assertEqual(payload.ticket_id, "TKT-PIPE-77")
        self.assertEqual(payload.plate_number, "AA66778")
        self.assertEqual(payload.pass_type, PassType.SUBSCRIBER)
        self.assertEqual(payload.account_id, "ACC-99")
        self.assertEqual(payload.signature, "SIG123")

    def test_colon_delimited_token_parsing(self):
        colon_token = "TKT-COLON-55:OR12345:PREPAID:ACC-50:2026-11-30"
        payload = QRPayloadParser.parse_raw(colon_token)

        self.assertIsNotNone(payload)
        self.assertEqual(payload.ticket_id, "TKT-COLON-55")
        self.assertEqual(payload.plate_number, "OR12345")
        self.assertEqual(payload.pass_type, PassType.PREPAID)

    def test_query_string_token_parsing(self):
        query_token = "id=TKT-URL-12&plate=dd99887&type=VISITOR&bal=150.0"
        payload = QRPayloadParser.parse_raw(query_token)

        self.assertIsNotNone(payload)
        self.assertEqual(payload.ticket_id, "TKT-URL-12")
        self.assertEqual(payload.plate_number, "DD99887")
        self.assertEqual(payload.pass_type, PassType.VISITOR)
        self.assertEqual(payload.balance, 150.0)

    # ─────────────────────────────────────────────────────────────────────────
    # 8. Cryptographic Signature & Tamper Detection
    # ─────────────────────────────────────────────────────────────────────────
    def test_hmac_tamper_detection(self):
        exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=10)
        signed_token = QRPayloadParser.generate_signed_token(
            ticket_id="TKT-SECURE-01",
            plate_number="AA12345",
            pass_type=PassType.SUBSCRIBER,
            expires_at=exp,
            secret_key=self.secret_key,
        )

        # 1. Unmodified token: valid signature
        p_valid = QRPayloadParser.parse_raw(signed_token)
        v_valid = QRPayloadParser.validate(p_valid, secret_key=self.secret_key)
        self.assertTrue(v_valid.is_valid)
        self.assertEqual(v_valid.status, ValidationStatus.VALID)

        # 2. Tampered token: attacker changed plate number from AA12345 to AA99999
        tampered_dict = json.loads(signed_token)
        tampered_dict["plate_number"] = "AA99999"  # Tampered!
        tampered_token = json.dumps(tampered_dict)

        p_tampered = QRPayloadParser.parse_raw(tampered_token)
        v_tampered = QRPayloadParser.validate(p_tampered, secret_key=self.secret_key)
        self.assertFalse(v_tampered.is_valid)
        self.assertEqual(v_tampered.status, ValidationStatus.INVALID_SIGNATURE)

    # ─────────────────────────────────────────────────────────────────────────
    # 9. Frame Throttling (Low-CPU Mode)
    # ─────────────────────────────────────────────────────────────────────────
    def test_frame_throttling_skips_intermediate_frames(self):
        dummy_frame = np.zeros((300, 300, 3), dtype=np.uint8)
        scanner = QRScanner(throttle_interval=3)

        # Frame 1: scanned
        res1 = scanner.scan_frame(dummy_frame)
        self.assertIsNotNone(res1)
        self.assertFalse(res1.found)

        # Frame 2: skipped (returns None, saving CPU)
        res2 = scanner.scan_frame(dummy_frame)
        self.assertIsNone(res2)

        # Frame 3: skipped
        res3 = scanner.scan_frame(dummy_frame)
        self.assertIsNone(res3)

        # Frame 4: scanned (interval reached)
        res4 = scanner.scan_frame(dummy_frame)
        self.assertIsNotNone(res4)

        # Frame 5: forced scan even though not on interval
        res5 = scanner.scan_frame(dummy_frame, force=True)
        self.assertIsNotNone(res5)

    # ─────────────────────────────────────────────────────────────────────────
    # 10. SQLite Audit Trail & Persistence
    # ─────────────────────────────────────────────────────────────────────────
    def test_sqlite_audit_logging_and_retrieval(self):
        decision = GateDecision(
            action=GateAction.OPEN,
            match_status=MatchStatus.MATCHED,
            needs_review=False,
            reason="Test automated gate entry",
            plate_number="AA77889",
            ocr_confidence=0.98,
            ticket_id="TKT-AUDIT-01",
            pass_type=PassType.SUBSCRIBER,
            direction=GateDirection.ENTRY,
        )

        audit_id = self.audit_logger.log_event(
            decision=decision,
            camera_id="CAM-GATE-ENTRY",
            qr_plate="AA77889",
            account_id="ACC-CORP-9",
            raw_qr_text="PASS:TKT-AUDIT-01...",
            metadata={"lane": 1, "gate_id": "G-01"},
        )

        self.assertGreater(audit_id, 0)
        logs = self.audit_logger.get_recent_logs(limit=10)
        self.assertGreaterEqual(len(logs), 1)

        latest = logs[0]
        self.assertEqual(latest["ticket_id"], "TKT-AUDIT-01")
        self.assertEqual(latest["effective_plate"], "AA77889")
        self.assertEqual(latest["action"], "OPEN")
        self.assertEqual(latest["match_status"], "MATCHED")
        self.assertEqual(latest["needs_review"], 0)


if __name__ == "__main__":
    unittest.main()
