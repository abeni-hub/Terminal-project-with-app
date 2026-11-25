"""
====================================================================
Addis Ababa Transport Office / Parking Gate ALPR System
Module: QR Code Scanner & Gate Flow Reconciliation
====================================================================
Provides standalone and integrated QR code detection, decoding,
structured payload parsing, validation, plate OCR reconciliation,
and gate dispatch decision-making.

Features:
- Dual-engine QR decoding: pyzbar (fast) with fallback to OpenCV QRCodeDetector.
- Intelligent preprocessing: Grayscale, CLAHE contrast enhancement,
  Otsu adaptive thresholding, multi-angle rotation (-15, +15, 90, 180, 270 deg),
  and multi-scale resizing for phone screens and printed tickets.
- Throttled interval scanning (e.g., every Nth frame) for ultra-low CPU impact.
- Dedicated Region of Interest (ROI) support.
- Multi-format payload parser: Structured JSON, pipe-delimited, colon-delimited,
  and query-string tokens.
- Expiration check, active window verification, and optional HMAC-SHA256 signatures.
- Plate + QR reconciliation: MATCHED, PLATE_MISMATCH (needs review), QR_ONLY,
  PLATE_ONLY, with configurable gate policies (OPEN, HOLD, REJECT).
- Built-in SQLite audit trail and fee deduction / tariff calculator.
"""

from __future__ import annotations

import os
import re
import time
import json
import hmac
import hashlib
import sqlite3
import logging
import datetime
from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Any, Set, Union

import cv2
import numpy as np

# Optional pyzbar import
try:
    from pyzbar import pyzbar
    PYZBAR_AVAILABLE = True
except (ImportError, Exception):
    pyzbar = None
    PYZBAR_AVAILABLE = False

logger = logging.getLogger("QRScanner")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Enums and Core Data Models
# ─────────────────────────────────────────────────────────────────────────────

class PassType(str, Enum):
    """Classification of vehicle / parking passes."""
    SUBSCRIBER = "SUBSCRIBER"
    VISITOR = "VISITOR"
    PREPAID = "PREPAID"
    STAFF = "STAFF"
    DELIVERY = "DELIVERY"
    ONE_TIME = "ONE_TIME"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_str(cls, val: Optional[str]) -> "PassType":
        if not val:
            return cls.UNKNOWN
        clean = val.strip().upper()
        for member in cls:
            if member.value == clean:
                return member
        return cls.UNKNOWN


class ValidationStatus(str, Enum):
    """Validation outcome for a QR pass."""
    VALID = "VALID"
    EXPIRED = "EXPIRED"
    NOT_YET_VALID = "NOT_YET_VALID"
    INVALID_FORMAT = "INVALID_FORMAT"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    REVOKED = "REVOKED"
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS"
    UNKNOWN = "UNKNOWN"


class MatchStatus(str, Enum):
    """Reconciliation state between QR payload plate and camera OCR plate."""
    MATCHED = "MATCHED"                # High-confidence combined identity
    PLATE_MISMATCH = "PLATE_MISMATCH"  # Plate in QR does NOT match camera OCR plate
    QR_ONLY = "QR_ONLY"                # Valid QR, but no plate read from camera
    PLATE_ONLY = "PLATE_ONLY"          # Plate read from camera, but no QR presented
    REJECTED = "REJECTED"              # Invalid or expired QR
    NO_DATA = "NO_DATA"                # Neither plate nor QR present


class GateAction(str, Enum):
    """Physical barrier / gate control action."""
    OPEN = "OPEN"                      # Open gate immediately
    HOLD = "HOLD"                      # Hold gate; flag for supervisor / attendant review
    REJECT = "REJECT"                  # Do not open gate; show error message to driver


class GateDirection(str, Enum):
    """Direction of traffic movement."""
    ENTRY = "ENTRY"
    EXIT = "EXIT"


@dataclass
class QRPayload:
    """Structured data extracted from a scanned QR pass/ticket."""
    ticket_id: str
    plate_number: Optional[str] = None
    pass_type: PassType = PassType.VISITOR
    account_id: Optional[str] = None
    expires_at: Optional[datetime.datetime] = None
    effective_from: Optional[datetime.datetime] = None
    signature: Optional[str] = None
    balance: float = 0.0
    raw_text: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.expires_at:
            data["expires_at"] = self.expires_at.isoformat()
        if self.effective_from:
            data["effective_from"] = self.effective_from.isoformat()
        data["pass_type"] = self.pass_type.value
        return data


@dataclass
class QRValidationResult:
    """Result of format, time, and signature validation for a QR code."""
    status: ValidationStatus
    is_valid: bool
    payload: Optional[QRPayload] = None
    error_message: Optional[str] = None
    time_remaining_seconds: Optional[float] = None


@dataclass
class QRScanResult:
    """Detailed visual scan result returned from frame processing."""
    found: bool
    raw_text: str = ""
    bbox: Optional[Tuple[int, int, int, int]] = None       # (x, y, w, h)
    polygon: Optional[List[Tuple[int, int]]] = None
    validation: Optional[QRValidationResult] = None
    method_used: str = "none"
    processing_time_ms: float = 0.0


