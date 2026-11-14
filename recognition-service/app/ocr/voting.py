import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Dict, List, Tuple
from app.config import settings

logger = logging.getLogger("OCRVoting")

@dataclass
class FrameOCRReading:
    plate_text: str
    confidence: float

class TrackMajorityVoter:
    """
    Track ID based Majority Voting module using collections.Counter.
    Accumulates OCR predictions for a vehicle Track ID across multiple video frames
    to return the consensus plate text. Dynamic reset when new plates are presented.
    """
    def __init__(self, min_readings: int = None):
        self.min_readings = min_readings or settings.MAJORITY_VOTE_MIN_READINGS
        self.readings_by_track: Dict[int, List[FrameOCRReading]] = defaultdict(list)
        self.finalized_consensus: Dict[int, Tuple[str, float]] = {}

    def add_observation(self, track_id: int, plate_text: str, confidence: float):
        if not plate_text:
            return

        # If a completely different plate text is read for this track, reset consensus
        if track_id in self.finalized_consensus:
            old_plate, _ = self.finalized_consensus[track_id]
            if old_plate != plate_text and confidence >= 0.70:
                logger.info(f"🔄 Plate change detected on track {track_id}: {old_plate} -> {plate_text}. Resetting voter.")
                self.clear_track(track_id)

        self.readings_by_track[track_id].append(FrameOCRReading(plate_text=plate_text, confidence=confidence))
        # Keep only the 10 most recent readings to prevent stale plate lock-in
        if len(self.readings_by_track[track_id]) > 10:
            self.readings_by_track[track_id] = self.readings_by_track[track_id][-10:]

    def get_consensus(self, track_id: int) -> Tuple[str, float, bool]:
        """
        Calculates consensus plate text for track_id using collections.Counter.
        Returns Tuple[plate_text, average_confidence, is_ready].
        """
        readings = self.readings_by_track.get(track_id, [])
        if not readings:
            return "", 0.0, False

        # Use collections.Counter to count occurrences of each plate prediction
        text_counts = Counter([r.plate_text for r in readings if r.plate_text])
        if not text_counts:
            return "", 0.0, False

        most_common_plate, count = text_counts.most_common(1)[0]

        # Calculate average confidence score for the winning plate text
        matching_confs = [r.confidence for r in readings if r.plate_text == most_common_plate]
        avg_conf = sum(matching_confs) / len(matching_confs) if matching_confs else 0.0

        is_ready = len(readings) >= 1 or count >= 1

        if is_ready:
            self.finalized_consensus[track_id] = (most_common_plate, float(avg_conf))

        return most_common_plate, float(avg_conf), is_ready

    def clear_track(self, track_id: int):
        if track_id in self.readings_by_track:
            del self.readings_by_track[track_id]
        if track_id in self.finalized_consensus:
            del self.finalized_consensus[track_id]
