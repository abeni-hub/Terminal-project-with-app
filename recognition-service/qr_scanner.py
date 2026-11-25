"""
Standalone QR Code Scanner & Gate Flow Module
Direct root proxy to app.qr.qr_scanner for seamless import and CLI usage.
"""

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

__all__ = [
    "PassType",
    "ValidationStatus",
    "MatchStatus",
    "GateAction",
    "GateDirection",
    "QRPayload",
    "QRValidationResult",
    "QRScanResult",
    "GateDecision",
    "QRPayloadParser",
    "QRImageDecoder",
    "QRScanner",
    "GateAuditLogger",
    "GateFlowManager",
]

if __name__ == "__main__":
    import sys
    import json
    import datetime

    print("=" * 60)
    print(" 📱 QR Code Scanner & Gate Flow Engine — Standalone Mode")
    print("=" * 60)

    # Initialize components
    scanner = QRScanner(throttle_interval=1, secret_key="demo_gate_secret")
    gate_manager = GateFlowManager()

    # Create demo signed payload
    exp = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=7)
    sample_qr = QRPayloadParser.generate_signed_token(
        ticket_id="TKT-SAMPLE-99",
        plate_number="AA12345",
        pass_type=PassType.SUBSCRIBER,
        expires_at=exp,
        secret_key="demo_gate_secret",
        account_id="ACC-DEMO-01",
    )

    print("\n1. Generated Signed Demo QR Token:")
    print(sample_qr)

    print("\n2. Simulating Match Scenario (Plate: AA12345 + Matching QR):")
    decision1 = gate_manager.evaluate_gate_access(
        ocr_plate="AA12345",
        ocr_confidence=0.96,
        qr_input=sample_qr,
        direction=GateDirection.ENTRY,
    )
    print(f"Action:       {decision1.action.value}")
    print(f"Match Status: {decision1.match_status.value}")
    print(f"Needs Review: {decision1.needs_review}")
    print(f"Reason:       {decision1.reason}")

    print("\n3. Simulating Mismatch Scenario (Plate: AA99999 + QR: AA12345):")
    decision2 = gate_manager.evaluate_gate_access(
        ocr_plate="AA99999",
        ocr_confidence=0.92,
        qr_input=sample_qr,
        direction=GateDirection.ENTRY,
    )
    print(f"Action:       {decision2.action.value}")
    print(f"Match Status: {decision2.match_status.value}")
    print(f"Needs Review: {decision2.needs_review}")
    print(f"Reason:       {decision2.reason}")

    print("\n4. Simulating QR-Only Access (No Plate Read + Visitor Ticket):")
    visitor_ticket = json.dumps({
        "ticket_id": "VISITOR-552",
        "pass_type": "VISITOR",
        "expires_at": (datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=4)).isoformat(),
    })
    decision3 = gate_manager.evaluate_gate_access(
        ocr_plate="",
        qr_input=visitor_ticket,
        direction=GateDirection.ENTRY,
    )
    print(f"Action:       {decision3.action.value}")
    print(f"Match Status: {decision3.match_status.value}")
    print(f"Reason:       {decision3.reason}")

    print("\n✅ Standalone QR Code Scanner & Gate Flow module is operational.")
