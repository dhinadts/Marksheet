from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ObjectReference(StrictModel):
    bucket: str = Field(min_length=3, max_length=255)
    object_key: str = Field(min_length=3, max_length=1024)
    mime_type: str = Field(pattern=r"^image/(jpeg|png|heic)$")
    size_bytes: int = Field(ge=1024, le=100 * 1024 * 1024)
    checksum_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class ProcessingContext(StrictModel):
    tenant_id: UUID
    mark_sheet_id: UUID
    image_id: UUID
    question_paper_version_id: UUID
    marking_scheme_version_id: UUID


class NormalizedBox(StrictModel):
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def remain_inside_page(self) -> NormalizedBox:
        if self.x + self.width > 1 or self.y + self.height > 1:
            raise ValueError("normalized box must remain inside the page")
        return self


class TemplateCell(StrictModel):
    marking_scheme_item_id: UUID
    question_id: UUID
    question_part_id: UUID | None = None
    label: str = Field(min_length=1, max_length=100)
    maximum_mark: float = Field(ge=0, le=1000)
    box: NormalizedBox


class TemplateDefinition(StrictModel):
    template_id: UUID
    version: int = Field(ge=1)
    expected_aspect_ratio: float = Field(gt=0.2, lt=5)
    aspect_ratio_tolerance: float = Field(gt=0, le=0.5, default=0.2)
    cells: list[TemplateCell] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def unique_items(self) -> TemplateDefinition:
        item_ids = [cell.marking_scheme_item_id for cell in self.cells]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("template cells must have unique marking_scheme_item_id values")
        return self


class ConfidenceThresholds(StrictModel):
    auto_accept: float = Field(ge=0, le=1)
    review_recommended: float = Field(ge=0, le=1)
    review_required: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def descending(self) -> ConfidenceThresholds:
        if not self.auto_accept > self.review_recommended > self.review_required:
            raise ValueError("confidence thresholds must be strictly descending")
        return self


class StageRequest(StrictModel):
    context: ProcessingContext
    source: ObjectReference

    @model_validator(mode="after")
    def enforce_tenant_prefix(self) -> StageRequest:
        if not self.source.object_key.startswith(f"{self.context.tenant_id}/"):
            raise ValueError("source object_key must start with the context tenant_id")
        return self


class TemplateStageRequest(StageRequest):
    template: TemplateDefinition


class RecognitionRequest(TemplateStageRequest):
    confidence_thresholds: ConfidenceThresholds
    model_version_id: UUID


class ProcessMarkSheetRequest(RecognitionRequest):
    job_id: UUID


class MarkCandidate(StrictModel):
    marking_scheme_item_id: UUID
    question_id: UUID
    question_part_id: UUID | None = None
    label: str = Field(min_length=1, max_length=100)
    raw_text: str | None = Field(default=None, max_length=100)
    value: float | None = None
    maximum_mark: float = Field(ge=0, le=1000)
    confidence: float = Field(ge=0, le=1)
    bounding_box: NormalizedBox


class ValidateMarksRequest(StrictModel):
    context: ProcessingContext
    confidence_thresholds: ConfidenceThresholds
    candidates: list[MarkCandidate] = Field(min_length=1, max_length=500)


class JobStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobResponse(StrictModel):
    job_id: UUID
    tenant_id: UUID
    status: JobStatus
    result: dict[str, object] | None = None
    error_code: str | None = None
    error_message: str | None = None
