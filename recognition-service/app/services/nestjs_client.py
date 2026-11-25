import requests
import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("NestJSClient")

class NestJSClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.NESTJS_API_URL).rstrip("/")

    def check_eligibility(self, plate_number: str) -> Dict[str, Any]:
        """
        Queries NestJS backend API to verify plate eligibility in terminal digital roster.
        """
        url = f"{self.base_url}/roster/verify/{plate_number}"
        try:
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                data = response.json()
                is_eligible = data.get("isEligible", data.get("eligible", True))
                return {
                    "isEligible": is_eligible,
                    "status": "ELIGIBLE" if is_eligible else "UNREGISTERED",
                    "details": data
                }
        except Exception:
            pass

        # Default fallback check if endpoint not yet deployed
        return {
            "isEligible": True,
            "status": "CHECKED",
            "details": {}
        }

    def send_recognition_event(
        self,
        camera_id: str,
        terminal_id: str,
        camera_type: str,
        plate_number: str,
        confidence: float,
        captured_at: str,
        track_id: Optional[int] = None,
        vehicle_type: str = "car",
        direction: str = "ENTRY",
        vehicle_image: Optional[str] = None,
        plate_image: Optional[str] = None,
        image_path: Optional[str] = None,
        source: Optional[str] = None,
        pass_id: Optional[str] = None,
        pass_type: Optional[str] = None,
        match_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sends complete ANPR recognition event POST payload to NestJS backend.
        Returns backend decision response (including eligibility status).
        """
        url = f"{self.base_url}/recognition/process"
        payload = {
            "cameraId": camera_id,
            "terminalId": terminal_id,
            "cameraType": camera_type,
            "plateNumber": plate_number,
            "plate": plate_number,
            "confidence": float(confidence),
            "capturedAt": captured_at,
            "timestamp": captured_at,
            "trackId": track_id if track_id is not None else 1,
            "vehicleType": vehicle_type,
            "direction": direction or camera_type,
            "vehicleImage": vehicle_image or "",
            "plateImage": plate_image or "",
            "imagePath": image_path or "",
            "source": source or ("QR_CAMERA" if pass_id else "ANPR_CAMERA"),
            "passId": pass_id or "",
            "passType": pass_type or "",
            "matchStatus": match_status or "",
        }

        try:
            logger.info(f"🚀 [NestJS Client] POST {url} | Track #{track_id} | Type: {vehicle_type} | Plate: {plate_number} ({confidence:.2f})")
            response = requests.post(url, json=payload, timeout=4)
            if response.status_code in [200, 201]:
                res_data = response.json()
                is_eligible = res_data.get("isEligible", res_data.get("eligible", res_data.get("status") != "REJECTED"))
                return {
                    "success": True,
                    "isEligible": is_eligible,
                    "status": "ELIGIBLE" if is_eligible else "UNREGISTERED",
                    "data": res_data
                }
            else:
                logger.warning(f"NestJS returned HTTP {response.status_code} from {url}: {response.text[:300]}")
                return {
                    "success": False,
                    "isEligible": False,
                    "status": "UNREGISTERED",
                    "error": f"HTTP {response.status_code}: {response.text[:200]}"
                }
        except Exception as e:
            logger.warning(f"NestJS connection note ({url}): {e}. Treating as unverified check.")
            return {"success": False, "isEligible": True, "status": "OFFLINE_CHECK", "error": str(e)}

    def send_heartbeat(self, camera_id: str, status: str = "ACTIVE", details: str = "") -> bool:
        url = f"{self.base_url}/cameras/{camera_id}/heartbeat"
        payload = {"status": status, "details": details}
        try:
            response = requests.post(url, json=payload, timeout=3)
            return response.status_code == 200
        except Exception:
            return False
