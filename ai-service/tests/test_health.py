from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def client(api_key: str | None = None) -> TestClient:
    return TestClient(create_app(Settings(internal_api_key=api_key)))


def test_health() -> None:
    response = client().get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai-service"}


def test_readiness_requires_internal_auth_configuration() -> None:
    unavailable = client().get("/ready")
    available = client("a" * 32).get("/ready")

    assert unavailable.status_code == 503
    assert unavailable.json()["status"] == "not_ready"
    assert available.status_code == 200
    assert available.json()["status"] == "ready"
    assert all(not item["available"] for item in available.json()["capabilities"])
