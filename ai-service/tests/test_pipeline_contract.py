from uuid import UUID

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import ServiceError
from app.main import create_app
from app.schemas.common import JobResponse, JobStatus, ProcessMarkSheetRequest

API_KEY = "phase-nine-test-internal-key-0001"
TENANT_ID = "11111111-1111-4111-8111-111111111111"


def client() -> TestClient:
    return TestClient(create_app(Settings(internal_api_key=API_KEY)))


def request_body(object_key: str | None = None) -> dict[str, object]:
    return {
        "context": {
            "tenant_id": TENANT_ID,
            "mark_sheet_id": "22222222-2222-4222-8222-222222222222",
            "image_id": "33333333-3333-4333-8333-333333333333",
            "question_paper_version_id": "44444444-4444-4444-8444-444444444444",
            "marking_scheme_version_id": "55555555-5555-4555-8555-555555555555",
        },
        "source": {
            "bucket": "private-marks",
            "object_key": object_key or f"{TENANT_ID}/mark-sheets/sheet/original/page-1",
            "mime_type": "image/jpeg",
            "size_bytes": 4096,
            "checksum_sha256": "a" * 64,
        },
    }


def template_body() -> dict[str, object]:
    return {
        "template_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "version": 1,
        "expected_aspect_ratio": 0.75,
        "cells": [
            {
                "marking_scheme_item_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                "question_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                "label": "Q1",
                "maximum_mark": 2,
                "box": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.1},
            }
        ],
    }


def test_pipeline_requires_internal_service_authentication() -> None:
    response = client().post("/ai/quality-check", json=request_body())

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    UUID(response.headers["X-Correlation-ID"])


def test_processing_fails_closed_when_storage_is_not_configured() -> None:
    response = client().post(
        "/ai/quality-check",
        json=request_body(),
        headers={
            "X-AI-Service-Key": API_KEY,
            "X-Correlation-ID": "77777777-7777-4777-8777-777777777777",
        },
    )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "STORAGE_NOT_CONFIGURED",
            "message": "AI object storage is not configured",
            "correlation_id": "77777777-7777-4777-8777-777777777777",
        }
    }


def test_object_key_must_be_scoped_to_request_tenant() -> None:
    response = client().post(
        "/ai/preprocess",
        json=request_body("99999999-9999-4999-8999-999999999999/mark-sheets/image"),
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_unknown_job_returns_typed_not_found() -> None:
    class MissingQueue:
        def get(self, tenant_id: UUID, job_id: UUID) -> JobResponse:
            raise ServiceError(404, "JOB_NOT_FOUND", f"AI job {job_id} was not found")

    job_id = "66666666-6666-4666-8666-666666666666"
    application = create_app(Settings(internal_api_key=API_KEY))
    application.state.job_queue = MissingQueue()
    response = TestClient(application).get(
        f"/ai/jobs/{job_id}?tenant_id={TENANT_ID}",
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "JOB_NOT_FOUND"


def test_job_status_requires_explicit_tenant_scope() -> None:
    response = client().get(
        "/ai/jobs/66666666-6666-4666-8666-666666666666",
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 422


def test_validation_never_accepts_mark_above_scheme_maximum() -> None:
    body = request_body()
    response = client().post(
        "/ai/validate-marks",
        json={
            "context": body["context"],
            "confidence_thresholds": {
                "auto_accept": 0.95,
                "review_recommended": 0.8,
                "review_required": 0.6,
            },
            "candidates": [
                {
                    "marking_scheme_item_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    "question_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    "label": "Q1",
                    "raw_text": "8",
                    "value": 8,
                    "maximum_mark": 2,
                    "confidence": 0.99,
                    "bounding_box": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.1},
                }
            ],
        },
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 200
    assert response.json()[0]["status"] == "INVALID_EXTRACTION"


def test_process_endpoint_enqueues_idempotent_external_job() -> None:
    class CapturingQueue:
        def enqueue(self, payload: ProcessMarkSheetRequest) -> JobResponse:
            return JobResponse(
                job_id=payload.job_id,
                tenant_id=payload.context.tenant_id,
                status=JobStatus.PENDING,
            )

    body = request_body()
    body.update(
        {
            "template": template_body(),
            "confidence_thresholds": {
                "auto_accept": 0.95,
                "review_recommended": 0.8,
                "review_required": 0.6,
            },
            "model_version_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            "job_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        }
    )
    application = create_app(Settings(internal_api_key=API_KEY))
    application.state.job_queue = CapturingQueue()

    response = TestClient(application).post(
        "/ai/process-mark-sheet",
        json=body,
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "PENDING"
