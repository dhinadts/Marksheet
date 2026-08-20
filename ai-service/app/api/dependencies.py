import secrets
from typing import Annotated

from fastapi import Header, Request

from app.core.errors import ServiceError


def authorize_internal_request(
    request: Request,
    supplied_key: Annotated[str | None, Header(alias="X-AI-Service-Key")] = None,
) -> None:
    configured_key: str | None = request.app.state.settings.internal_api_key
    if configured_key is None:
        raise ServiceError(
            503, "SERVICE_NOT_CONFIGURED", "Internal API authentication is not configured"
        )
    if supplied_key is None or not secrets.compare_digest(supplied_key, configured_key):
        raise ServiceError(401, "UNAUTHORIZED", "Valid internal service credentials are required")