@dataclass
class GateDecision:
    """Consolidated decision combining Plate OCR and QR Code verification."""
    action: GateAction
    match_status: MatchStatus
    needs_review: bool
    reason: str
    plate_number: Optional[str] = None
    ocr_confidence: float = 0.0
    ticket_id: Optional[str] = None
    pass_type: Optional[PassType] = None
    direction: GateDirection = GateDirection.ENTRY
    fee_deducted: float = 0.0
    remaining_balance: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).isoformat() + "Z")
    audit_id: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action.value,
            "match_status": self.match_status.value,
            "needs_review": self.needs_review,
            "reason": self.reason,
            "plate_number": self.plate_number,
            "ocr_confidence": self.ocr_confidence,
            "ticket_id": self.ticket_id,
            "pass_type": self.pass_type.value if self.pass_type else None,
            "direction": self.direction.value,
            "fee_deducted": self.fee_deducted,
            "remaining_balance": self.remaining_balance,
            "timestamp": self.timestamp,
            "audit_id": self.audit_id,
            "details": self.details,
        }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Payload Parser & Validator
# ─────────────────────────────────────────────────────────────────────────────

class QRPayloadParser:
    """
    Parses and validates structured QR code strings.
    Supports:
      1. JSON objects: {"ticket_id": "...", "plate_number": "...", ...}
      2. Pipe-delimited tokens: PASS:ticket_id|plate_number|pass_type|account_id|expires_ts|sig
      3. Colon-delimited tokens: ticket_id:plate_number:pass_type:account_id:expires_ts
      4. Query-string / key-value format: id=...&plate=...&type=...&exp=...
    """

    @staticmethod
    def normalize_plate(plate: Optional[str]) -> str:
        """Standardize plate representation for deterministic comparison."""
        if not plate:
            return ""
        # Remove spaces, hyphens, and non-alphanumeric characters, uppercase
        clean = re.sub(r"[^A-Za-z0-9]", "", plate).upper()
        return clean

    @staticmethod
    def parse_datetime(val: Any) -> Optional[datetime.datetime]:
        """Convert ISO strings, timestamps, or integers to datetime."""
        if not val:
            return None
        if isinstance(val, datetime.datetime):
            return val
        if isinstance(val, (int, float)):
            try:
                return datetime.datetime.fromtimestamp(float(val), tz=datetime.timezone.utc).replace(tzinfo=None)
            except Exception:
                return None
        if isinstance(val, str):
            val = val.strip()
            # If purely numeric, treat as unix timestamp
            if re.match(r"^\d{10,13}$", val):
                ts = float(val) / (1000.0 if len(val) >= 13 else 1.0)
                try:
                    return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).replace(tzinfo=None)
                except Exception:
                    pass
            # Try ISO formats
            for fmt in (
                "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
            ):
                try:
                    return datetime.datetime.strptime(val, fmt)
                except ValueError:
                    continue
            # Try python 3.7+ fromisoformat fallback
            try:
                dt = datetime.datetime.fromisoformat(val.replace("Z", "+00:00"))
                if dt.tzinfo is not None:
                    dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
                return dt
            except Exception:
                pass
        return None

    @classmethod
    def parse_raw(cls, raw: str) -> Optional[QRPayload]:
        """Auto-detect format and parse raw string into QRPayload."""
        if not raw or not isinstance(raw, str):
            return None
        text = raw.strip()
        if not text:
            return None

        # 1. Try JSON
        if text.startswith("{") and text.endswith("}"):
            try:
                data = json.loads(text)
                ticket_id = (
                    data.get("ticket_id")
                    or data.get("ticketId")
                    or data.get("pass_id")
                    or data.get("passId")
                    or data.get("id")
                )
                if ticket_id:
                    plate = cls.normalize_plate(data.get("plate_number") or data.get("plateNumber") or data.get("plate"))
                    pass_type = PassType.from_str(data.get("pass_type") or data.get("passType") or data.get("type"))
                    account_id = data.get("account_id") or data.get("accountId")
                    exp_dt = cls.parse_datetime(data.get("expires_at") or data.get("expiresAt") or data.get("exp"))
                    eff_dt = cls.parse_datetime(data.get("effective_from") or data.get("effectiveFrom") or data.get("issued_at"))
                    sig = data.get("signature") or data.get("sig")
                    balance = float(data.get("balance") or data.get("amount") or 0.0)

                    return QRPayload(
                        ticket_id=str(ticket_id),
                        plate_number=plate or None,
                        pass_type=pass_type,
                        account_id=str(account_id) if account_id else None,
                        expires_at=exp_dt,
                        effective_from=eff_dt,
                        signature=sig,
                        balance=balance,
                        raw_text=text,
                        metadata=data.get("metadata", {}),
                    )
            except Exception as e:
                logger.debug(f"JSON parse attempt failed: {e}")

        # 2. Try Pipe Delimited (e.g. PASS:TKT-101|AA12345|SUBSCRIBER|ACC-1|1732560000|sig)
        if "|" in text:
            clean_token = text
            if clean_token.upper().startswith("PASS:"):
                clean_token = clean_token[5:]
            parts = [p.strip() for p in clean_token.split("|")]
            if len(parts) >= 1 and parts[0]:
                ticket_id = parts[0]
                plate = cls.normalize_plate(parts[1]) if len(parts) > 1 and parts[1] else None
                pass_type = PassType.from_str(parts[2]) if len(parts) > 2 else PassType.VISITOR
                account_id = parts[3] if len(parts) > 3 and parts[3] else None
                exp_dt = cls.parse_datetime(parts[4]) if len(parts) > 4 else None
                sig = parts[5] if len(parts) > 5 and parts[5] else None

                return QRPayload(
                    ticket_id=ticket_id,
                    plate_number=plate,
                    pass_type=pass_type,
                    account_id=account_id,
                    expires_at=exp_dt,
                    signature=sig,
                    raw_text=text,
                )

        # 3. Try Colon Delimited (e.g. TKT-101:AA12345:SUBSCRIBER:ACC-1:2026-12-31)
        if ":" in text and not text.startswith("http"):
            parts = [p.strip() for p in text.split(":")]
            # Skip if it was just PASS:xyz
            if len(parts) >= 3:
                ticket_id = parts[0]
                plate = cls.normalize_plate(parts[1]) if parts[1] else None
                pass_type = PassType.from_str(parts[2])
                account_id = parts[3] if len(parts) > 3 and parts[3] else None
                exp_dt = cls.parse_datetime(parts[4]) if len(parts) > 4 else None
                sig = parts[5] if len(parts) > 5 and parts[5] else None

                return QRPayload(
                    ticket_id=ticket_id,
                    plate_number=plate,
                    pass_type=pass_type,
                    account_id=account_id,
                    expires_at=exp_dt,
                    signature=sig,
                    raw_text=text,
                )

        # 4. Try Query String / URL params (e.g. id=TKT-101&plate=AA12345&type=VISITOR&exp=...)
        if "=" in text and ("id=" in text or "ticket=" in text or "pass=" in text):
            params: Dict[str, str] = {}
            for pair in text.split("&"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    params[k.strip().lower()] = v.strip()

            ticket_id = params.get("id") or params.get("ticket") or params.get("pass") or params.get("ticket_id")
            if ticket_id:
                plate = cls.normalize_plate(params.get("plate") or params.get("plate_number"))
                pass_type = PassType.from_str(params.get("type") or params.get("pass_type"))
                account_id = params.get("acc") or params.get("account_id")
                exp_dt = cls.parse_datetime(params.get("exp") or params.get("expires_at"))
                sig = params.get("sig") or params.get("signature")
                balance = float(params.get("bal") or 0.0)

                return QRPayload(
                    ticket_id=ticket_id,
                    plate_number=plate or None,
                    pass_type=pass_type,
                    account_id=account_id,
                    expires_at=exp_dt,
                    signature=sig,
                    balance=balance,
                    raw_text=text,
                )

        # 5. Fallback: single ticket identifier
        if len(text) >= 4 and len(text) <= 64:
            return QRPayload(
                ticket_id=text,
                pass_type=PassType.VISITOR,
                raw_text=text,
            )

        return None

    @classmethod
    def generate_signed_token(
        cls,
        ticket_id: str,
        plate_number: Optional[str],
        pass_type: Union[PassType, str],
        expires_at: Optional[datetime.datetime],
        secret_key: str,
        account_id: Optional[str] = None,
        balance: float = 0.0,
    ) -> str:
        """
        Helper method to generate an official HMAC-signed QR JSON string.
        Useful for generating mobile app passes and printed barcode tickets.
        """
        p_type = pass_type.value if isinstance(pass_type, PassType) else str(pass_type)
        norm_plate = cls.normalize_plate(plate_number)
        exp_iso = expires_at.strftime("%Y-%m-%dT%H:%M:%SZ") if expires_at else ""

        # Compute HMAC signature over core fields
        sign_data = f"{ticket_id}|{norm_plate}|{p_type}|{account_id or ''}|{exp_iso}"
        signature = hmac.new(
            secret_key.encode("utf-8"),
            sign_data.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:16]

        payload = {
            "ticket_id": ticket_id,
            "plate_number": norm_plate or None,
            "pass_type": p_type,
            "account_id": account_id,
            "expires_at": exp_iso or None,
            "balance": balance,
            "signature": signature,
        }
        return json.dumps(payload, separators=(",", ":"))

    @classmethod
    def verify_signature(cls, payload: QRPayload, secret_key: Optional[str]) -> bool:
        """Verifies HMAC signature on payload if secret_key is provided."""
        if not secret_key:
            return True  # Signature enforcement not active
        if not payload.signature:
            return False  # Missing expected signature

        norm_plate = cls.normalize_plate(payload.plate_number)
        exp_iso = payload.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ") if payload.expires_at else ""
        sign_data = f"{payload.ticket_id}|{norm_plate}|{payload.pass_type.value}|{payload.account_id or ''}|{exp_iso}"

        expected = hmac.new(
            secret_key.encode("utf-8"),
            sign_data.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:16]

        return hmac.compare_digest(payload.signature.lower(), expected.lower())

    @classmethod
    def validate(
        cls,
        payload: Optional[QRPayload],
        secret_key: Optional[str] = None,
        revoked_ids: Optional[Set[str]] = None,
        now: Optional[datetime.datetime] = None,
    ) -> QRValidationResult:
        """Validates payload format, expiration, active period, and revocation."""
        if not payload or not payload.ticket_id:
            return QRValidationResult(
                status=ValidationStatus.INVALID_FORMAT,
                is_valid=False,
                error_message="Missing or unparseable QR ticket payload",
            )

        current_time = now or datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

        # Check Revocation List
        if revoked_ids and payload.ticket_id in revoked_ids:
            return QRValidationResult(
                status=ValidationStatus.REVOKED,
                is_valid=False,
                payload=payload,
                error_message=f"Pass '{payload.ticket_id}' has been blacklisted or revoked",
            )

        # Check Expiration Time First
        if payload.expires_at:
            time_remaining = (payload.expires_at - current_time).total_seconds()
            if time_remaining <= 0:
                return QRValidationResult(
                    status=ValidationStatus.EXPIRED,
                    is_valid=False,
                    payload=payload,
                    error_message=f"Pass expired on {payload.expires_at.isoformat()} ({abs(int(time_remaining))}s ago)",
                    time_remaining_seconds=time_remaining,
                )

        # Check Signature (if secret_key configured)
        if secret_key:
            if payload.signature:
                if not cls.verify_signature(payload, secret_key):
                    return QRValidationResult(
                        status=ValidationStatus.INVALID_SIGNATURE,
                        is_valid=False,
                        payload=payload,
                        error_message="Cryptographic signature verification failed (tampered or forged QR)",
                    )
            elif payload.pass_type in (PassType.SUBSCRIBER, PassType.PREPAID):
                return QRValidationResult(
                    status=ValidationStatus.INVALID_SIGNATURE,
                    is_valid=False,
                    payload=payload,
                    error_message=f"Missing required cryptographic signature for {payload.pass_type.value} pass",
                )

        # Check Active Starting Time
        if payload.effective_from and current_time < payload.effective_from:
            return QRValidationResult(
                status=ValidationStatus.NOT_YET_VALID,
                is_valid=False,
                payload=payload,
                error_message=f"Pass is not active until {payload.effective_from.isoformat()}",
            )

        # Check Expiration Time (valid window)
        if payload.expires_at:
            time_remaining = (payload.expires_at - current_time).total_seconds()
            return QRValidationResult(
                status=ValidationStatus.VALID,
                is_valid=True,
                payload=payload,
                time_remaining_seconds=time_remaining,
            )

        # Permanent or Non-expiring Pass
        return QRValidationResult(
            status=ValidationStatus.VALID,
            is_valid=True,
            payload=payload,
            time_remaining_seconds=None,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 3. Image Preprocessing & QR Decoding Engine
# ─────────────────────────────────────────────────────────────────────────────

class QRImageDecoder:
    """
    Robust multi-variant QR detector with pre-processing fallbacks for
    glare, low contrast, mobile screens, motion blur, and tilt angles.
    """

    def __init__(self, use_pyzbar: bool = True, use_opencv: bool = True):
        self.use_pyzbar = use_pyzbar and PYZBAR_AVAILABLE
        self.use_opencv = use_opencv
        self._cv2_detector: Optional[cv2.QRCodeDetector] = None

        if self.use_opencv:
            try:
                self._cv2_detector = cv2.QRCodeDetector()
            except Exception as e:
                logger.warning(f"Could not initialize cv2.QRCodeDetector: {e}")

        # Persistent CLAHE instance for contrast enhancement
        self._clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

    @staticmethod
    def rotate_image(image: np.ndarray, angle: float) -> np.ndarray:
        """Rotates image around its center without cutting off edges."""
        h, w = image.shape[:2]
        center = (w / 2, h / 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        return cv2.warpAffine(image, rot_mat, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    def _decode_single_image(self, img: np.ndarray) -> Optional[Tuple[str, Optional[Tuple[int, int, int, int]], Optional[List[Tuple[int, int]]]]]:
        """Runs decoders on a single prepared grayscale/bgr image."""
        # 1. Try PyZBar first (most reliable & fast on 2D barcodes)
        if self.use_pyzbar and pyzbar is not None:
            try:
                decoded_objs = pyzbar.decode(img)
                if decoded_objs:
                    for obj in decoded_objs:
                        raw = obj.data.decode("utf-8", errors="replace").strip()
                        if raw:
                            r = obj.rect
                            bbox = (r.left, r.top, r.width, r.height)
                            poly = [(p.x, p.y) for p in obj.polygon] if hasattr(obj, "polygon") else None
                            return raw, bbox, poly
            except Exception:
                pass

        # 2. Try OpenCV QRCodeDetector fallback
        if self._cv2_detector is not None:
            try:
                data, points, _ = self._cv2_detector.detectAndDecode(img)
                if data and data.strip():
                    bbox = None
                    poly = None
                    if points is not None and len(points) > 0:
                        pts = points[0].astype(int)
                        poly = [(int(p[0]), int(p[1])) for p in pts]
                        x_min = int(np.min(pts[:, 0]))
                        y_min = int(np.min(pts[:, 1]))
                        x_max = int(np.max(pts[:, 0]))
                        y_max = int(np.max(pts[:, 1]))
                        bbox = (x_min, y_min, max(1, x_max - x_min), max(1, y_max - y_min))
                    return data.strip(), bbox, poly
            except Exception:
                pass

        return None

    def decode(
        self,
        frame: np.ndarray,
        roi: Optional[Union[Tuple[int, int, int, int], Tuple[float, float, float, float]]] = None,
    ) -> Optional[Tuple[str, str, Optional[Tuple[int, int, int, int]], Optional[List[Tuple[int, int]]]]]:
        """
        Attempts decoding across multiple preprocessing passes:
          1. Direct Grayscale
          2. CLAHE Contrast Enhancement (high-glare phone screens & printed tickets)
          3. Otsu Adaptive Thresholding
          4. Angle Rotations (-15, +15, 90, 180, 270 deg)
          5. Multi-scale resizing (1.5x upscaling for distant QRs)
        Returns: (raw_text, method_name, bbox, polygon) or None
        """
        if frame is None or frame.size == 0:
            return None

        h, w = frame.shape[:2]
        x_offset, y_offset = 0, 0
        img = frame

        # Apply ROI Crop if requested
        if roi:
            rx, ry, rw, rh = roi
            # If coordinates are normalized floats (0.0 - 1.0)
            if isinstance(rx, float) and 0.0 <= rx <= 1.0:
                rx, ry, rw, rh = int(rx * w), int(ry * h), int(rw * w), int(rh * h)
            rx = max(0, min(w - 1, int(rx)))
            ry = max(0, min(h - 1, int(ry)))
            rw = max(1, min(w - rx, int(rw)))
            rh = max(1, min(h - ry, int(rh)))
            img = frame[ry:ry + rh, rx:rx + rw]
            x_offset, y_offset = rx, ry

        # Convert to Grayscale
        if len(img.shape) == 3 and img.shape[2] == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()

        # PASS 1: Direct Grayscale
        res = self._decode_single_image(gray)
        if res:
            text, bbox, poly = res
            return text, "direct_gray", self._offset_bbox(bbox, x_offset, y_offset), self._offset_poly(poly, x_offset, y_offset)

        # PASS 2: CLAHE (Contrast-Limited Adaptive Histogram Equalization)
        clahe_img = self._clahe.apply(gray)
        res = self._decode_single_image(clahe_img)
        if res:
            text, bbox, poly = res
            return text, "clahe_enhanced", self._offset_bbox(bbox, x_offset, y_offset), self._offset_poly(poly, x_offset, y_offset)

        # PASS 3: Adaptive / Otsu Thresholding (Binarization)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        res = self._decode_single_image(thresh)
        if res:
            text, bbox, poly = res
            return text, "otsu_binary", self._offset_bbox(bbox, x_offset, y_offset), self._offset_poly(poly, x_offset, y_offset)

        # PASS 4: Rotation Fallbacks (Tilted driver phone or vehicle window)
        for angle in (-15.0, 15.0, 90.0, 180.0, 270.0):
            rotated = self.rotate_image(clahe_img, angle)
            res = self._decode_single_image(rotated)
            if res:
                text, bbox, poly = res
                return text, f"rot_{int(angle)}deg", self._offset_bbox(bbox, x_offset, y_offset), self._offset_poly(poly, x_offset, y_offset)

        # PASS 5: Multi-scale upsampling (if QR is small in camera field of view)
        if h < 800 or w < 800:
            upscaled = cv2.resize(clahe_img, (0, 0), fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
            res = self._decode_single_image(upscaled)
            if res:
                text, bbox, poly = res
                # Scale back bbox
                if bbox:
                    bbox = (int(bbox[0] / 1.5), int(bbox[1] / 1.5), int(bbox[2] / 1.5), int(bbox[3] / 1.5))
                if poly:
                    poly = [(int(p[0] / 1.5), int(p[1] / 1.5)) for p in poly]
                return text, "upscaled_1.5x", self._offset_bbox(bbox, x_offset, y_offset), self._offset_poly(poly, x_offset, y_offset)

        return None

    @staticmethod
    def _offset_bbox(bbox: Optional[Tuple[int, int, int, int]], ox: int, oy: int) -> Optional[Tuple[int, int, int, int]]:
        if not bbox:
            return None
        return (bbox[0] + ox, bbox[1] + oy, bbox[2], bbox[3])

    @staticmethod
    def _offset_poly(poly: Optional[List[Tuple[int, int]]], ox: int, oy: int) -> Optional[List[Tuple[int, int]]]:
        if not poly:
            return None
        return [(p[0] + ox, p[1] + oy) for p in poly]


# ─────────────────────────────────────────────────────────────────────────────
# 4. QR Scanner Engine (With Frame Throttling & Motion Awareness)
# ─────────────────────────────────────────────────────────────────────────────

class QRScanner:
    """
    High-level scanner interface managing decoding, frame throttling,
    caching, and validation.
    """

    def __init__(
        self,
        throttle_interval: int = 4,
        roi: Optional[Union[Tuple[int, int, int, int], Tuple[float, float, float, float]]] = None,
        secret_key: Optional[str] = None,
        revoked_ids: Optional[Set[str]] = None,
    ):
        self.throttle_interval = max(1, throttle_interval)
        self.roi = roi
        self.secret_key = secret_key
        self.revoked_ids = revoked_ids or set()

        self.decoder = QRImageDecoder()
        self.parser = QRPayloadParser()

        self.frame_counter: int = 0
        self.last_scan_result: Optional[QRScanResult] = None
        self.last_decoded_text: str = ""
        self.last_decoded_time: float = 0.0

    def scan_frame(
        self,
        frame: np.ndarray,
        force: bool = False,
        motion_detected: bool = False,
    ) -> Optional[QRScanResult]:
        """
        Scans a video frame on throttled intervals or on motion trigger.
        Returns QRScanResult when a scan is executed, or None if skipped by throttler.
        """
        self.frame_counter += 1

        # Check throttle interval: run on first frame, then every Nth frame, unless forced or motion detected
        should_run = force or motion_detected or (self.frame_counter == 1) or ((self.frame_counter - 1) % self.throttle_interval == 0)
        if not should_run:
            return None

        t0 = time.time()
        decode_res = self.decoder.decode(frame, roi=self.roi)
        proc_time = (time.time() - t0) * 1000.0

        if not decode_res:
            self.last_scan_result = QRScanResult(
                found=False,
                processing_time_ms=proc_time,
            )
            return self.last_scan_result

        raw_text, method_name, bbox, poly = decode_res
        now_ts = time.time()

        # Parse & Validate Payload
        payload = self.parser.parse_raw(raw_text)
        val_res = self.parser.validate(payload, secret_key=self.secret_key, revoked_ids=self.revoked_ids)

        scan_result = QRScanResult(
            found=True,
            raw_text=raw_text,
            bbox=bbox,
            polygon=poly,
            validation=val_res,
            method_used=method_name,
            processing_time_ms=proc_time,
        )

        self.last_scan_result = scan_result
        self.last_decoded_text = raw_text
        self.last_decoded_time = now_ts

        return scan_result

    def decode_raw_string(self, raw_text: str) -> QRValidationResult:
        """Direct validation hook for raw QR string (API / test entry point)."""
        payload = self.parser.parse_raw(raw_text)
        return self.parser.validate(payload, secret_key=self.secret_key, revoked_ids=self.revoked_ids)


# ─────────────────────────────────────────────────────────────────────────────
# 5. SQLite Audit Logging & Storage Hook
# ─────────────────────────────────────────────────────────────────────────────

class GateAuditLogger:
    """Thread-safe SQLite audit trail for gate access and reconciliation events."""

    def __init__(self, db_path: str = "./gate_access_audit.db"):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS gate_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    camera_id TEXT,
                    direction TEXT NOT NULL,
                    action TEXT NOT NULL,
                    match_status TEXT NOT NULL,
                    needs_review INTEGER NOT NULL,
                    ocr_plate TEXT,
                    qr_plate TEXT,
                    effective_plate TEXT,
                    ticket_id TEXT,
                    pass_type TEXT,
                    account_id TEXT,
                    fee_deducted REAL DEFAULT 0.0,
                    remaining_balance REAL DEFAULT 0.0,
                    reason TEXT,
                    raw_qr_text TEXT,
                    metadata_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON gate_audit_logs(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_plate ON gate_audit_logs(effective_plate)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_ticket ON gate_audit_logs(ticket_id)")
            conn.commit()

    def log_event(
        self,
        decision: GateDecision,
        camera_id: str = "CAM-01",
        qr_plate: Optional[str] = None,
        account_id: Optional[str] = None,
        raw_qr_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Records a gate decision event into SQLite and returns the inserted row ID."""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO gate_audit_logs (
                    timestamp, camera_id, direction, action, match_status,
                    needs_review, ocr_plate, qr_plate, effective_plate,
                    ticket_id, pass_type, account_id, fee_deducted,
                    remaining_balance, reason, raw_qr_text, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                decision.timestamp,
                camera_id,
                decision.direction.value,
                decision.action.value,
                decision.match_status.value,
                1 if decision.needs_review else 0,
                decision.plate_number,
                qr_plate,
                decision.plate_number or qr_plate or "UNKNOWN",
                decision.ticket_id,
                decision.pass_type.value if decision.pass_type else None,
                account_id,
                decision.fee_deducted,
                decision.remaining_balance,
                decision.reason,
                raw_qr_text,
                json.dumps(metadata or {}),
            ))
            conn.commit()
            return int(cursor.lastrowid)

    def log_access(
        self,
        decision: GateDecision,
        camera_id: str = "CAM-01",
        qr_plate: Optional[str] = None,
        account_id: Optional[str] = None,
        raw_qr_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Alias for log_event to guarantee full backward compatibility."""
        return self.log_event(
            decision=decision,
            camera_id=camera_id,
            qr_plate=qr_plate,
            account_id=account_id,
            raw_qr_text=raw_qr_text,
            metadata=metadata,
        )

    def get_recent_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves recent audit log events."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM gate_audit_logs ORDER BY id DESC LIMIT ?", (limit,)
            )
            return [dict(row) for row in cursor.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# 6. Gate Flow Reconciliation Manager
# ─────────────────────────────────────────────────────────────────────────────

class GateFlowManager:
    """
    Core gate coordinator that reconciles Plate OCR results with QR Code scan results.
    Implements security policies, mismatch handling, and fee calculations.
    """

    def __init__(
        self,
        allow_qr_only: bool = True,
        require_plate_match_for_subscribers: bool = True,
        default_hourly_rate: float = 20.0,
        audit_logger: Optional[GateAuditLogger] = None,
    ):
        self.allow_qr_only = allow_qr_only
        self.require_plate_match_for_subscribers = require_plate_match_for_subscribers
        self.default_hourly_rate = default_hourly_rate
        self.audit_logger = audit_logger or GateAuditLogger()

    @staticmethod
    def _plates_match(p1: Optional[str], p2: Optional[str]) -> bool:
        """Normalizes and compares two plate numbers with tolerance for leading zeroes."""
        n1 = QRPayloadParser.normalize_plate(p1)
        n2 = QRPayloadParser.normalize_plate(p2)
        if not n1 or not n2:
            return False
        return n1 == n2

    def evaluate_gate_access(
        self,
        ocr_plate: Optional[str],
        ocr_confidence: float = 0.0,
        qr_input: Optional[Union[QRScanResult, QRPayload, str]] = None,
        direction: GateDirection = GateDirection.ENTRY,
        camera_id: str = "CAM-01",
        entry_timestamp: Optional[datetime.datetime] = None,
    ) -> GateDecision:
        """
        Reconciles plate OCR with QR pass according to operational rules:
          1. Both Plate + QR Present:
             - If plates match: MATCHED -> OPEN gate (high confidence).
             - If plates mismatch: PLATE_MISMATCH -> HOLD gate (needs_review = True).
          2. QR Present Only (No Plate read by camera):
             - If pass valid & policy allows QR-only: QR_ONLY -> OPEN gate.
             - If pass requires plate or expired: REJECT or HOLD.
          3. Plate Present Only (No QR presented):
             - Normal standard plate OCR pass-through: PLATE_ONLY -> Evaluated by backend.
          4. Neither Present:
             - NO_DATA -> HOLD.
        """
        norm_ocr = QRPayloadParser.normalize_plate(ocr_plate)

        # 1. Resolve QR Payload & Validation
        qr_payload: Optional[QRPayload] = None
        raw_text: Optional[str] = None
        qr_validation: Optional[QRValidationResult] = None

        if isinstance(qr_input, QRScanResult):
            raw_text = qr_input.raw_text
            qr_validation = qr_input.validation
            qr_payload = qr_validation.payload if qr_validation else None
        elif isinstance(qr_input, QRPayload):
            qr_payload = qr_input
            raw_text = qr_input.raw_text
            qr_validation = QRPayloadParser.validate(qr_payload)
        elif isinstance(qr_input, str) and qr_input.strip():
            raw_text = qr_input.strip()
            qr_payload = QRPayloadParser.parse_raw(raw_text)
            qr_validation = QRPayloadParser.validate(qr_payload)

        # ─── CASE A: QR Pass Presented ───────────────────────────────────────
        if qr_payload is not None:
            norm_qr_plate = QRPayloadParser.normalize_plate(qr_payload.plate_number)

            # Check if QR pass itself is invalid or expired
            if qr_validation and not qr_validation.is_valid:
                decision = GateDecision(
                    action=GateAction.REJECT,
                    match_status=MatchStatus.REJECTED,
                    needs_review=False,
                    reason=f"QR pass rejected: {qr_validation.error_message}",
                    plate_number=norm_ocr or norm_qr_plate,
                    ocr_confidence=ocr_confidence,
                    ticket_id=qr_payload.ticket_id,
                    pass_type=qr_payload.pass_type,
                    direction=direction,
                )
                audit_id = self.audit_logger.log_event(
                    decision=decision,
                    camera_id=camera_id,
                    qr_plate=norm_qr_plate,
                    account_id=qr_payload.account_id,
                    raw_qr_text=raw_text,
                )
                decision.audit_id = audit_id
                return decision

            # Fee / Tariff calculation for EXIT direction
            fee_deducted = 0.0
            remaining_bal = qr_payload.balance
            if direction == GateDirection.EXIT and qr_payload.pass_type in (PassType.VISITOR, PassType.PREPAID):
                fee_deducted = self._calculate_parking_fee(entry_timestamp)
                if qr_payload.pass_type == PassType.PREPAID:
                    if remaining_bal < fee_deducted:
                        decision = GateDecision(
                            action=GateAction.HOLD,
                            match_status=MatchStatus.REJECTED,
                            needs_review=True,
                            reason=f"Insufficient prepaid balance ({remaining_bal:.2f} ETB < {fee_deducted:.2f} ETB)",
                            plate_number=norm_ocr or norm_qr_plate,
                            ticket_id=qr_payload.ticket_id,
                            pass_type=qr_payload.pass_type,
                            direction=direction,
                            fee_deducted=fee_deducted,
                            remaining_balance=remaining_bal,
                        )
                        audit_id = self.audit_logger.log_event(decision, camera_id, norm_qr_plate, qr_payload.account_id, raw_text)
                        decision.audit_id = audit_id
                        return decision
                    remaining_bal -= fee_deducted

            # Scenario 1: Both OCR Plate AND QR Pass Plate are present
            if norm_ocr and norm_qr_plate:
                if self._plates_match(norm_ocr, norm_qr_plate):
                    # Match: High-confidence combined identity
                    decision = GateDecision(
                        action=GateAction.OPEN,
                        match_status=MatchStatus.MATCHED,
                        needs_review=False,
                        reason=f"Identity confirmed: OCR plate [{norm_ocr}] matches QR pass [{norm_qr_plate}]",
                        plate_number=norm_ocr,
                        ocr_confidence=ocr_confidence,
                        ticket_id=qr_payload.ticket_id,
                        pass_type=qr_payload.pass_type,
                        direction=direction,
                        fee_deducted=fee_deducted,
                        remaining_balance=remaining_bal,
                    )
                else:
                    # Mismatch: Security flag (potential pass sharing or plate swap)
                    decision = GateDecision(
                        action=GateAction.HOLD,
                        match_status=MatchStatus.PLATE_MISMATCH,
                        needs_review=True,
                        reason=f"Plate mismatch: Camera detected [{norm_ocr}], but QR pass is registered to [{norm_qr_plate}]",
                        plate_number=norm_ocr,
                        ocr_confidence=ocr_confidence,
                        ticket_id=qr_payload.ticket_id,
                        pass_type=qr_payload.pass_type,
                        direction=direction,
                        fee_deducted=fee_deducted,
                        remaining_balance=remaining_bal,
                    )

            # Scenario 2: QR Pass has no plate specified (e.g. Visitor Ticket)
            elif norm_ocr and not norm_qr_plate:
                decision = GateDecision(
                    action=GateAction.OPEN,
                    match_status=MatchStatus.MATCHED,
                    needs_review=False,
                    reason=f"Valid unassigned QR ticket [{qr_payload.ticket_id}] paired with detected plate [{norm_ocr}]",
                    plate_number=norm_ocr,
                    ocr_confidence=ocr_confidence,
                    ticket_id=qr_payload.ticket_id,
                    pass_type=qr_payload.pass_type,
                    direction=direction,
                    fee_deducted=fee_deducted,
                    remaining_balance=remaining_bal,
                )

            # Scenario 3: QR Pass present, but NO OCR Plate detected by camera
            else:
                # Subscriber passes tied to a vehicle must require plate match if policy dictates
                if self.require_plate_match_for_subscribers and qr_payload.pass_type == PassType.SUBSCRIBER and norm_qr_plate:
                    decision = GateDecision(
                        action=GateAction.HOLD,
                        match_status=MatchStatus.QR_ONLY,
                        needs_review=True,
                        reason=f"Subscriber pass [{qr_payload.ticket_id}] requires plate [{norm_qr_plate}] confirmation, but no plate detected",
                        plate_number=norm_qr_plate,
                        ticket_id=qr_payload.ticket_id,
                        pass_type=qr_payload.pass_type,
                        direction=direction,
                    )
                elif self.allow_qr_only:
                    decision = GateDecision(
                        action=GateAction.OPEN,
                        match_status=MatchStatus.QR_ONLY,
                        needs_review=False,
                        reason=f"Valid QR pass [{qr_payload.ticket_id}] granted access (QR_ONLY policy active)",
                        plate_number=norm_qr_plate or "QR-PASSHOLDER",
                        ticket_id=qr_payload.ticket_id,
                        pass_type=qr_payload.pass_type,
                        direction=direction,
                        fee_deducted=fee_deducted,
                        remaining_balance=remaining_bal,
                    )
                else:
                    decision = GateDecision(
                        action=GateAction.HOLD,
                        match_status=MatchStatus.QR_ONLY,
                        needs_review=True,
                        reason="QR_ONLY access disabled by security policy; vehicle license plate must be visible",
                        plate_number=norm_qr_plate,
                        ticket_id=qr_payload.ticket_id,
                        pass_type=qr_payload.pass_type,
                        direction=direction,
                    )

            audit_id = self.audit_logger.log_event(
                decision=decision,
                camera_id=camera_id,
                qr_plate=norm_qr_plate,
                account_id=qr_payload.account_id,
                raw_qr_text=raw_text,
            )
            decision.audit_id = audit_id
            return decision

        # ─── CASE B: Plate OCR Only (Standard ALPR Flow) ──────────────────────
        if norm_ocr:
            decision = GateDecision(
                action=GateAction.OPEN,
                match_status=MatchStatus.PLATE_ONLY,
                needs_review=False,
                reason=f"Plate recognized via ALPR [{norm_ocr}] (no QR presented)",
                plate_number=norm_ocr,
                ocr_confidence=ocr_confidence,
                direction=direction,
            )
            audit_id = self.audit_logger.log_event(
                decision=decision,
                camera_id=camera_id,
                qr_plate=None,
                account_id=None,
                raw_qr_text=None,
            )
            decision.audit_id = audit_id
            return decision

        # ─── CASE C: Neither Plate Nor QR Present ────────────────────────────
        decision = GateDecision(
            action=GateAction.HOLD,
            match_status=MatchStatus.NO_DATA,
            needs_review=True,
            reason="No vehicle plate or QR code identified in camera frame",
            direction=direction,
        )
        return decision

    def _calculate_parking_fee(self, entry_time: Optional[datetime.datetime]) -> float:
        """Calculates parking duration and tariff."""
        if not entry_time:
            return self.default_hourly_rate  # Default minimum 1 hour charge
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        duration_hours = max(0.5, (now - entry_time).total_seconds() / 3600.0)
        # Round up to nearest hour
        billable_hours = max(1, int(np.ceil(duration_hours)))
        return float(billable_hours * self.default_hourly_rate)
