"""
qr_repository.py - SQLite Repository for QR Pass Lifecycle & Audit Logging.

Manages persistent database storage for:
- qr_passes: Active/historical digital vehicle transit passes.
- qr_audit_logs: Immutable audit trail for pass issuance, renewals, plate reassignments,
  suspensions, revocations, and gate verification usages.
"""

import sqlite3
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger("QRRepository")

@dataclass
class QRPassRecord:
    pass_id: str
    plate_number: str
    pass_type: str  # VISITOR, SUBSCRIBER, PREPAID, STAFF, VIP
    holder_name: str
    account_id: Optional[str]
    status: str  # ACTIVE, USED, EXPIRED, REVOKED, SUSPENDED
    max_uses: int  # 0 or negative = unlimited, 1 = single-use, N = multi-use
    use_count: int
    issued_at: str
    valid_from: str
    expires_at: str
    revoked_at: Optional[str] = None
    revocation_reason: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    metadata: Optional[str] = None  # JSON string for extra fields

@dataclass
class QRAuditLogRecord:
    id: Optional[int]
    timestamp: str
    pass_id: str
    action: str  # ISSUE, RENEW, REASSIGN, SUSPEND, REACTIVATE, REVOKE, SCAN_USE, BATCH_ISSUE
    operator_id: str
    details: Dict[str, Any]

