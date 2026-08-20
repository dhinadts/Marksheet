from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from time import perf_counter
from uuid import UUID, uuid4

from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.pipeline import router as pipeline_router
from app.core.config import Settings
from app.core.errors import ServiceError
from app.core.logging import bind_correlation_id, configure_logging, reset_correlation_id

NextHandler = Callable[[Request], Awaitable[Response]]
logger = logging.getLogger("ai_marks.requests")


def request_id_for(request: Request) -> str:
    existing = getattr(request.state, "correlation_id", None)
    if isinstance(existing, str):
        return existing
    supplied = request.headers.get("X-Correlation-ID")
    try:
        return str(UUID(supplied)) if supplied else str(uuid4())
    except ValueError:
        return str(uuid4())


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime = settings or Settings.from_environment()
    configure_logging(runtime.log_level)
    application = FastAPI(
        title="AI-MARKS AI Service",
        description="Internal, advisory image-processing and inference boundary for AI-MARKS.",
        version="0.2.0",
    )
    application.state.settings = runtime

    @application.middleware("http")
    async def request_context(request: Request, call_next: NextHandler) -> Response:
        request_id = request_id_for(request)
        request.state.correlation_id = request_id
        token = bind_correlation_id(request_id)
        started_at = perf_counter()
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = request_id
            elapsed_ms = (perf_counter() - started_at) * 1000
            logger.info(
                "%s %s completed with %s in %.2fms",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )
            return response
        finally:
            reset_correlation_id(token)

    @application.exception_handler(ServiceError)
    async def service_error(request: Request, error: ServiceError) -> JSONResponse:
        request_id = request_id_for(request)
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "correlation_id": request_id,
                }
            },
            headers={"X-Correlation-ID": request_id},
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        request_id = request_id_for(request)
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "correlation_id": request_id,
                    "details": jsonable_encoder(error.errors()),
                }
            },
            headers={"X-Correlation-ID": request_id},
        )

    application.include_router(health_router)
    application.include_router(pipeline_router)
    return application


app = create_app()
