from app.camera.base import BaseCameraProvider
from app.camera.usb_provider import USBCameraProvider
from app.camera.android_provider import AndroidCameraProvider
from app.camera.video_file_provider import VideoFileCameraProvider
from app.camera.mock_synthetic_provider import MockSyntheticCameraProvider
from app.camera.rtsp_provider import RTSPCameraProvider
from app.camera.onvif_provider import ONVIFCameraProvider

class CameraProviderFactory:
    """Factory to instantiate camera providers based on CameraSourceType."""

    @staticmethod
    def create_provider(camera_id: str, source_type: str, source_address: str) -> BaseCameraProvider:
        st = source_type.upper().strip()

        if st in ["USB", "LAPTOP"]:
            return USBCameraProvider(camera_id, source_address)
        elif st in ["ANDROID_PHONE", "ANDROID", "IP_WEBCAM", "HTTP"]:
            return AndroidCameraProvider(camera_id, source_address)
        elif st in ["VIDEO_FILE", "FILE"]:
            return VideoFileCameraProvider(camera_id, source_address)
        elif st in ["MOCK_SYNTHETIC", "SYNTHETIC", "MOCK"]:
            return MockSyntheticCameraProvider(camera_id, source_address)
        elif st in ["RTSP"]:
            return RTSPCameraProvider(camera_id, source_address)
        elif st in ["ONVIF", "ANPR"]:
            return ONVIFCameraProvider(camera_id, source_address)
        else:
            # Fallback to USB or Mock based on address
            if source_address.isdigit():
                return USBCameraProvider(camera_id, source_address)
            else:
                return MockSyntheticCameraProvider(camera_id, source_address)
