import os
import cv2
import logging
import threading
import numpy as np
from typing import Tuple, Dict, Any, Optional, List

from app.config import settings
from app.preprocessing.image_enhancer import ImageEnhancer
from app.validation.plate_validator import PlateValidator

logger = logging.getLogger("OCRRecognizer")

class OCRRecognizer:
    """
    Production Multi-Engine License Plate Recognizer for Ethiopian Plates.
    Features:
    - Primary PaddleOCR recognition engine
    - Character set restricted to English uppercase letters (A-Z) and numbers (0-9)
    - Pluggable fine-tuned PaddleOCR model path (via settings.PADDLE_REC_MODEL_DIR)
    - Evaluates 5 preprocessed variants (Resized original, CLAHE, Grayscale, Threshold, Sharpened)
    - Selects candidate with highest confidence & valid Ethiopian format
    - NO FAKE OCR RESULTS (returns text="" and confidence=0.0 if OCR fails)
    """
    def __init__(self, rec_model_dir: Optional[str] = None):
        self.rec_model_dir = rec_model_dir or settings.PADDLE_REC_MODEL_DIR
        self.paddle_ocr = None
        self.easy_reader = None
        self.tesseract_available = False
        self.ocr_loading = False

        self._init_engines_async()

    def _init_engines_async(self):
        """Asynchronously loads heavy OCR models in background thread to avoid blocking server startup."""
        threading.Thread(target=self._load_ocr_engines_in_background, daemon=True).start()

    def _load_ocr_engines_in_background(self):
        self.ocr_loading = True
        # 1. Initialize Primary PaddleOCR Engine
        try:
            from paddleocr import PaddleOCR
            logger.info("⏳ Initializing PaddleOCR primary engine (A-Z 0-9 character set)...")

            kwargs: Dict[str, Any] = {
                "use_angle_cls": False,
                "lang": "en",
                "show_log": False,
            }

            # Support custom fine-tuned recognition model directory
            if self.rec_model_dir and os.path.exists(self.rec_model_dir):
                kwargs["rec_model_dir"] = self.rec_model_dir
                logger.info(f"🎯 Fine-tuned PaddleOCR model loaded from '{self.rec_model_dir}'")

            self.paddle_ocr = PaddleOCR(**kwargs)
            logger.info("✅ PaddleOCR primary engine ready.")
        except Exception as e:
            logger.warning(f"ℹ️ PaddleOCR loading note ({e}). Falling back to Tesseract/EasyOCR.")

        # 2. Initialize EasyOCR fallback
        try:
            import easyocr
            self.easy_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("✅ EasyOCR fallback engine ready.")
        except Exception:
            pass

        # 3. Verify Native Tesseract fallback
        try:
            import pytesseract
            possible_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    pytesseract.pytesseract.tesseract_cmd = p
                    break
            _ = pytesseract.get_tesseract_version()
            self.tesseract_available = True
            logger.info("✅ Native Tesseract fallback engine verified.")
        except Exception:
            self.tesseract_available = False

        self.ocr_loading = False

    def recognize(self, plate_crop: np.ndarray) -> Tuple[str, str, float]:
        """
        Processes cropped plate image across preprocessed variants.
        Selects candidate with highest confidence & valid format.
        Returns Tuple[raw_text, normalized_text, confidence].
        NEVER returns fake plate numbers.
        """
        if plate_crop is None or plate_crop.size == 0:
            return "", "", 0.0

        logger.info("Processing plate OCR")

        # Step 1: Generate preprocessed image variants
        variants = ImageEnhancer.get_ocr_variants(plate_crop)
        candidates: List[Tuple[str, str, float, bool]] = []

        # Step 2: Run PaddleOCR on variants with early exit for high confidence candidate
        if self.paddle_ocr is not None:
            for v in variants:
                try:
                    img = v["image"]
                    results = self.paddle_ocr.ocr(img, cls=False)
                    if results and len(results) > 0 and results[0]:
                        for line in results[0]:
                            text, conf = line[1]
                            val = PlateValidator.validate_and_normalize(text, float(conf))
                            if val.normalized_text and val.confidence >= 0.4:
                                candidates.append((val.raw_text, val.normalized_text, val.confidence, val.is_valid))
                                if val.is_valid and val.confidence >= 0.88:
                                    break
                except Exception as e:
                    logger.error(f"PaddleOCR variant error ({v['name']}): {e}")
                if any(c[3] and c[2] >= 0.88 for c in candidates):
                    break

        # Step 3: Run Fallback EasyOCR if PaddleOCR yielded no candidates
        if not candidates and self.easy_reader is not None:
            for v in variants:
                try:
                    img = v["image"]
                    results = self.easy_reader.readtext(img)
                    if results:
                        for bbox, text, conf in results:
                            val = PlateValidator.validate_and_normalize(text, float(conf))
                            if val.normalized_text and val.confidence >= 0.4:
                                candidates.append((val.raw_text, val.normalized_text, val.confidence, val.is_valid))
                except Exception:
                    pass

        # Step 4: Run Fallback Tesseract if still no candidates
        if not candidates and self.tesseract_available:
            for v in variants:
                try:
                    import pytesseract
                    img = v["image"]
                    config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                    text = pytesseract.image_to_string(img, config=config).strip()
                    if text:
                        val = PlateValidator.validate_and_normalize(text, 0.85)
                        if val.normalized_text:
                            candidates.append((val.raw_text, val.normalized_text, val.confidence, val.is_valid))
                except Exception:
                    pass

        # Step 5: Selection Logic — Highest confidence validator-approved prediction
        if candidates:
            sorted_candidates = sorted(candidates, key=lambda c: (c[3], c[2]), reverse=True)
            best_raw, best_norm, best_conf, best_valid = sorted_candidates[0]

            logger.info(f"Plate detected: {best_norm} confidence: {int(best_conf * 100)}%")
            return best_raw, best_norm, float(best_conf)

        # Step 6: OCR Failed — NO FAKE PLATES
        logger.info("No valid OCR result")
        return "", "", 0.0

    def recognize_dict(self, plate_crop: np.ndarray) -> Dict[str, Any]:
        """
        Returns standard dict payload:
        {"text": "AA123456", "confidence": 0.98} or {"text": "", "confidence": 0.0}
        """
        raw_text, normalized_text, confidence = self.recognize(plate_crop)
        return {
            "text": normalized_text if normalized_text else "",
            "confidence": float(confidence) if normalized_text else 0.0
        }
