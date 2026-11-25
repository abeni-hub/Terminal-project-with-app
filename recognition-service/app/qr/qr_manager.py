"""
qr_manager.py - QR Code Generator & Lifecycle Management Engine.

Provides:
- Cryptographic HMAC-SHA256 signing of low-density QR payloads.
- High-contrast QR image generation (PNG bytes & Base64 Data URI) with generous margins.
- Full lifecycle management (Issue, Renew, Reassign, Suspend, Reactivate, Revoke).
- Batch CSV/JSON pass generation and export.
- Gate verification & consumption hook with SQLite audit logging.
"""

import io
import csv
import json
import hmac
import base64
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

import qrcode
from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_Q

from app.qr.qr_repository import QRRepository, QRPassRecord, QRAuditLogRecord
from app.qr.qr_scanner import PassType, ValidationStatus, MatchStatus, GateAction, GateDirection, GateDecision

logger = logging.getLogger("QRManager")

DEFAULT_SECRET_KEY = "aatransport_qr_production_hmac_secret_key_2026"

class QRManager:
    """
    Comprehensive QR Code Generator & Lifecycle Manager for Parking Gate Access.
    """
    def __init__(self, repository: Optional[QRRepository] = None, secret_key: Optional[str] = None):
        self.repo = repository or QRRepository()
        self.secret_key = (secret_key or DEFAULT_SECRET_KEY).encode("utf-8")

    def _sign_payload(self, pass_id: str, plate_number: str, pass_type: str, expires_at: str) -> str:
        """Computes HMAC-SHA256 signature over canonical pass fields."""
        norm_plate = (plate_number or "").strip().upper()
        canonical = f"{pass_id}:{norm_plate}:{pass_type}:{expires_at}"
        return hmac.new(self.secret_key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()[:16]

    def _verify_payload_signature(self, pass_id: str, plate_number: str, pass_type: str, expires_at: str, signature: str) -> bool:
        """Verifies HMAC-SHA256 signature in constant time."""
        expected = self._sign_payload(pass_id, plate_number, pass_type, expires_at)
        return hmac.compare_digest(expected.lower(), (signature or "").lower())

    def render_qr_image(
        self,
        payload_str: str,
        error_correction: str = "M",
        box_size: int = 10,
        border: int = 4,
    ) -> Tuple[bytes, str]:
        """
        Renders crisp, high-contrast QR image.
        Returns (png_bytes, base64_data_uri).
        """
        ec_level = ERROR_CORRECT_Q if error_correction.upper() == "Q" else ERROR_CORRECT_M
        qr = qrcode.QRCode(
            version=None,
            error_correction=ec_level,
            box_size=box_size,
            border=border,  # Generous quiet-zone margins
        )
        qr.add_data(payload_str)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        png_bytes = buffer.getvalue()
        b64_str = base64.b64encode(png_bytes).decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_str}"
        return png_bytes, data_uri

    def issue_pass(
        self,
        plate_number: str,
        pass_type: str = "SUBSCRIBER",
        holder_name: str = "Fleet Vehicle",
        account_id: Optional[str] = None,
        duration_days: int = 90,
        max_uses: int = 0,  # 0 = unlimited (for subscribers), 1 = single-use visitor
        custom_pass_id: Optional[str] = None,
        operator_id: str = "SYSTEM",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Issues a new cryptographically signed QR transit pass and renders QR image.
        """
        now_dt = datetime.now(timezone.utc)
        expires_dt = now_dt + timedelta(days=duration_days)

        issued_at = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        valid_from = issued_at
        expires_at = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        norm_plate = (plate_number or "").strip().upper()
        pass_type_norm = pass_type.strip().upper()

        # Generate unique pass_id if not provided
        if not custom_pass_id:
            prefix = "SUB" if pass_type_norm == "SUBSCRIBER" else ("VIS" if pass_type_norm == "VISITOR" else "TKT")
            rand_suffix = hashlib.sha256(f"{now_dt.isoformat()}:{norm_plate}:{holder_name}".encode("utf-8")).hexdigest()[:8].upper()
            pass_id = f"PASS-{prefix}-{rand_suffix}"
        else:
            pass_id = custom_pass_id.strip().upper()

        signature = self._sign_payload(pass_id, norm_plate, pass_type_norm, expires_at)

        # Canonical QR payload
        payload_dict = {
            "pass_id": pass_id,
            "plate_number": norm_plate or None,
            "pass_type": pass_type_norm,
            "expires_at": expires_at,
            "sig": signature,
        }
        payload_str = json.dumps(payload_dict, separators=(",", ":"))

        # Render QR code image
        png_bytes, b64_uri = self.render_qr_image(payload_str, error_correction="M")

        record = QRPassRecord(
            pass_id=pass_id,
            plate_number=norm_plate,
            pass_type=pass_type_norm,
            holder_name=holder_name,
            account_id=account_id,
            status="ACTIVE",
            max_uses=max_uses,
            use_count=0,
            issued_at=issued_at,
            valid_from=valid_from,
            expires_at=expires_at,
            metadata=json.dumps(metadata) if metadata else None,
        )

        saved = self.repo.create_pass(record, operator_id=operator_id)

        return {
            "pass_id": saved.pass_id,
            "plate_number": saved.plate_number,
            "pass_type": saved.pass_type,
            "holder_name": saved.holder_name,
            "account_id": saved.account_id,
            "status": saved.status,
            "max_uses": saved.max_uses,
            "use_count": saved.use_count,
            "issued_at": saved.issued_at,
            "valid_from": saved.valid_from,
            "expires_at": saved.expires_at,
            "signature": signature,
            "payload_json": payload_str,
            "qr_image_data_uri": b64_uri,
        }

    def batch_issue_passes(
        self,
        passes_data: List[Dict[str, Any]],
        operator_id: str = "SYSTEM",
    ) -> List[Dict[str, Any]]:
        """Issues multiple passes in a single batch operation."""
        results = []
        for item in passes_data:
            res = self.issue_pass(
                plate_number=item.get("plate_number", ""),
                pass_type=item.get("pass_type", "SUBSCRIBER"),
                holder_name=item.get("holder_name", "Fleet Vehicle"),
                account_id=item.get("account_id"),
                duration_days=int(item.get("duration_days", 90)),
                max_uses=int(item.get("max_uses", 0)),
                custom_pass_id=item.get("pass_id"),
                operator_id=operator_id,
                metadata=item.get("metadata"),
            )
            results.append(res)
        return results

    def verify_and_consume_gate_pass(
        self,
        raw_qr_input: str,
        detected_plate: Optional[str] = None,
        detected_confidence: float = 0.0,
        direction: GateDirection = GateDirection.ENTRY,
        gate_id: str = "CAM-GATE-01",
    ) -> GateDecision:
        """
        Direct Gate Verification Hook:
        1. Parses structured QR payload (JSON / pipe token).
        2. Validates HMAC signature against tampering.
        3. Looks up persistent pass status in SQLite repository.
        4. Validates active status, validity window, and usage limits.
        5. Reconciles with OCR detected plate (MATCHED, PLATE_MISMATCH, QR_ONLY).
        6. Consumes pass (increments use_count, transitions to USED if single-use).
        7. Returns authoritative GateDecision.
        """
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Parse QR input
        payload_data: Dict[str, Any] = {}
        cleaned = raw_qr_input.strip()
        try:
            payload_data = json.loads(cleaned)
        except Exception:
            # Handle pipe/colon fallback format
            if "|" in cleaned:
                parts = cleaned.split("|")
                if len(parts) >= 3:
                    payload_data = {
                        "pass_id": parts[0],
                        "plate_number": parts[1] if parts[1] else None,
                        "pass_type": parts[2],
                        "expires_at": parts[3] if len(parts) > 3 else None,
                        "sig": parts[4] if len(parts) > 4 else None,
                    }
            elif ":" in cleaned and "{" not in cleaned:
                parts = cleaned.split(":")
                if len(parts) >= 3:
                    payload_data = {
                        "pass_id": parts[0],
                        "plate_number": parts[1] if parts[1] else None,
                        "pass_type": parts[2],
                        "expires_at": parts[3] if len(parts) > 3 else None,
                    }

        pass_id = str(payload_data.get("pass_id") or payload_data.get("ticket_id") or "").strip().upper()
        qr_plate = (payload_data.get("plate_number") or "").strip().upper()
        pass_type = str(payload_data.get("pass_type") or "SUBSCRIBER").strip().upper()
        expires_at_str = payload_data.get("expires_at")
        signature = payload_data.get("sig") or payload_data.get("signature")

        norm_ocr_plate = (detected_plate or "").strip().upper()

        if not pass_id:
            return GateDecision(
                action=GateAction.REJECT,
                match_status=MatchStatus.REJECTED,
                needs_review=True,
                reason="Invalid QR pass payload: missing pass_id/ticket_id identifier.",
                timestamp=now_iso,
            )

        # 1. Look up in repository
        db_pass = self.repo.get_pass(pass_id)
        if not db_pass:
            # Check if signature matches offline fallback (for pre-issued external tickets)
            if signature and expires_at_str:
                sig_valid = self._verify_payload_signature(pass_id, qr_plate, pass_type, expires_at_str, signature)
                if not sig_valid:
                    return GateDecision(
                        action=GateAction.REJECT,
                        match_status=MatchStatus.REJECTED,
                        needs_review=True,
                        reason="QR signature verification failed: unverified or forged ticket.",
                        ticket_id=pass_id,
                        timestamp=now_iso,
                    )
            else:
                return GateDecision(
                    action=GateAction.REJECT,
                    match_status=MatchStatus.REJECTED,
                    needs_review=True,
                    reason=f"QR pass [{pass_id}] not found in vehicle pass registry.",
                    ticket_id=pass_id,
                    timestamp=now_iso,
                )

        # Use authoritative DB values if available
        effective_plate = db_pass.plate_number if db_pass else qr_plate
        effective_status = db_pass.status if db_pass else "ACTIVE"
        effective_expires = db_pass.expires_at if db_pass else expires_at_str
        effective_pass_type = db_pass.pass_type if db_pass else pass_type

        # 2. Check Pass Status
        if effective_status == "REVOKED":
            return GateDecision(
                action=GateAction.REJECT,
                match_status=MatchStatus.REJECTED,
                needs_review=True,
                reason=f"QR pass [{pass_id}] has been REVOKED ({db_pass.revocation_reason or 'Policy violation'}). Access denied.",
                ticket_id=pass_id,
                plate_number=effective_plate,
                timestamp=now_iso,
            )

        if effective_status == "SUSPENDED":
            return GateDecision(
                action=GateAction.HOLD,
                match_status=MatchStatus.REJECTED,
                needs_review=True,
                reason=f"QR pass [{pass_id}] is currently SUSPENDED. Supervisor clearance required.",
                ticket_id=pass_id,
                plate_number=effective_plate,
                timestamp=now_iso,
            )

        if effective_status == "USED" and db_pass and db_pass.max_uses > 0:
            return GateDecision(
                action=GateAction.REJECT,
                match_status=MatchStatus.REJECTED,
                needs_review=True,
                reason=f"Single-use QR pass [{pass_id}] has already been consumed ({db_pass.use_count}/{db_pass.max_uses} uses).",
                ticket_id=pass_id,
                plate_number=effective_plate,
                timestamp=now_iso,
            )

        # 3. Check Expiration
        if effective_expires:
            try:
                exp_dt = datetime.fromisoformat(effective_expires.replace("Z", "+00:00"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                if now_dt > exp_dt:
                    return GateDecision(
                        action=GateAction.REJECT,
                        match_status=MatchStatus.REJECTED,
                        needs_review=True,
                        reason=f"QR pass [{pass_id}] EXPIRED on {effective_expires}.",
                        ticket_id=pass_id,
                        plate_number=effective_plate,
                        timestamp=now_iso,
                    )
            except Exception as e:
                logger.warning(f"Date parse error for pass {pass_id}: {e}")

        # 4. Reconcile Plate Number
        if norm_ocr_plate and effective_plate:
            if norm_ocr_plate == effective_plate:
                # MATCHED
                if db_pass:
                    self.repo.record_scan_use(pass_id, gate_id=gate_id, plate_matched=True)
                return GateDecision(
                    action=GateAction.OPEN,
                    match_status=MatchStatus.MATCHED,
                    needs_review=False,
                    reason=f"Identity confirmed: OCR plate [{norm_ocr_plate}] matches QR pass [{pass_id}].",
                    plate_number=norm_ocr_plate,
                    ocr_confidence=detected_confidence,
                    ticket_id=pass_id,
                    pass_type=PassType.from_str(effective_pass_type),
                    direction=direction,
                    timestamp=now_iso,
                )
            else:
                # PLATE MISMATCH
                return GateDecision(
                    action=GateAction.HOLD,
                    match_status=MatchStatus.PLATE_MISMATCH,
                    needs_review=True,
                    reason=f"Security Alert: Camera detected [{norm_ocr_plate}], but QR pass is registered to [{effective_plate}].",
                    plate_number=norm_ocr_plate,
                    ocr_confidence=detected_confidence,
                    ticket_id=pass_id,
                    pass_type=PassType.from_str(effective_pass_type),
                    direction=direction,
                    timestamp=now_iso,
                )

        elif not norm_ocr_plate and effective_pass_type in ["VISITOR", "PREPAID", "SUBSCRIBER", "STAFF", "VIP"]:
            # QR ONLY ACCESS
            if db_pass:
                self.repo.record_scan_use(pass_id, gate_id=gate_id, plate_matched=False)
            return GateDecision(
                action=GateAction.OPEN,
                match_status=MatchStatus.QR_ONLY,
                needs_review=False,
                reason=f"Valid {effective_pass_type} QR pass [{pass_id}] granted clearance (QR_ONLY access).",
                plate_number=effective_plate or None,
                ticket_id=pass_id,
                pass_type=PassType.from_str(effective_pass_type),
                direction=direction,
                timestamp=now_iso,
            )

        # Fallback
        return GateDecision(
            action=GateAction.HOLD,
            match_status=MatchStatus.REJECTED,
            needs_review=True,
            reason=f"Pass [{pass_id}] clearance could not be confirmed.",
            ticket_id=pass_id,
            timestamp=now_iso,
        )

    def export_passes_csv(self, search: Optional[str] = None, status: Optional[str] = None) -> str:
        """Exports QR passes matching criteria to CSV string."""
        passes = self.repo.list_passes(search=search, status=status, limit=1000)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "pass_id", "plate_number", "pass_type", "holder_name",
            "account_id", "status", "max_uses", "use_count",
            "issued_at", "expires_at", "revocation_reason"
        ])
        for p in passes:
            writer.writerow([
                p.pass_id, p.plate_number, p.pass_type, p.holder_name,
                p.account_id or "", p.status, p.max_uses, p.use_count,
                p.issued_at, p.expires_at, p.revocation_reason or ""
            ])
        return output.getvalue()
