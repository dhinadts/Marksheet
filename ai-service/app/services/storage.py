from __future__ import annotations

import hashlib
from typing import Protocol, cast

import boto3  # type: ignore[import-untyped]
from botocore.client import Config  # type: ignore[import-untyped]

from app.core.config import Settings
from app.core.errors import ServiceError
from app.schemas.common import ObjectReference


class ObjectStore(Protocol):
    def get(self, reference: ObjectReference) -> bytes: ...

    def put(self, object_key: str, data: bytes, mime_type: str) -> ObjectReference: ...


class S3ObjectStore:
    def __init__(self, settings: Settings) -> None:
        if not settings.storage_bucket:
            raise ServiceError(503, "STORAGE_NOT_CONFIGURED", "AI object storage is not configured")
        self._bucket = settings.storage_bucket
        self._max_bytes = settings.max_image_bytes
        self._client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            endpoint_url=settings.storage_endpoint,
            config=Config(
                s3={"addressing_style": "path" if settings.storage_force_path_style else "virtual"}
            ),
        )

    def get(self, reference: ObjectReference) -> bytes:
        if reference.bucket != self._bucket:
            raise ServiceError(
                403, "STORAGE_SCOPE_VIOLATION", "Object bucket is outside service scope"
            )
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=reference.object_key)
            body = cast(bytes, response["Body"].read(self._max_bytes + 1))
        except ServiceError:
            raise
        except Exception as error:
            raise ServiceError(
                502, "STORAGE_READ_FAILED", "Unable to read the source image"
            ) from error
        if len(body) > self._max_bytes or len(body) != reference.size_bytes:
            raise ServiceError(
                422, "OBJECT_SIZE_MISMATCH", "Stored image size does not match metadata"
            )
        if hashlib.sha256(body).hexdigest() != reference.checksum_sha256.lower():
            raise ServiceError(
                422, "OBJECT_CHECKSUM_MISMATCH", "Stored image checksum does not match metadata"
            )
        return body

    def put(self, object_key: str, data: bytes, mime_type: str) -> ObjectReference:
        checksum = hashlib.sha256(data).hexdigest()
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=object_key,
                Body=data,
                ContentType=mime_type,
                Metadata={"sha256": checksum},
                ServerSideEncryption="AES256",
            )
        except Exception as error:
            raise ServiceError(
                502, "STORAGE_WRITE_FAILED", "Unable to store the derived image"
            ) from error
        return ObjectReference(
            bucket=self._bucket,
            object_key=object_key,
            mime_type=mime_type,
            size_bytes=len(data),
            checksum_sha256=checksum,
        )
