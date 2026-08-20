from app.schemas.common import ConfidenceThresholds
from app.schemas.results import ExtractionStatus


def classify_extraction(
    value: float | None,
    maximum_mark: float,
    confidence: float,
    thresholds: ConfidenceThresholds,
) -> tuple[ExtractionStatus, str]:
    if value is None:
        return ExtractionStatus.MANUAL_ENTRY_REQUIRED, "MODEL_RETURNED_NO_VALUE"
    if value < 0 or value > maximum_mark:
        return ExtractionStatus.INVALID_EXTRACTION, "VALUE_OUTSIDE_MARKING_SCHEME_RANGE"
    if confidence >= thresholds.auto_accept:
        return ExtractionStatus.AUTO_ACCEPT, "CONFIDENCE_ABOVE_AUTO_ACCEPT_THRESHOLD"
    if confidence >= thresholds.review_recommended:
        return ExtractionStatus.REVIEW_RECOMMENDED, "CONFIDENCE_REVIEW_RECOMMENDED"
    if confidence >= thresholds.review_required:
        return ExtractionStatus.REVIEW_REQUIRED, "LOW_CONFIDENCE"
    return ExtractionStatus.MANUAL_ENTRY_REQUIRED, "CONFIDENCE_BELOW_RECOGNITION_THRESHOLD"
