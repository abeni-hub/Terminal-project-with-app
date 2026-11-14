import cv2
import numpy as np
import logging
from typing import List, Dict, Any

logger = logging.getLogger("ImageEnhancer")

class ImageEnhancer:
    """
    ANPR Preprocessing Pipeline:
    - Crop cleanup & text line isolation
    - 4x upscaling
    - CLAHE contrast enhancement
    - Grayscale conversion
    - Gaussian denoise & bilateral filtering
    - Sharpening
    - Adaptive & OTSU thresholding
    - Deskew correction
    Generates multiple variants for OCR evaluation.
    """

    @staticmethod
    def crop_cleanup(crop: np.ndarray) -> np.ndarray:
        """Crops out top header (Amharic text) if multi-line plate image."""
        if crop is None or crop.size == 0:
            return crop
        h, w = crop.shape[:2]
        if h > 0 and w > 0:
            aspect_ratio = float(w) / h
            if aspect_ratio < 2.5 and h >= 35:
                # Isolate main alphanumeric line
                crop = crop[int(h * 0.30):, :].copy()
        return crop

    @classmethod
    def get_ocr_variants(cls, plate_crop: np.ndarray) -> List[Dict[str, Any]]:
        """
        Generates 5 preprocessed variants for OCR evaluation:
        - Variant 1: Original Resized (4x)
        - Variant 2: CLAHE Contrast Enhanced
        - Variant 3: Grayscale & Denoised
        - Variant 4: OTSU / Adaptive Threshold
        - Variant 5: Sharpened
        """
        variants: List[Dict[str, Any]] = []
        if plate_crop is None or plate_crop.size == 0:
            return variants

        clean = cls.crop_cleanup(plate_crop)

        # Grayscale conversion
        if len(clean.shape) == 3:
            gray = cv2.cvtColor(clean, cv2.COLOR_BGR2GRAY)
        else:
            gray = clean.copy()

        # Deskew correction
        gray = cls.deskew(gray)

        # 4x Resizing
        h, w = gray.shape[:2]
        if h > 0:
            scale_4x = max(1.0, 120.0 / h)
            resized_4x = cv2.resize(gray, (int(w * scale_4x), int(h * scale_4x)), interpolation=cv2.INTER_CUBIC)
        else:
            resized_4x = gray.copy()

        # Brightness Normalization
        normalized = cv2.normalize(resized_4x, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)

        # Variant 1: Original Resized 4x
        variants.append({"name": "variant_1_original_resized", "image": normalized})

        # Variant 2: CLAHE Contrast Enhanced
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        clahe_img = clahe.apply(normalized)
        variants.append({"name": "variant_2_clahe", "image": clahe_img})

        # Variant 3: Grayscale Denoised (Bilateral Filter + Gaussian Blur)
        denoised = cv2.bilateralFilter(clahe_img, d=9, sigmaColor=75, sigmaSpace=75)
        variants.append({"name": "variant_3_grayscale_denoised", "image": denoised})

        # Variant 4: Thresholding (OTSU / Adaptive)
        try:
            _, otsu_img = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            variants.append({"name": "variant_4_threshold", "image": otsu_img})
        except Exception:
            pass

        # Variant 5: Sharpened
        gaussian = cv2.GaussianBlur(denoised, (0, 0), 3.0)
        sharpened = cv2.addWeighted(denoised, 1.6, gaussian, -0.6, 0)
        variants.append({"name": "variant_5_sharpened", "image": sharpened})

        # Ensure all 1-channel variant images are converted to 3-channel BGR for optimal PaddleOCR confidence
        for v in variants:
            img = v["image"]
            if len(img.shape) == 2:
                v["image"] = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        return variants

    @staticmethod
    def deskew(image: np.ndarray) -> np.ndarray:
        """Deskew orientation alignment using thresholded feature extraction."""
        try:
            h, w = image.shape[:2]
            if h < 15 or w < 15:
                return image

            # Threshold first so minAreaRect evaluates foreground text/edges, not background gray pixels
            _, thresh = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) < 20:
                return image

            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            elif angle > 45:
                angle = 90 - angle
            else:
                angle = -angle

            if 0.5 < abs(angle) < 15.0:
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(
                    image, M, (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE
                )
                return rotated
        except Exception:
            pass
        return image
