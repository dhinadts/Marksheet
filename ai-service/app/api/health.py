from fastapi import APIRouter, Request, Response, status

from app.services.capabilities import CAPABILITIES

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@router.get("/ready")
def readiness(request: Request, response: Response) -> dict[str, object]:
    configured = request.app.state.settings.internal_api_key is not None
    if not configured:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if configured else "not_ready",
        "service": "ai-service",
        "capabilities": [
            {"name": item.name, "available": item.available, "target_phase": item.target_phase}
            for item in CAPABILITIES
        ],
    }
