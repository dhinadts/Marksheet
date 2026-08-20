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


class StageRequest(StrictModel):
    context: ProcessingContext
    source: ObjectReference

    @model_validator(mode="after")
    def enforce_tenant_prefix(self) -> StageRequest:
        if not self.source.object_key.startswith(f"{self.context.tenant_id}/"):
            raise ValueError("source object_key must start with the context tenant_id")
        return self


class ProcessMarkSheetRequest(StageRequest):
    pass


class JobStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobResponse(StrictModel):
    job_id: UUID
    status: JobStatus
