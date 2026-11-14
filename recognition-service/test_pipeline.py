import sys
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestPipeline")

def test_anpr_modules():
    logger.info("🧪 Testing Upgraded Ethiopian ANPR Pipeline (PaddleOCR + 5 Variants + No Fake Plates)...")

    # 1. Test Image Enhancement (5 Preprocessing Variants)
    from app.preprocessing.image_enhancer import ImageEnhancer
    dummy_crop = np.zeros((80, 200, 3), dtype=np.uint8)
    variants = ImageEnhancer.get_ocr_variants(dummy_crop)
    assert len(variants) == 5
    for v in variants:
        assert len(v["image"].shape) == 3 and v["image"].shape[2] == 3, f"Variant {v['name']} is not 3-channel BGR"
    variant_names = [v["name"] for v in variants]
    logger.info(f"✅ ImageEnhancer test passed ({len(variants)} 3-channel BGR variants: {variant_names}).")

    # 2. Test Character Correction (Positional)
    from app.ocr.character_correction import CharacterCorrector
    corrected_plate = CharacterCorrector.correct("AA12345O")
    assert corrected_plate == "AA123450"  # O in number section becomes 0
    logger.info(f"✅ CharacterCorrector test passed (Corrected 'AA12345O' -> '{corrected_plate}').")

    # 3. Test Ethiopian Plate Validator (aa-123456 -> AA123456)
    from app.validation.plate_validator import PlateValidator
    v1 = PlateValidator.validate_and_normalize("aa-123456", 0.95)
    assert v1.normalized_text == "AA123456" and v1.is_valid
    logger.info(f"✅ PlateValidator test passed ('aa-123456' -> '{v1.normalized_text}').")

    v2 = PlateValidator.validate_and_normalize("or12345", 0.90)
    assert v2.normalized_text == "OR12345" and v2.is_valid
    logger.info(f"✅ PlateValidator regional test passed ('or12345' -> '{v2.normalized_text}').")

    v3 = PlateValidator.validate_and_normalize("dd987654", 0.92)
    assert v3.normalized_text == "DD987654" and v3.is_valid
    logger.info(f"✅ PlateValidator DD test passed ('dd987654' -> '{v3.normalized_text}').")

    # 4. Test No-Fake-Plates Policy
    v_invalid = PlateValidator.validate_and_normalize("XYZ", 0.1)
    assert v_invalid.normalized_text == "" and not v_invalid.is_valid
    logger.info("✅ No-Fake-Plates policy test passed (Invalid OCR input returned empty string).")

    # 5. Test Track ID Majority Voting (collections.Counter)
    from app.ocr.voting import TrackMajorityVoter
    voter = TrackMajorityVoter(min_readings=3)
    voter.add_frame_reading(track_id=20, plate_text="AA123456", confidence=0.91)
    voter.add_frame_reading(track_id=20, plate_text="AA123458", confidence=0.95)
    voter.add_frame_reading(track_id=20, plate_text="AA123456", confidence=0.97)
    voter.add_frame_reading(track_id=20, plate_text="AA123456", confidence=0.98)

    consensus, conf, ready = voter.get_track_consensus(20)
    assert consensus == "AA123456" and ready
    logger.info(f"✅ TrackMajorityVoter (collections.Counter) test passed (Consensus: '{consensus}', Conf: {conf:.2f}).")

    # 6. Test OCR Recognizer Dict Output & No-Fake-Plates return
    from app.ocr.recognizer import OCRRecognizer
    rec = OCRRecognizer()
    dict_res = rec.recognize_dict(dummy_crop)
    assert dict_res["text"] == "" and dict_res["confidence"] == 0.0
    logger.info(f"✅ OCRRecognizer dict output test passed ({dict_res}).")

    logger.info("🎉 All Upgraded ANPR Pipeline Tests Passed Successfully!")

if __name__ == "__main__":
    test_anpr_modules()
