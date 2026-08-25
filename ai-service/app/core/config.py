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
    aws_region: str = "ap-south-1"
    storage_bucket: str | None = None
    storage_endpoint: str | None = None
    storage_force_path_style: bool = False
    model_path: str | None = None
    model_checksum_sha256: str | None = None
    model_labels: tuple[str, ...] = tuple(str(value) for value in range(10))
    redis_url: str | None = None
    marks_debug: bool = False
    marks_min_confidence: float = 0.65
    marks_auto_accept_confidence: float = 0.85

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

        checksum = os.getenv("AI_MODEL_CHECKSUM_SHA256") or None
        if checksum is not None and (
            len(checksum) != 64 or any(c not in "0123456789abcdefABCDEF" for c in checksum)
        ):
            raise ValueError("AI_MODEL_CHECKSUM_SHA256 must be a hexadecimal digest")
        labels = tuple(
            item.strip() for item in os.getenv("AI_MODEL_LABELS", "0,1,2,3,4,5,6,7,8,9").split(",")
        )
        if not labels or any(not item for item in labels) or len(set(labels)) != len(labels):
            raise ValueError("AI_MODEL_LABELS must contain unique, non-empty labels")

        return cls(
            environment=os.getenv("AI_ENVIRONMENT", "development"),
            log_level=log_level,
            internal_api_key=key,
            max_image_bytes=limit,
            aws_region=os.getenv("AWS_REGION", "ap-south-1"),
            storage_bucket=os.getenv("AWS_S3_BUCKET") or None,
            storage_endpoint=os.getenv("AWS_S3_ENDPOINT") or None,
            storage_force_path_style=os.getenv("AWS_S3_FORCE_PATH_STYLE", "false").lower()
            == "true",
            model_path=os.getenv("AI_MODEL_PATH") or None,
            model_checksum_sha256=checksum.lower() if checksum else None,
            model_labels=labels,
            redis_url=os.getenv("REDIS_URL") or None,
            marks_debug=os.getenv("MARKS_DEBUG", "false").lower() == "true",
            marks_min_confidence=float(os.getenv("MARKS_MIN_CONFIDENCE", "0.65")),
            marks_auto_accept_confidence=float(
                os.getenv("MARKS_AUTO_ACCEPT_CONFIDENCE", "0.85")
            ),
        )