class QRRepository:
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(base_dir, "qr_passes.db")
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initializes tables and indexes for qr_passes and qr_audit_logs."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS qr_passes (
                    pass_id TEXT PRIMARY KEY,
                    plate_number TEXT NOT NULL,
                    pass_type TEXT NOT NULL,
                    holder_name TEXT NOT NULL,
                    account_id TEXT,
                    status TEXT NOT NULL DEFAULT 'ACTIVE',
                    max_uses INTEGER NOT NULL DEFAULT 1,
                    use_count INTEGER NOT NULL DEFAULT 0,
                    issued_at TEXT NOT NULL,
                    valid_from TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT,
                    revocation_reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS qr_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    pass_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    operator_id TEXT NOT NULL,
                    details TEXT NOT NULL
                )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_passes_plate ON qr_passes(plate_number)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_passes_status ON qr_passes(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_passes_type ON qr_passes(pass_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_audit_pass ON qr_audit_logs(pass_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_audit_time ON qr_audit_logs(timestamp)")
            conn.commit()

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def create_pass(self, record: QRPassRecord, operator_id: str = "SYSTEM") -> QRPassRecord:
        """Inserts a new QR pass record and writes an ISSUE audit log."""
        now = self.now_iso()
        record.created_at = record.created_at or now
        record.updated_at = record.updated_at or now
        record.issued_at = record.issued_at or now
        record.plate_number = (record.plate_number or "").strip().upper()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO qr_passes (
                    pass_id, plate_number, pass_type, holder_name, account_id,
                    status, max_uses, use_count, issued_at, valid_from, expires_at,
                    revoked_at, revocation_reason, created_at, updated_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.pass_id,
                record.plate_number,
                record.pass_type,
                record.holder_name,
                record.account_id,
                record.status,
                record.max_uses,
                record.use_count,
                record.issued_at,
                record.valid_from,
                record.expires_at,
                record.revoked_at,
                record.revocation_reason,
                record.created_at,
                record.updated_at,
                record.metadata,
            ))

            # Audit log
            details_json = json.dumps({
                "plate_number": record.plate_number,
                "pass_type": record.pass_type,
                "holder_name": record.holder_name,
                "max_uses": record.max_uses,
                "expires_at": record.expires_at,
            })
            cursor.execute("""
                INSERT INTO qr_audit_logs (timestamp, pass_id, action, operator_id, details)
                VALUES (?, ?, 'ISSUE', ?, ?)
            """, (now, record.pass_id, operator_id, details_json))

            conn.commit()
            logger.info(f"✅ Created QR Pass {record.pass_id} for plate [{record.plate_number}] ({record.pass_type})")
            return record

    def get_pass(self, pass_id: str) -> Optional[QRPassRecord]:
        """Retrieves a pass by pass_id."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM qr_passes WHERE pass_id = ?", (pass_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_record(row)

    def get_pass_by_plate(self, plate_number: str) -> Optional[QRPassRecord]:
        """Retrieves the most recent active pass for a given plate number."""
        norm_plate = (plate_number or "").strip().upper()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM qr_passes 
                WHERE plate_number = ? AND status = 'ACTIVE'
                ORDER BY created_at DESC LIMIT 1
            """, (norm_plate,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_record(row)

    def list_passes(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        pass_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[QRPassRecord]:
        """Lists passes with optional filtering and pagination."""
        query = "SELECT * FROM qr_passes WHERE 1=1"
        params: List[Any] = []

        if status:
            query += " AND status = ?"
            params.append(status.upper())
        if pass_type:
            query += " AND pass_type = ?"
            params.append(pass_type.upper())
        if search:
            query += " AND (pass_id LIKE ? OR plate_number LIKE ? OR holder_name LIKE ?)"
            s = f"%{search}%"
            params.extend([s, s, s])

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_record(r) for r in rows]

    def renew_pass(self, pass_id: str, new_expires_at: str, operator_id: str = "SYSTEM", reason: str = "") -> Optional[QRPassRecord]:
        """Extends or updates the expiration date of a pass."""
        p = self.get_pass(pass_id)
        if not p:
            return None

        old_expires = p.expires_at
        now = self.now_iso()
        new_status = "ACTIVE" if p.status in ["ACTIVE", "EXPIRED"] else p.status

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE qr_passes 
                SET expires_at = ?, status = ?, updated_at = ?
                WHERE pass_id = ?
            """, (new_expires_at, new_status, now, pass_id))

            details = json.dumps({
                "old_expires_at": old_expires,
                "new_expires_at": new_expires_at,
                "reason": reason,
            })
            cursor.execute("""
                INSERT INTO qr_audit_logs (timestamp, pass_id, action, operator_id, details)
                VALUES (?, ?, 'RENEW', ?, ?)
            """, (now, pass_id, operator_id, details))
            conn.commit()

        p.expires_at = new_expires_at
        p.status = new_status
        p.updated_at = now
        logger.info(f"🔄 Renewed Pass {pass_id}: expires {old_expires} -> {new_expires_at}")
        return p

    def reassign_plate(self, pass_id: str, new_plate: str, operator_id: str = "SYSTEM", reason: str = "") -> Optional[QRPassRecord]:
        """Reassigns the vehicle license plate associated with a pass."""
        p = self.get_pass(pass_id)
        if not p:
            return None

        old_plate = p.plate_number
        norm_new_plate = (new_plate or "").strip().upper()
        now = self.now_iso()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE qr_passes 
                SET plate_number = ?, updated_at = ?
                WHERE pass_id = ?
            """, (norm_new_plate, now, pass_id))

            details = json.dumps({
                "old_plate_number": old_plate,
                "new_plate_number": norm_new_plate,
                "reason": reason,
            })
            cursor.execute("""
                INSERT INTO qr_audit_logs (timestamp, pass_id, action, operator_id, details)
                VALUES (?, ?, 'REASSIGN', ?, ?)
            """, (now, pass_id, operator_id, details))
            conn.commit()

        p.plate_number = norm_new_plate
        p.updated_at = now
        logger.info(f"🔄 Reassigned Pass {pass_id}: plate {old_plate} -> {norm_new_plate}")
        return p

    def update_status(self, pass_id: str, new_status: str, operator_id: str = "SYSTEM", reason: str = "") -> Optional[QRPassRecord]:
        """Changes pass status to ACTIVE, SUSPENDED, or REVOKED."""
        p = self.get_pass(pass_id)
        if not p:
            return None

        old_status = p.status
        new_status = new_status.upper()
        now = self.now_iso()
        revoked_at = now if new_status == "REVOKED" else None
        revocation_reason = reason if new_status == "REVOKED" else p.revocation_reason

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE qr_passes 
                SET status = ?, revoked_at = ?, revocation_reason = ?, updated_at = ?
                WHERE pass_id = ?
            """, (new_status, revoked_at, revocation_reason, now, pass_id))

            action_name = "REVOKE" if new_status == "REVOKED" else ("SUSPEND" if new_status == "SUSPENDED" else "REACTIVATE")
            details = json.dumps({
                "old_status": old_status,
                "new_status": new_status,
                "reason": reason,
            })
            cursor.execute("""
                INSERT INTO qr_audit_logs (timestamp, pass_id, action, operator_id, details)
                VALUES (?, ?, ?, ?, ?)
            """, (now, pass_id, action_name, operator_id, details))
            conn.commit()

        p.status = new_status
        p.revoked_at = revoked_at
        p.revocation_reason = revocation_reason
        p.updated_at = now
        logger.info(f"🛡️ Pass {pass_id} status changed: {old_status} -> {new_status} (Reason: {reason})")
        return p

    def record_scan_use(self, pass_id: str, gate_id: str = "ENTRY", plate_matched: bool = True, details: Optional[Dict[str, Any]] = None) -> Optional[QRPassRecord]:
        """
        Records a gate scan/consumption of the pass.
        Increments use_count. If max_uses > 0 and use_count >= max_uses, marks status as 'USED'.
        """
        p = self.get_pass(pass_id)
        if not p:
            return None

        new_count = p.use_count + 1
        now = self.now_iso()
        new_status = p.status

        # If single-use or limited uses, auto-mark USED when limit reached
        if p.max_uses > 0 and new_count >= p.max_uses:
            new_status = "USED"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE qr_passes 
                SET use_count = ?, status = ?, updated_at = ?
                WHERE pass_id = ?
            """, (new_count, new_status, now, pass_id))

            log_details = {
                "gate_id": gate_id,
                "plate_matched": plate_matched,
                "use_count": new_count,
                "max_uses": p.max_uses,
                **(details or {}),
            }
            cursor.execute("""
                INSERT INTO qr_audit_logs (timestamp, pass_id, action, operator_id, details)
                VALUES (?, ?, 'SCAN_USE', ?, ?)
            """, (now, pass_id, gate_id, json.dumps(log_details)))
            conn.commit()

        p.use_count = new_count
        p.status = new_status
        p.updated_at = now
        return p

    def get_audit_logs(self, pass_id: Optional[str] = None, limit: int = 50) -> List[QRAuditLogRecord]:
        """Fetches recent audit log entries, optionally filtered by pass_id."""
        query = "SELECT * FROM qr_audit_logs"
        params: List[Any] = []
        if pass_id:
            query += " WHERE pass_id = ?"
            params.append(pass_id)
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            logs = []
            for r in rows:
                try:
                    dt = json.loads(r["details"])
                except Exception:
                    dt = {"raw": r["details"]}
                logs.append(QRAuditLogRecord(
                    id=r["id"],
                    timestamp=r["timestamp"],
                    pass_id=r["pass_id"],
                    action=r["action"],
                    operator_id=r["operator_id"],
                    details=dt,
                ))
            return logs

    def _row_to_record(self, row: sqlite3.Row) -> QRPassRecord:
        return QRPassRecord(
            pass_id=row["pass_id"],
            plate_number=row["plate_number"],
            pass_type=row["pass_type"],
            holder_name=row["holder_name"],
            account_id=row["account_id"],
            status=row["status"],
            max_uses=row["max_uses"],
            use_count=row["use_count"],
            issued_at=row["issued_at"],
            valid_from=row["valid_from"],
            expires_at=row["expires_at"],
            revoked_at=row["revoked_at"],
            revocation_reason=row["revocation_reason"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            metadata=row["metadata"],
        )
