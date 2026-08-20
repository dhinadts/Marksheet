from __future__ import annotations

import json
from typing import Protocol, cast
from uuid import UUID

import redis
from redis.exceptions import WatchError

from app.core.errors import ServiceError
from app.schemas.common import JobResponse, JobStatus, ProcessMarkSheetRequest


class JobQueue(Protocol):
    def enqueue(self, request: ProcessMarkSheetRequest) -> JobResponse: ...

    def get(self, tenant_id: UUID, job_id: UUID) -> JobResponse: ...


class RedisJobQueue:
    stream_name = "ai-marks:processing"

    def __init__(self, redis_url: str | None) -> None:
        if not redis_url:
            raise ServiceError(503, "QUEUE_NOT_CONFIGURED", "AI job queue is not configured")
        self.client = redis.Redis.from_url(redis_url, decode_responses=True, socket_timeout=5)

    def enqueue(self, request: ProcessMarkSheetRequest) -> JobResponse:
        key = self._key(request.context.tenant_id, request.job_id)
        payload = request.model_dump_json()
        try:
            while True:
                with self.client.pipeline() as transaction:
                    try:
                        transaction.watch(key)
                        existing = cast(dict[str, str], transaction.hgetall(key))
                        if existing:
                            transaction.unwatch()
                            if existing.get("payload") != payload:
                                raise ServiceError(
                                    409,
                                    "JOB_ID_CONFLICT",
                                    "job_id was already used with another payload",
                                )
                            return self._response(existing)
                        transaction.multi()
                        transaction.hset(
                            key,
                            mapping={
                                "job_id": str(request.job_id),
                                "tenant_id": str(request.context.tenant_id),
                                "status": JobStatus.PENDING.value,
                                "payload": payload,
                            },
                        )
                        transaction.expire(key, 7 * 24 * 60 * 60)
                        transaction.xadd(
                            self.stream_name,
                            {"job_key": key, "payload": payload},
                            maxlen=100_000,
                            approximate=True,
                        )
                        transaction.execute()
                        break
                    except WatchError:
                        continue
        except ServiceError:
            raise
        except redis.RedisError as error:
            raise ServiceError(503, "QUEUE_UNAVAILABLE", "AI job queue is unavailable") from error
        return JobResponse(
            job_id=request.job_id, tenant_id=request.context.tenant_id, status=JobStatus.PENDING
        )

    def get(self, tenant_id: UUID, job_id: UUID) -> JobResponse:
        try:
            values = cast(dict[str, str], self.client.hgetall(self._key(tenant_id, job_id)))
        except redis.RedisError as error:
            raise ServiceError(503, "QUEUE_UNAVAILABLE", "AI job queue is unavailable") from error
        if not values:
            raise ServiceError(404, "JOB_NOT_FOUND", f"AI job {job_id} was not found")
        return self._response(values)

    @staticmethod
    def _key(tenant_id: UUID, job_id: UUID) -> str:
        return f"ai-marks:job:{tenant_id}:{job_id}"

    @staticmethod
    def _response(values: dict[str, str]) -> JobResponse:
        result = json.loads(values["result"]) if values.get("result") else None
        return JobResponse(
            job_id=UUID(values["job_id"]),
            tenant_id=UUID(values["tenant_id"]),
            status=JobStatus(values["status"]),
            result=result,
            error_code=values.get("error_code"),
            error_message=values.get("error_message"),
        )
