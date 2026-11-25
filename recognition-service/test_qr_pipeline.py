"""
====================================================================
Addis Ababa Transport Office - QR Code Scanner & Gate Flow Test Runner
====================================================================
Comprehensive simulation pipeline testing:
1. Valid QR + Matching Vehicle Plate (MATCHED -> OPEN)
2. Expired QR Ticket (EXPIRED -> REJECT)
3. Plate Mismatch (PLATE_MISMATCH -> HOLD + Review)
4. QR-Only Access (QR_ONLY -> OPEN)
5. Angled / Tilted QR Fallback (-15 deg rotation)
6. Glare / Low-Contrast QR Fallback (CLAHE Enhancement)
7. Cryptographic HMAC Signature Verification & Tamper Detection
8. SQLite Audit Trail Recording
"""

import sys
import os
import datetime
import tempfile
import json
import logging
import numpy as np
import cv2
import qrcode

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("TestQRPipeline")

# Add current directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.qr.qr_scanner import (
    PassType,
    ValidationStatus,
    MatchStatus,
    GateAction,
    GateDirection,
    QRPayloadParser,
    QRImageDecoder,
    QRScanner,
    GateAuditLogger,
    GateFlowManager,
)

def generate_test_qr_image(data: str) -> np.ndarray:
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

