import pytest

from app.schemas.common import ConfidenceThresholds
from app.schemas.results import ExtractionStatus
from app.services.validation import classify_extraction


@pytest.fixture
def thresholds() -> ConfidenceThresholds:
    return ConfidenceThresholds(auto_accept=0.95, review_recommended=0.8, review_required=0.6)


def test_mark_above_configured_maximum_is_invalid(thresholds: ConfidenceThresholds) -> None:
    status, reason = classify_extraction(8, 2, 0.99, thresholds)

    assert status == ExtractionStatus.INVALID_EXTRACTION
    assert reason == "VALUE_OUTSIDE_MARKING_SCHEME_RANGE"


@pytest.mark.parametrize(
    ("confidence", "expected"),
    [
        (0.96, ExtractionStatus.AUTO_ACCEPT),
        (0.85, ExtractionStatus.REVIEW_RECOMMENDED),
        (0.7, ExtractionStatus.REVIEW_REQUIRED),
        (0.4, ExtractionStatus.MANUAL_ENTRY_REQUIRED),
    ],
)
def test_configured_confidence_boundaries(
    thresholds: ConfidenceThresholds,
    confidence: float,
    expected: ExtractionStatus,
) -> None:
    assert classify_extraction(1, 2, confidence, thresholds)[0] == expected
