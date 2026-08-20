from typing import NoReturn
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.api.dependencies import authorize_internal_request
from app.core.errors import CapabilityUnavailableError, ServiceError
from app.schemas.common import JobResponse, ProcessMarkSheetRequest, StageRequest

router = APIRouter(
    prefix="/ai",
    tags=["AI pipeline"],
    dependencies=[Depends(authorize_internal_request)],
)


def unavailable(capability: str, phase: int) -> NoReturn:
    raise CapabilityUnavailableError(capability, phase)


def enforce_source_policy(payload: StageRequest, request: Request) -> None:
    if payload.source.size_bytes > request.app.state.settings.max_image_bytes:
        raise ServiceError(413, "IMAGE_TOO_LARGE", "Source image exceeds the configured byte limit")


@router.post("/quality-check")
def quality_check(payload: StageRequest, request: Request) -> None:
    enforce_source_policy(payload, request)
    unavailable("Image quality checking", 10)


@router.post("/preprocess")
def preprocess(payload: StageRequest, request: Request) -> None:
    enforce_source_policy(payload, request)
    unavailable("Image preprocessing", 10)


@router.post("/detect-template")
def detect_template(payload: StageRequest, request: Request) -> None:
    enforce_source_policy(payload, request)
    unavailable("Template detection", 11)


@router.post("/detect-cells")
def detect_cells(payload: StageRequest, request: Request) -> None:
    enforce_source_policy(payload, request)
    unavailable("Question-cell detection", 11)


@router.post("/extract-marks")
def extract_marks(payload: StageRequest, request: Request) -> None:
    enforce_source_policy(payload, request)
    unavailable("Handwriting recognition", 12)


@router.post("/validate-marks")
def validate_marks(payload: StageRequest, request: Request) -> None:
    enforce_source_policy(payload, request)
    unavailable("AI mark validation", 12)


@router.post("/process-mark-sheet", response_model=JobResponse)
def process_mark_sheet(payload: ProcessMarkSheetRequest, request: Request) -> JobResponse:
    enforce_source_policy(payload, request)
    unavailable("Asynchronous mark-sheet processing", 12)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID) -> JobResponse:
    raise ServiceError(404, "JOB_NOT_FOUND", f"AI job {job_id} was not found")