def run_tests():
    logger.info("🧪 Starting Standalone QR Code Scanner & Gate Flow Test Suite...")
    secret_key = "gate_secret_production_key"

    # Temporary SQLite DB
    temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    temp_db.close()
    audit_logger = GateAuditLogger(db_path=temp_db.name)
    gate_manager = GateFlowManager(allow_qr_only=True, audit_logger=audit_logger)

    try:
        # TEST 1: Valid QR + Matching Plate
        logger.info("\n--- TEST 1: Valid QR + Matching Plate ---")
        exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=3)
        valid_token = QRPayloadParser.generate_signed_token(
            ticket_id="TKT-PERMIT-401",
            plate_number="AA12345",
            pass_type=PassType.SUBSCRIBER,
            expires_at=exp,
            secret_key=secret_key,
            account_id="ACC-FLEET-01",
        )
        decision1 = gate_manager.evaluate_gate_access(
            ocr_plate="AA12345",
            ocr_confidence=0.96,
            qr_input=valid_token,
            direction=GateDirection.ENTRY,
        )
        assert decision1.action == GateAction.OPEN, f"Expected OPEN, got {decision1.action}"
        assert decision1.match_status == MatchStatus.MATCHED, f"Expected MATCHED, got {decision1.match_status}"
        assert not decision1.needs_review, "Expected needs_review to be False"
        logger.info(f"✅ PASSED: Gate {decision1.action.value} - {decision1.reason}")

        # TEST 2: Expired QR Ticket
        logger.info("\n--- TEST 2: Expired QR Ticket ---")
        past_exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=2)
        expired_token = json.dumps({
            "ticket_id": "TKT-EXPIRED-02",
            "plate_number": "AA12345",
            "pass_type": "VISITOR",
            "expires_at": past_exp.isoformat(),
        })
        decision2 = gate_manager.evaluate_gate_access(
            ocr_plate="AA12345",
            qr_input=expired_token,
            direction=GateDirection.ENTRY,
        )
        assert decision2.action == GateAction.REJECT, f"Expected REJECT, got {decision2.action}"
        assert decision2.match_status == MatchStatus.REJECTED
        logger.info(f"✅ PASSED: Gate {decision2.action.value} - {decision2.reason}")

        # TEST 3: Plate Mismatch (Security Alert)
        logger.info("\n--- TEST 3: Plate Mismatch (Security Alert) ---")
        decision3 = gate_manager.evaluate_gate_access(
            ocr_plate="AA99999",  # Plate on car does not match AA12345 on QR
            ocr_confidence=0.94,
            qr_input=valid_token,
            direction=GateDirection.ENTRY,
        )
        assert decision3.action == GateAction.HOLD, f"Expected HOLD, got {decision3.action}"
        assert decision3.match_status == MatchStatus.PLATE_MISMATCH
        assert decision3.needs_review is True
        logger.info(f"✅ PASSED: Gate {decision3.action.value} (HOLD flagged for review) - {decision3.reason}")

        # TEST 4: QR-Only Access (No Plate Read)
        logger.info("\n--- TEST 4: QR-Only Access (Visitor pass without plate) ---")
        visitor_token = json.dumps({
            "ticket_id": "VISITOR-DAY-09",
            "pass_type": "VISITOR",
            "expires_at": (datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=8)).isoformat(),
        })
        decision4 = gate_manager.evaluate_gate_access(
            ocr_plate="",
            qr_input=visitor_token,
            direction=GateDirection.ENTRY,
        )
        assert decision4.action == GateAction.OPEN, f"Expected OPEN, got {decision4.action}"
        assert decision4.match_status == MatchStatus.QR_ONLY
        logger.info(f"✅ PASSED: Gate {decision4.action.value} (QR_ONLY allowed) - {decision4.reason}")

        # TEST 5: Angled / Tilted QR Decoder Fallback
        logger.info("\n--- TEST 5: Angled / Tilted QR Fallback (15 degree tilt) ---")
        qr_tilt_img = generate_test_qr_image(visitor_token)
        rotated_15 = QRImageDecoder.rotate_image(qr_tilt_img, 15.0)
        decoder = QRImageDecoder()
        res_tilt = decoder.decode(rotated_15)
        assert res_tilt is not None, "Failed to decode 15-degree tilted QR image"
        text_tilt, method_tilt, _, _ = res_tilt
        assert "VISITOR-DAY-09" in text_tilt
        logger.info(f"✅ PASSED: Successfully decoded tilted QR using fallback method '{method_tilt}'")

        # TEST 6: Low-Contrast / Glare CLAHE Fallback
        logger.info("\n--- TEST 6: Low-Contrast / Glare Fallback ---")
        qr_contrast_img = generate_test_qr_image(visitor_token)
        washed_out = (qr_contrast_img.astype(np.float32) * 0.25 + 175).astype(np.uint8)
        res_glare = decoder.decode(washed_out)
        assert res_glare is not None, "Failed to decode low-contrast QR image"
        text_glare, method_glare, _, _ = res_glare
        assert "VISITOR-DAY-09" in text_glare
        logger.info(f"✅ PASSED: Successfully decoded low-contrast glare QR using method '{method_glare}'")

        # TEST 7: Cryptographic Tamper Detection
        logger.info("\n--- TEST 7: Cryptographic HMAC Signature & Tamper Detection ---")
        tampered_token = valid_token.replace("AA12345", "AA99999")
        parsed_tampered = QRPayloadParser.parse_raw(tampered_token)
        val_tampered = QRPayloadParser.validate(parsed_tampered, secret_key=secret_key)
        assert not val_tampered.is_valid
        assert val_tampered.status == ValidationStatus.INVALID_SIGNATURE
        logger.info(f"✅ PASSED: Tamper detected successfully: {val_tampered.error_message}")

        # TEST 8: SQLite Audit Log Verification
        logger.info("\n--- TEST 8: SQLite Audit Trail Verification ---")
        logs = audit_logger.get_recent_logs(limit=10)
        assert len(logs) >= 4, f"Expected at least 4 audit logs, got {len(logs)}"
        for log in logs[:3]:
            logger.info(f"  📝 [Log #{log['id']}] {log['timestamp']} | Action: {log['action']} | Match: {log['match_status']} | Ticket: {log['ticket_id']}")
        logger.info("✅ PASSED: SQLite audit trail accurately recorded all gate transitions.")

        logger.info("\n🎉 ALL 8 QR CODE SCANNER & GATE FLOW TESTS COMPLETED SUCCESSFULLY!")

    finally:
        if os.path.exists(temp_db.name):
            try:
                os.remove(temp_db.name)
            except Exception:
                pass

if __name__ == "__main__":
    run_tests()
