from app.validation.plate_validator import PlateValidator

class PlateNormalizer:
    @staticmethod
    def normalize(raw_text: str) -> str:
        """
        Normalizes OCR plate text using PlateValidator:
        - Uppercase & strip symbols/spaces
        - Positional OCR character correction
        - Ethiopian plate formatting (e.g. AA123456, OR12345, DD987654)
        """
        if not raw_text:
            return ""
        result = PlateValidator.validate_and_normalize(raw_text)
        return result.normalized_text
