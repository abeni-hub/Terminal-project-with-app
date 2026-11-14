import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
from app.config import settings

logger = logging.getLogger("MajorityVoter")

@dataclass
class OCRReading:
    plate_text: str
    confidence: float

class MajorityVoter:
    """
    Multi-frame Majority Voting per Track ID.
    Aggregates OCR predictions across frames and determines consensus plate text weighted by confidence.
    """
    def __init__(self, min_readings: int = None):
        self.min_readings = min_readings or settings.MAJORITY_VOTE_MIN_READINGS
        # track_id -> List[OCRReading]
        self.readings_by_track: Dict[int, List[OCRReading]] = defaultdict(list)
        # track_id -> finalized boolean
        self.finalized_tracks: Dict[int, str] = {}

    def add_observation(self, track_id: int, plate_text: str, confidence: float):
        if not plate_text or track_id in self.finalized_tracks:
            return

        self.readings_by_track[track_id].append(OCRReading(plate_text=plate_text, confidence=confidence))

    def get_consensus(self, track_id: int) -> Tuple[Optional[str], float, bool]:
        """
        Calculates consensus text for given track_id.
        Returns Tuple[consensus_plate_text, average_confidence, is_ready].
        """
        if track_id in self.finalized_tracks:
            return self.finalized_tracks[track_id], 0.95, True

        readings = self.readings_by_track.get(track_id, [])
        if not readings:
            return None, 0.0, False

        # Weighted vote tally
        scores: Dict[str, float] = defaultdict(float)
        counts: Dict[str, int] = defaultdict(int)

        for r in readings:
            scores[r.plate_text] += r.confidence
            counts[r.plate_text] += 1

        best_plate = max(scores.keys(), key=lambda k: scores[k])
        total_conf = scores[best_plate]
        vote_count = counts[best_plate]
        avg_confidence = total_conf / vote_count if vote_count > 0 else 0.0

        is_ready = len(readings) >= self.min_readings or vote_count >= 2

        if is_ready:
            self.finalized_tracks[track_id] = best_plate

        return best_plate, float(avg_confidence), is_ready

    def clear_track(self, track_id: int):
        if track_id in self.readings_by_track:
            del self.readings_by_track[track_id]
        if track_id in self.finalized_tracks:
            del self.finalized_tracks[track_id]
