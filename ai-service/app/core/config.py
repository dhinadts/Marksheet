from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime settings loaded without embedding development credentials."""

    environment: str = "development"
    log_level: str = "INFO"
    internal_api_key: str | None = None
    max_image_bytes: int = 25 * 1024 * 1024

    @classmethod
    def from_environment(cls) -> Settings:
        raw_limit = os.getenv("AI_MAX_IMAGE_BYTES", str(25 * 1024 * 1024))
        try:
            limit = int(raw_limit)
        except ValueError as error:
            raise ValueError("AI_MAX_IMAGE_BYTES must be an integer") from error
        if not 1024 <= limit <= 100 * 1024 * 1024:
            raise ValueError("AI_MAX_IMAGE_BYTES must be between 1 KiB and 100 MiB")

        key = os.getenv("AI_INTERNAL_API_KEY") or None
        if key is not None and len(key) < 32:
            raise ValueError("AI_INTERNAL_API_KEY must contain at least 32 characters")

        log_level = os.getenv("AI_LOG_LEVEL", "INFO").upper()
        if log_level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("AI_LOG_LEVEL must be a standard logging level")

        return cls(
            environment=os.getenv("AI_ENVIRONMENT", "development"),
            log_level=log_level,
            internal_api_key=key,
            max_image_bytes=limit,
        )
