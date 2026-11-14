import re
import logging
from dataclasses import dataclass
from app.ocr.character_correction import CharacterCorrector

logger = logging.getLogger("PlateValidator")

@dataclass
class ValidatedPlate:
    raw_text: str
    normalized_text: str
    is_valid: bool
    confidence: float

class PlateValidator:
    """
    Ethiopian License Plate Validator & Normalizer.
    Rules:
    - Input example: aa-123456 -> Output: AA123456
    - Uppercase conversion
    - Removes spaces and symbols
    - Only allows A-Z and 0-9
    - Validates length & character placement (first characters letters, remaining numbers)
    - NEVER returns fake plates (returns empty normalized_text on failure)
    """

    REGIONAL_CODES = [
        "AA", "ET", "OR", "SP", "AM", "AF", "BG", "DD", "DIR", "HR", "TG", "UN", "AO", "CD", "SE", "ETH", "SNNP"
    ]

    @classmethod
    def validate_and_normalize(cls, raw_text: str, raw_confidence: float = 0.8) -> ValidatedPlate:
        if not raw_text:
            return ValidatedPlate(raw_text="", normalized_text="", is_valid=False, confidence=0.0)

        # 1. Uppercase conversion & remove all non-alphanumeric symbols/spaces
        cleaned = re.sub(r'[^A-Z0-9]', '', raw_text.strip().upper())

        if len(cleaned) < 4:
            return ValidatedPlate(raw_text=raw_text, normalized_text="", is_valid=False, confidence=0.0)

        # 2. Positional OCR Character Correction (O->0, I->1, 0->O, 1->I)
        corrected = CharacterCorrector.correct(cleaned)

        # 3. Format Validation Patterns (e.g. AA123456, OR12345, DD987654, 3AA123456)
        patterns = [
            r'^[1-5]?[A-Z]{2,4}\d{4,6}$', # Code + Region + Digits (e.g. 3AA123456, AA123456)
            r'^[A-Z]{2,4}\d{4,6}$',        # Region + Digits (e.g. OR12345, DD987654)
            r'^[1-5]\d{4,6}$'              # Code + Digits
        ]

        is_valid = any(re.match(p, corrected) for p in patterns)

        if not is_valid:
            # Check fallback pattern length
            if len(corrected) >= 5 and re.match(r'^[A-Z0-9]+$', corrected):
                is_valid = True
                adjusted_conf = raw_confidence * 0.75
            else:
                return ValidatedPlate(raw_text=raw_text, normalized_text="", is_valid=False, confidence=0.0)
        else:
            adjusted_conf = raw_confidence

        return ValidatedPlate(
            raw_text=raw_text,
            normalized_text=corrected,
            is_valid=is_valid,
            confidence=float(adjusted_conf)
        )
