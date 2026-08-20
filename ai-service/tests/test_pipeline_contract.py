from uuid import UUID

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

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


def test_pipeline_requires_internal_service_authentication() -> None:
    response = client().post("/ai/quality-check", json=request_body())

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    UUID(response.headers["X-Correlation-ID"])


def test_phase_ten_capability_is_not_falsely_reported_as_working() -> None:
    response = client().post(
        "/ai/quality-check",
        json=request_body(),
        headers={
            "X-AI-Service-Key": API_KEY,
            "X-Correlation-ID": "77777777-7777-4777-8777-777777777777",
        },
    )

    assert response.status_code == 501
    assert response.json() == {
        "error": {
            "code": "CAPABILITY_NOT_IMPLEMENTED",
            "message": "Image quality checking is reserved for Phase 10",
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


def test_configured_image_limit_is_enforced_before_processing() -> None:
    app = create_app(Settings(internal_api_key=API_KEY, max_image_bytes=2048))
    response = TestClient(app).post(
        "/ai/quality-check",
        json=request_body(),
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "IMAGE_TOO_LARGE"


def test_unknown_job_returns_typed_not_found() -> None:
    job_id = "66666666-6666-4666-8666-666666666666"
    response = client().get(
        f"/ai/jobs/{job_id}",
        headers={"X-AI-Service-Key": API_KEY},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "JOB_NOT_FOUND"
