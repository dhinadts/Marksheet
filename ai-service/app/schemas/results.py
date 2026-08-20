from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import Field

from app.schemas.common import NormalizedBox, ObjectReference, StrictModel


class QualityMetrics(StrictModel):
    width: int
    height: int
    brightness: float
    blur_variance: float
    glare_ratio: float
    document_area_ratio: float


class QualityResponse(StrictModel):
    acceptable: bool
    reasons: list[str]
    metrics: QualityMetrics


class PreprocessResponse(StrictModel):
    processed: ObjectReference
    width: int
    height: int
    deskew_angle: float
    perspective_corrected: bool


class TemplateMatchResponse(StrictModel):
    template_id: UUID
    template_version: int
    matched: bool
    confidence: float
    observed_aspect_ratio: float


class DetectedCell(StrictModel):
    marking_scheme_item_id: UUID
    question_id: UUID
    question_part_id: UUID | None
    label: str
    maximum_mark: float
    bounding_box: NormalizedBox
    crop: ObjectReference | None = None


class CellDetectionResponse(StrictModel):
    template_match: TemplateMatchResponse
    cells: list[DetectedCell]


class ExtractionStatus(StrEnum):
    AUTO_ACCEPT = "AUTO_ACCEPT"
    REVIEW_RECOMMENDED = "REVIEW_RECOMMENDED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    MANUAL_ENTRY_REQUIRED = "MANUAL_ENTRY_REQUIRED"
    INVALID_EXTRACTION = "INVALID_EXTRACTION"


class ExtractedMarkResult(StrictModel):
    marking_scheme_item_id: UUID
    question_id: UUID
    question_part_id: UUID | None
    label: str
    raw_text: str | None
    value: float | None
    maximum_mark: float
    confidence: float = Field(ge=0, le=1)
    status: ExtractionStatus
    reason: str
    bounding_box: NormalizedBox


class ExtractionResponse(StrictModel):
    model_version_id: UUID
    template_match: TemplateMatchResponse
    marks: list[ExtractedMarkResult]
    requires_human_review: bool = True
