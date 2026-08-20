from __future__ import annotations

from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.dependencies import authorize_internal_request
from app.schemas.common import (
    JobResponse,
    ProcessMarkSheetRequest,
    RecognitionRequest,
    StageRequest,
    TemplateStageRequest,
    ValidateMarksRequest,
)
from app.schemas.results import (
    CellDetectionResponse,
    ExtractedMarkResult,
    ExtractionResponse,
    PreprocessResponse,
    QualityResponse,
    TemplateMatchResponse,
)
from app.services.jobs import JobQueue, RedisJobQueue
from app.services.pipeline import PipelineService
from app.services.storage import S3ObjectStore
from app.services.validation import classify_extraction

router = APIRouter(
    prefix="/ai",
    tags=["AI pipeline"],
    dependencies=[Depends(authorize_internal_request)],
)


def pipeline_for(request: Request) -> PipelineService:
    existing = getattr(request.app.state, "pipeline_service", None)
    if existing is not None:
        return cast(PipelineService, existing)
    created = PipelineService(request.app.state.settings, S3ObjectStore(request.app.state.settings))
    request.app.state.pipeline_service = created
    return created


def queue_for(request: Request) -> JobQueue:
    existing = getattr(request.app.state, "job_queue", None)
    if existing is not None:
        return existing
    created = RedisJobQueue(request.app.state.settings.redis_url)
    request.app.state.job_queue = created
    return created


@router.post("/quality-check", response_model=QualityResponse)
def quality_check(payload: StageRequest, request: Request) -> QualityResponse:
    return pipeline_for(request).quality_check(payload)


@router.post("/preprocess", response_model=PreprocessResponse)
def preprocess(payload: StageRequest, request: Request) -> PreprocessResponse:
    return pipeline_for(request).preprocess(payload)


@router.post("/detect-template", response_model=TemplateMatchResponse)
def detect_template(payload: TemplateStageRequest, request: Request) -> TemplateMatchResponse:
    return pipeline_for(request).detect_template(payload)


@router.post("/detect-cells", response_model=CellDetectionResponse)
def detect_cells(payload: TemplateStageRequest, request: Request) -> CellDetectionResponse:
    return pipeline_for(request).detect_cells(payload)


@router.post("/extract-marks", response_model=ExtractionResponse)
def extract_marks(payload: RecognitionRequest, request: Request) -> ExtractionResponse:
    return pipeline_for(request).extract_marks(payload)


@router.post("/validate-marks", response_model=list[ExtractedMarkResult])
def validate_marks(payload: ValidateMarksRequest) -> list[ExtractedMarkResult]:
    results: list[ExtractedMarkResult] = []
    for candidate in payload.candidates:
        extraction_status, reason = classify_extraction(
            candidate.value,
            candidate.maximum_mark,
            candidate.confidence,
            payload.confidence_thresholds,
        )
        results.append(
            ExtractedMarkResult(
                **candidate.model_dump(),
                status=extraction_status,
                reason=reason,
            )
        )
    return results


@router.post(
    "/process-mark-sheet", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED
)
def process_mark_sheet(payload: ProcessMarkSheetRequest, request: Request) -> JobResponse:
    return queue_for(request).enqueue(payload)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: UUID,
    request: Request,
    tenant_id: Annotated[
        UUID, Query(description="Tenant scope supplied by the trusted NestJS caller")
    ],
) -> JobResponse:
    return queue_for(request).get(tenant_id, job_id)
