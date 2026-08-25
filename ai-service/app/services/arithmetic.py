from __future__ import annotations

import re

from app.schemas.results import (
    ExtractedMarkResult,
    ExtractionValidation,
    QuestionTotalValidation,
)

QUESTION_LABEL = re.compile(r"^(Q\d+)(?:[. _-](i{1,3}|total))?$", re.IGNORECASE)


def validate_arithmetic(marks: list[ExtractedMarkResult]) -> ExtractionValidation:
    grouped: dict[str, dict[str, ExtractedMarkResult]] = {}
    issues: list[str] = []
    for mark in marks:
        match = QUESTION_LABEL.match(mark.label.strip())
        if not match:
            continue
        question, role = match.group(1).upper(), (match.group(2) or "total").lower()
        grouped.setdefault(question, {})[role] = mark

    validations: list[QuestionTotalValidation] = []
    question_totals: list[float] = []
    complete = bool(grouped)
    for question in sorted(grouped, key=lambda value: int(value[1:])):
        cells = grouped[question]
        subparts = [cells[key] for key in ("i", "ii", "iii") if key in cells]
        written = cells.get("total")
        calculated = None
        if subparts and all(cell.value is not None for cell in subparts):
            calculated = sum(cell.value or 0 for cell in subparts)
        written_value = written.value if written else None
        matches = None if calculated is None or written_value is None else calculated == written_value
        selected_total = written_value if written_value is not None else calculated
        if selected_total is not None:
            question_totals.append(selected_total)
        else:
            complete = False
            issues.append(f"{question}_MISSING_TOTAL")
        if matches is False:
            complete = False
            issues.append(f"{question}_TOTAL_MISMATCH")
        if any(cell.value is None for cell in subparts):
            complete = False
            issues.append(f"{question}_EMPTY_SUBPART")
        validations.append(
            QuestionTotalValidation(
                question=question,
                calculated_total=calculated,
                written_total=written_value,
                matches=matches,
            )
        )
    return ExtractionValidation(
        questions=validations,
        calculated_grand_total=sum(question_totals) if question_totals else None,
        complete=complete,
        issues=issues,
    )
