import sys
import os
import cv2
import time
import asyncio
import logging
from typing import Dict, Optional, List, Any

# Ensure parent directory (recognition-service) is in sys.path when running python app/main.py
if '__file__' in globals():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
else:
    parent_dir = os.getcwd()

if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from fastapi import FastAPI, HTTPException, Response, BackgroundTasks, File, UploadFile, Body, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import numpy as np

from app.camera.factory import CameraProviderFactory
from app.services.nestjs_client import NestJSClient
from app.services.recognition_runner import RecognitionWorker
from app.services.heartbeat_runner import HeartbeatRunner
from app.detection.plate_detector import PlateDetector
from app.ocr.recognizer import OCRRecognizer
from app.qr.qr_scanner import QRScanner, GateFlowManager, QRPayloadParser, GateDirection, GateAction, GateAuditLogger, GateDecision
from app.qr.qr_repository import QRRepository, QRPassRecord, QRAuditLogRecord
from app.qr.qr_manager import QRManager
from dataclasses import asdict
from datetime import datetime, timezone, timedelta
import json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RecognitionService")

app = FastAPI(
    title="Addis Ababa Transport Office - High-FPS ANPR & QR Gateway API",
    version="2.1.0",
    description="Production High-FPS ANPR, QR Pass Lifecycle, Live Camera Control & Gate Clearance API.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

def _resolve_gateway_prefix(request: Request) -> str:
    prefix = request.headers.get("x-forwarded-prefix", "").rstrip("/")
    if not prefix:
        host = request.headers.get("host", "")
        referer = request.headers.get("referer", "")
        if "/recognition-api" in referer or ":8080" in host:
            prefix = "/recognition-api"
    return prefix

@app.get("/openapi.json", include_in_schema=False)
@app.get("/docs/openapi.json", include_in_schema=False)
def custom_openapi_json(request: Request):
    prefix = _resolve_gateway_prefix(request)
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema["servers"] = [{"url": prefix or "/"}]
    return JSONResponse(schema)

@app.get("/docs", include_in_schema=False)
def custom_swagger_ui(request: Request):
    prefix = _resolve_gateway_prefix(request)
    openapi_target = f"{prefix}/openapi.json" if prefix else "openapi.json"
    return get_swagger_ui_html(
        openapi_url=openapi_target,
        title=f"{app.title} - Swagger UI",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global worker registry
workers: Dict[str, RecognitionWorker] = {}
nestjs_client = NestJSClient()
heartbeat_runner = HeartbeatRunner(workers, nestjs_client)
single_plate_detector = PlateDetector()
single_ocr_recognizer = OCRRecognizer()
global_qr_scanner = QRScanner(throttle_interval=1)
global_gate_flow = GateFlowManager()
global_qr_repo = QRRepository()
global_qr_manager = QRManager(repository=global_qr_repo)

class StartCameraRequest(BaseModel):
    cameraId: str
    terminalId: str
    cameraType: str = "ENTRY"
    sourceType: str = "USB"
    sourceAddress: str = "0"

@app.post("/scan-image")
async def scan_image(
    file: Optional[UploadFile] = File(None),
    payload: Optional[Dict[str, Any]] = Body(None),
):
    """
    Direct Image OCR Scanner for Mobile Apps & Backend Service.
    Accepts:
    - Multipart image file (field name: 'file' or 'image')
    - OR JSON body with base64 image: {"image": "..."} or {"imageBase64": "..."}
    """
    img_bytes = None
    if file:
        img_bytes = await file.read()
    elif payload and isinstance(payload, dict):
        b64_str = payload.get("image") or payload.get("imageBase64")
        if b64_str:
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            try:
                img_bytes = base64.b64decode(b64_str)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid base64 string: {e}")

    if not img_bytes:
        raise HTTPException(status_code=400, detail="No image file or base64 data provided.")

    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Failed to decode image.")

    # 1. Detect plate crop
    plate_region = single_plate_detector.detect_plate_region(frame)
    if plate_region is not None:
        plate_crop, _ = plate_region
    else:
        plate_crop = frame

    # 2. Run OCR
    raw_text, norm_text, conf = single_ocr_recognizer.recognize(plate_crop)

    # 3. Second pass on full image if crop was unreadable
    if not norm_text and plate_region is not None:
        raw_text, norm_text, conf = single_ocr_recognizer.recognize(frame)

    return {
        "success": bool(norm_text),
        "plateNumber": norm_text,
        "confidence": round(float(conf), 2) if conf else 0.0,
        "rawText": raw_text or norm_text,
    }

@app.post("/scan-qr")
async def scan_qr(request: Request):
    """
    Dedicated QR Code Scanner Endpoint.
    Accepts:
      - JSON: {"qrText": "..."} OR {"image": "data:image/jpeg;base64,..."}
      - Multipart Form: file=<image>
    Returns decoded payload, validation status, and gate access decision.
    """
    content_type = request.headers.get("content-type", "").lower()
    payload: Dict[str, Any] = {}
    img_bytes: Optional[bytes] = None

    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception:
            payload = {}
    else:
        try:
            form = await request.form()
            file_field = form.get("file")
            if file_field and hasattr(file_field, "read"):
                img_bytes = await file_field.read()
            for k in ("qrText", "qrString", "token", "image", "imageBase64", "plateNumber", "plate", "direction"):
                if k in form and isinstance(form[k], str):
                    payload[k] = form[k]
        except Exception:
            pass

    # 1. Check for direct raw text string first
    raw_text = payload.get("qrText") or payload.get("qrString") or payload.get("token")
    if raw_text:
        dir_str = str(payload.get("direction", "ENTRY")).upper()
        dir_enum = GateDirection.ENTRY if dir_str == "ENTRY" else GateDirection.EXIT
        val_res = global_qr_scanner.decode_raw_string(raw_text)
        decision = global_gate_flow.evaluate_gate_access(
            ocr_plate=payload.get("plateNumber") or payload.get("plate"),
            qr_input=val_res.payload if val_res.is_valid else raw_text,
            direction=dir_enum,
        )
        return {
            "success": True,
            "found": True,
            "rawText": raw_text,
            "validation": {
                "status": val_res.status.value,
                "isValid": val_res.is_valid,
                "errorMessage": val_res.error_message,
                "timeRemainingSeconds": val_res.time_remaining_seconds,
                "payload": val_res.payload.to_dict() if val_res.payload else None,
            },
            "gateDecision": decision.to_dict(),
        }

    # 2. Extract image bytes from JSON base64 if not uploaded via multipart
    if img_bytes is None:
        b64_str = payload.get("image") or payload.get("imageBase64")
        if b64_str and isinstance(b64_str, str):
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            try:
                img_bytes = base64.b64decode(b64_str)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid base64 string: {e}")

    if not img_bytes:
        raise HTTPException(status_code=400, detail="Provide 'qrText' string, image file upload, or base64 image.")

    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Failed to decode image.")

    scan_res = global_qr_scanner.scan_frame(frame, force=True)
    if not scan_res or not scan_res.found:
        return {
            "success": False,
            "found": False,
            "rawText": "",
            "validation": None,
            "gateDecision": None,
            "processingTimeMs": scan_res.processing_time_ms if scan_res else 0.0,
        }

    val_res = scan_res.validation
    direction_val = payload.get("direction") or "ENTRY"
    dir_enum = GateDirection.ENTRY if str(direction_val).upper() == "ENTRY" else GateDirection.EXIT
    plate_arg = payload.get("plateNumber") or payload.get("plate")

    decision = global_gate_flow.evaluate_gate_access(
        ocr_plate=plate_arg,
        qr_input=scan_res,
        direction=dir_enum,
    )

    return {
        "success": True,
        "found": True,
        "rawText": scan_res.raw_text,
        "bbox": scan_res.bbox,
        "methodUsed": scan_res.method_used,
        "processingTimeMs": round(scan_res.processing_time_ms, 2),
        "validation": {
            "status": val_res.status.value if val_res else "UNKNOWN",
            "isValid": val_res.is_valid if val_res else False,
            "errorMessage": val_res.error_message if val_res else None,
            "timeRemainingSeconds": val_res.time_remaining_seconds if val_res else None,
            "payload": val_res.payload.to_dict() if val_res and val_res.payload else None,
        },
        "gateDecision": decision.to_dict(),
    }

def _dispatch_qr_gate_to_nestjs(
    camera_id: str,
    terminal_id: str,
    direction_str: str,
    plate_num: str,
    pass_id: Optional[str],
    pass_type: Optional[str],
    match_status: Optional[str],
) -> Dict[str, Any]:
    """Forwards verified OPEN QR gate decisions into NestJS Incoming Pending queue."""
    try:
        return nestjs_client.send_recognition_event(
            camera_id=camera_id,
            terminal_id=terminal_id or "terminal-demo",
            camera_type=direction_str,
            plate_number=plate_num or f"QR-{pass_id or 'PASS'}",
            confidence=0.98,
            captured_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            track_id=1,
            vehicle_type="minibus",
            direction=direction_str,
            source="QR_CAMERA",
            pass_id=pass_id,
            pass_type=pass_type,
            match_status=match_status,
        )
    except Exception as e:
        logger.warning(f"NestJS queue dispatch warning: {e}")
        return {"success": False, "error": str(e)}

@app.post("/gate-decision")
async def gate_decision(payload: Dict[str, Any] = Body(...)):
    """
    Direct Gate Reconciliation Endpoint.
    Reconciles Plate OCR and/or QR token and outputs definitive gate command (OPEN, HOLD, REJECT).
    """
    try:
        plate = payload.get("plateNumber") or payload.get("plate")
        conf = float(payload.get("confidence") or payload.get("ocrConfidence") or 0.0)
        qr_data = payload.get("qrCode") or payload.get("qrText") or payload.get("ticketId")
        direction_str = str(payload.get("direction", "ENTRY")).upper()
        direction = GateDirection.ENTRY if direction_str == "ENTRY" else GateDirection.EXIT
        camera_id = payload.get("cameraId", "CAM-01")
        terminal_id = payload.get("terminalId") or "terminal-demo"

        # If QR data provided, route according to pass registration status
        if qr_data:
            clean_qr = str(qr_data).strip()
            pass_id_candidate = ""
            try:
                parsed = json.loads(clean_qr)
                pass_id_candidate = parsed.get("pass_id") or parsed.get("ticket_id") or ""
            except Exception:
                if "|" in clean_qr:
                    pass_id_candidate = clean_qr.split("|")[0]
                elif ":" in clean_qr:
                    pass_id_candidate = clean_qr.split(":")[0]

            has_repo_pass = bool(global_qr_repo.get_pass(pass_id_candidate)) if pass_id_candidate else False

            # If registered pass in DB or HMAC signed payload, verify against lifecycle repository
            if has_repo_pass or "sig" in clean_qr or "signature" in clean_qr:
                decision = global_qr_manager.verify_and_consume_gate_pass(
                    raw_qr_input=clean_qr,
                    detected_plate=plate,
                    detected_confidence=conf,
                    direction=direction,
                    gate_id=camera_id,
                )
                try:
                    audit_id = global_gate_flow.audit_logger.log_event(
                        decision=decision,
                        camera_id=camera_id,
                        qr_plate=decision.plate_number,
                        raw_qr_text=clean_qr,
                    )
                    decision.audit_id = audit_id
                except Exception as e:
                    logger.warning(f"Could not mirror decision to audit logger: {e}")
            else:
                # Presentation presets, simulation tickets, or ad-hoc visitor passes evaluated directly by GateFlowManager
                decision = global_gate_flow.evaluate_gate_access(
                    ocr_plate=plate,
                    ocr_confidence=conf,
                    qr_input=clean_qr,
                    direction=direction,
                    camera_id=camera_id,
                )
        else:
            decision = global_gate_flow.evaluate_gate_access(
                ocr_plate=plate,
                ocr_confidence=conf,
                qr_input=None,
                direction=direction,
                camera_id=camera_id,
            )

        res_dict = decision.to_dict()

        # Auto-populate NestJS "Incoming Pending" queue synchronously so DB write commits before response
        act = res_dict.get("action")
        if act == GateAction.OPEN.value or act == "OPEN":
            queue_res = await asyncio.to_thread(
                _dispatch_qr_gate_to_nestjs,
                camera_id=camera_id,
                terminal_id=terminal_id,
                direction_str=direction_str,
                plate_num=res_dict.get("plate_number") or plate or "",
                pass_id=res_dict.get("ticket_id"),
                pass_type=res_dict.get("pass_type"),
                match_status=res_dict.get("match_status"),
            )
            res_dict["queue_dispatch"] = queue_res

        return res_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unhandled error in /gate-decision: {e}")
        raise HTTPException(status_code=500, detail=f"Gate evaluation error: {str(e)}")

@app.get("/gate-audit-logs")
def get_gate_audit_logs(limit: int = 50):
    """Returns recent parking gate audit and reconciliation logs from SQLite database."""
    logs = global_gate_flow.audit_logger.get_recent_logs(limit=limit)
    return {
        "total": len(logs),
        "logs": logs,
    }

# -------------------------------------------------------------
# QR Pass Lifecycle Management Endpoints (CRUD + Generator)
# -------------------------------------------------------------

@app.post("/qr-passes")
async def create_qr_pass(payload: Dict[str, Any] = Body(...)):
    """Issues a new cryptographically signed vehicle QR pass with rendered PNG image."""
    plate_number = payload.get("plateNumber") or payload.get("plate_number") or ""
    pass_type = payload.get("passType") or payload.get("pass_type") or "SUBSCRIBER"
    holder_name = payload.get("holderName") or payload.get("holder_name") or "Fleet Vehicle"
    account_id = payload.get("accountId") or payload.get("account_id")
    duration_days = int(payload.get("durationDays") or payload.get("duration_days") or 90)
    max_uses = int(payload.get("maxUses") if "maxUses" in payload else (payload.get("max_uses") if "max_uses" in payload else (0 if pass_type.upper() == "SUBSCRIBER" else 1)))
    custom_pass_id = payload.get("passId") or payload.get("pass_id")
    operator_id = payload.get("operatorId") or "ADMIN"
    metadata = payload.get("metadata")

    result = global_qr_manager.issue_pass(
        plate_number=plate_number,
        pass_type=pass_type,
        holder_name=holder_name,
        account_id=account_id,
        duration_days=duration_days,
        max_uses=max_uses,
        custom_pass_id=custom_pass_id,
        operator_id=operator_id,
        metadata=metadata,
    )
    return {"success": True, "pass": result}

@app.post("/qr-passes/batch")
async def batch_create_qr_passes(payload: Dict[str, Any] = Body(...)):
    """Batch issues multiple vehicle QR passes from JSON array."""
    passes_data = payload.get("passes") or []
    operator_id = payload.get("operatorId") or "ADMIN"
    results = global_qr_manager.batch_issue_passes(passes_data, operator_id=operator_id)
    return {"success": True, "count": len(results), "passes": results}

@app.get("/qr-passes")
def list_qr_passes(
    search: Optional[str] = None,
    status: Optional[str] = None,
    pass_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """Lists/searches QR passes with status & type filtering."""
    passes = global_qr_repo.list_passes(search=search, status=status, pass_type=pass_type, limit=limit, offset=offset)
    return {
        "success": True,
        "total": len(passes),
        "passes": [asdict(p) for p in passes],
    }

@app.get("/qr-passes/{pass_id}")
def get_qr_pass_detail(pass_id: str):
    """Retrieves full QR pass record, rendered QR image data URI, and audit trail."""
    p = global_qr_repo.get_pass(pass_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"QR Pass [{pass_id}] not found")

    sig = global_qr_manager._sign_payload(p.pass_id, p.plate_number, p.pass_type, p.expires_at)
    canonical_payload = json.dumps({
        "pass_id": p.pass_id,
        "plate_number": p.plate_number or None,
        "pass_type": p.pass_type,
        "expires_at": p.expires_at,
        "sig": sig,
    }, separators=(",", ":"))
    _, b64_uri = global_qr_manager.render_qr_image(canonical_payload)
    logs = global_qr_repo.get_audit_logs(pass_id=pass_id, limit=20)

    return {
        "success": True,
        "pass": asdict(p),
        "payload_json": canonical_payload,
        "qr_image_data_uri": b64_uri,
        "audit_logs": [asdict(l) for l in logs],
    }

@app.get("/qr-passes/{pass_id}/image")
def get_qr_pass_image(pass_id: str):
    """Returns downloadable/renderable high-contrast PNG image of the QR pass."""
    p = global_qr_repo.get_pass(pass_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"QR Pass [{pass_id}] not found")

    sig = global_qr_manager._sign_payload(p.pass_id, p.plate_number, p.pass_type, p.expires_at)
    canonical_payload = json.dumps({
        "pass_id": p.pass_id,
        "plate_number": p.plate_number or None,
        "pass_type": p.pass_type,
        "expires_at": p.expires_at,
        "sig": sig,
    }, separators=(",", ":"))
    png_bytes, _ = global_qr_manager.render_qr_image(canonical_payload)
    return Response(content=png_bytes, media_type="image/png")

@app.post("/qr-passes/{pass_id}/renew")
async def renew_qr_pass(pass_id: str, payload: Dict[str, Any] = Body(...)):
    """Renews or extends the expiration date of an existing pass."""
    new_expires_at = payload.get("expiresAt") or payload.get("expires_at")
    days_to_add = int(payload.get("daysToAdd") or payload.get("days_to_add") or 30)
    if not new_expires_at:
        new_dt = datetime.now(timezone.utc) + timedelta(days=days_to_add)
        new_expires_at = new_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    operator_id = payload.get("operatorId") or "ADMIN"
    reason = payload.get("reason") or f"Extended validity by {days_to_add} days"

    updated = global_qr_repo.renew_pass(pass_id, new_expires_at, operator_id=operator_id, reason=reason)
    if not updated:
        raise HTTPException(status_code=404, detail=f"QR Pass [{pass_id}] not found")
    return {"success": True, "pass": asdict(updated)}

@app.post("/qr-passes/{pass_id}/reassign")
async def reassign_qr_pass_plate(pass_id: str, payload: Dict[str, Any] = Body(...)):
    """Reassigns a QR pass to a different vehicle license plate."""
    new_plate = payload.get("newPlate") or payload.get("plateNumber") or payload.get("plate_number")
    if not new_plate:
        raise HTTPException(status_code=400, detail="newPlate is required")

    operator_id = payload.get("operatorId") or "ADMIN"
    reason = payload.get("reason") or "Vehicle fleet plate reassignment"

    updated = global_qr_repo.reassign_plate(pass_id, new_plate, operator_id=operator_id, reason=reason)
    if not updated:
        raise HTTPException(status_code=404, detail=f"QR Pass [{pass_id}] not found")
    return {"success": True, "pass": asdict(updated)}

@app.post("/qr-passes/{pass_id}/status")
async def change_qr_pass_status(pass_id: str, payload: Dict[str, Any] = Body(...)):
    """Changes pass status to ACTIVE, SUSPENDED, or REVOKED."""
    new_status = payload.get("status")
    if not new_status or new_status.upper() not in ["ACTIVE", "SUSPENDED", "REVOKED"]:
        raise HTTPException(status_code=400, detail="status must be one of: ACTIVE, SUSPENDED, REVOKED")

    operator_id = payload.get("operatorId") or "ADMIN"
    reason = payload.get("reason") or f"Status set to {new_status}"

    updated = global_qr_repo.update_status(pass_id, new_status, operator_id=operator_id, reason=reason)
    if not updated:
        raise HTTPException(status_code=404, detail=f"QR Pass [{pass_id}] not found")
    return {"success": True, "pass": asdict(updated)}

@app.get("/qr-passes-export")
def export_qr_passes_csv(search: Optional[str] = None, status: Optional[str] = None):
    """Exports passes to CSV format."""
    csv_str = global_qr_manager.export_passes_csv(search=search, status=status)
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=qr_passes_export.csv"},
    )

@app.get("/qr-lifecycle-logs")
def get_qr_lifecycle_logs(pass_id: Optional[str] = None, limit: int = 50):
    """Returns immutable lifecycle audit logs for QR passes."""
    logs = global_qr_repo.get_audit_logs(pass_id=pass_id, limit=limit)
    return {
        "success": True,
        "total": len(logs),
        "logs": [asdict(l) for l in logs],
    }

@app.on_event("startup")
def startup_event():
    logger.info("Initializing High-FPS ANPR Recognition Service...")
    heartbeat_runner.start()
    # Auto-initialize camera worker: detect physical camera or use mock for headless VPS
    try:
        # Test if physical camera index 0 exists and can deliver frames
        test_cap = cv2.VideoCapture(0)
        has_cam = test_cap.isOpened()
        if has_cam:
            ret, _ = test_cap.read()
            has_cam = bool(ret)
        test_cap.release()

        if has_cam:
            pc_provider = CameraProviderFactory.create_provider("CAM-PC-01", "USB", "0")
            worker = RecognitionWorker("CAM-PC-01", "terminal-demo", "ENTRY", pc_provider, nestjs_client)
            workers["CAM-PC-01"] = worker
            worker.start()
            logger.info("✅ Physical USB Camera detected & worker started on CAM-PC-01 (Device 0)")
        else:
            logger.info("ℹ️ No physical USB webcam detected (headless cloud VPS mode). Starting Mock Synthetic Camera provider.")
            mock_provider = CameraProviderFactory.create_provider("CAM-DEMO-01", "MOCK_SYNTHETIC", "MOCK")
            worker = RecognitionWorker("CAM-DEMO-01", "terminal-demo", "ENTRY", mock_provider, nestjs_client)
            workers["CAM-DEMO-01"] = worker
            worker.start()
    except Exception as e:
        logger.warning(f"Camera initialization warning ({e}). Falling back to mock camera.")
        mock_provider = CameraProviderFactory.create_provider("CAM-DEMO-01", "MOCK_SYNTHETIC", "MOCK")
        worker = RecognitionWorker("CAM-DEMO-01", "terminal-demo", "ENTRY", mock_provider, nestjs_client)
        workers["CAM-DEMO-01"] = worker
        worker.start()

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down ANPR Recognition Service...")
    heartbeat_runner.stop()
    for worker in workers.values():
        worker.stop()

@app.get("/health")
def health_check():
    active_fps = {cid: float(f"{w.current_fps:.1f}") for cid, w in workers.items()}
    return {
        "status": "UP",
        "active_workers": len(workers),
        "service": "High-FPS ANPR Recognition Service",
        "fps_performance": active_fps,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

@app.get("/unknown-plates")
def get_unknown_plates():
    """Returns all detected unregistered / unknown car plates across active cameras."""
    all_unknown = []
    for cid, worker in workers.items():
        all_unknown.extend(worker.get_unknown_plates())
    return {
        "total_unknown": len(all_unknown),
        "unknown_plates": all_unknown
    }

@app.get("/eligible-plates")
def get_eligible_plates():
    """Returns all verified eligible car plates across active cameras."""
    all_eligible = []
    for cid, worker in workers.items():
        all_eligible.extend(worker.get_eligible_plates())
    return {
        "total_eligible": len(all_eligible),
        "eligible_plates": all_eligible
    }

@app.get("/detect-pc-cameras")
def detect_pc_cameras():
    """Detects working PC webcams connected to this machine (probes indices 0..3)."""
    available = []
    for idx in range(4):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                available.append({
                    "deviceIndex": idx,
                    "name": f"PC Webcam / USB Camera (Device #{idx})",
                    "available": True
                })
            cap.release()
    if not available:
        available.append({
            "deviceIndex": 0,
            "name": "PC Camera (Default Index 0)",
            "available": False
        })
    return {"pc_cameras": available}

@app.get("/cameras")
def list_active_cameras():
    result = []
    for cid, worker in workers.items():
        status = worker.provider.get_status()
        latest_qr = None
        if worker.latest_qr_scan and worker.latest_qr_scan.found:
            p = worker.latest_qr_scan.validation.payload if worker.latest_qr_scan.validation else None
            latest_qr = {
                "rawText": worker.latest_qr_scan.raw_text,
                "ticketId": p.ticket_id if p else None,
                "plateNumber": p.plate_number if p else None,
                "passType": p.pass_type.value if (p and p.pass_type) else None,
                "timestamp": worker.qr_scanner.last_decoded_time,
            }
        result.append({
            "cameraId": cid,
            "terminalId": worker.terminal_id,
            "cameraType": worker.camera_type,
            "is_running": worker.is_running,
            "current_fps": float(f"{worker.current_fps:.1f}"),
            "unknown_count": len(worker.unknown_plates),
            "eligible_count": len(worker.eligible_plates),
            "is_connected": status.get("is_connected", False),
            "sourceAddress": status.get("source_address", ""),
            "last_recognized_plate": worker.last_recognized_plate,
            "latest_qr": latest_qr,
            "latest_decision": worker.get_latest_gate_decision(),
        })
    return result

@app.post("/cameras/start")
def start_camera_worker(req: StartCameraRequest):
    if req.cameraId in workers:
        workers[req.cameraId].stop()

    try:
        provider = CameraProviderFactory.create_provider(req.cameraId, req.sourceType, req.sourceAddress)
        worker = RecognitionWorker(req.cameraId, req.terminalId, req.cameraType, provider, nestjs_client)
        workers[req.cameraId] = worker
        worker.start()
        return {"success": True, "message": f"Camera {req.cameraId} started successfully in {req.sourceType} mode."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start camera worker: {e}")

@app.post("/cameras/stop/{camera_id}")
def stop_camera_worker(camera_id: str):
    if camera_id not in workers:
        raise HTTPException(status_code=404, detail="Camera worker not found.")
    workers[camera_id].stop()
    del workers[camera_id]
    return {"success": True, "message": f"Camera {camera_id} stopped."}

def generate_mjpeg_stream(camera_id: str):
    worker = workers.get(camera_id)
    while True:
        if not worker or worker.latest_frame is None:
            time.sleep(0.02)
            continue
        frame = worker.latest_frame
        ret, jpeg = cv2.imencode('.jpg', frame)
        if not ret:
            time.sleep(0.02)
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        time.sleep(0.03)

@app.get("/preview/{camera_id}")
def get_camera_preview(camera_id: str):
    if camera_id not in workers:
        raise HTTPException(status_code=404, detail="Camera worker not running.")
    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

if __name__ == "__main__":
    import uvicorn
    import signal

    def handle_shutdown(sig, frame):
        logger.info("🛑 Received termination signal (Ctrl+C). Shutting down all workers...")
        shutdown_event()
        os._exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 KeyboardInterrupt caught. Cleaning up...")
        shutdown_event()
        os._exit(0)
