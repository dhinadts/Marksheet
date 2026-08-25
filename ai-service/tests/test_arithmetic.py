from uuid import uuid4

from app.schemas.common import NormalizedBox
from app.schemas.results import ExtractedMarkResult, ExtractionStatus
from app.services.arithmetic import validate_arithmetic


def mark(label: str, value: float | None) -> ExtractedMarkResult:
    return ExtractedMarkResult(
        marking_scheme_item_id=uuid4(),
        question_id=uuid4(),
        question_part_id=None,
        label=label,
        raw_text=None if value is None else str(value),
        value=value,
        maximum_mark=15,
        confidence=0.9,
        status=ExtractionStatus.AUTO_ACCEPT,
        reason="TEST",
        bounding_box=NormalizedBox(x=0.1, y=0.1, width=0.1, height=0.1),
    )


def test_subparts_are_compared_with_written_total() -> None:
    result = validate_arithmetic([mark("Q11.i", 6), mark("Q11.ii", 5), mark("Q11.total", 12)])

    assert result.questions[0].calculated_total == 11
    assert result.questions[0].written_total == 12
    assert result.questions[0].matches is False
    assert "Q11_TOTAL_MISMATCH" in result.issues


def test_empty_subpart_remains_incomplete_instead_of_becoming_zero() -> None:
    result = validate_arithmetic([mark("Q15.i", 2), mark("Q15.ii", None), mark("Q15.total", 7)])

    assert not result.complete
    assert result.questions[0].calculated_total is None
    assert "Q15_EMPTY_SUBPART" in result.issues
