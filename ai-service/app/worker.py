from __future__ import annotations

import logging
import os
import socket
from typing import cast

from redis.exceptions import ResponseError

from app.core.config import Settings
from app.core.errors import ServiceError
from app.core.logging import configure_logging
from app.schemas.common import JobStatus, ProcessMarkSheetRequest
from app.services.jobs import RedisJobQueue
from app.services.pipeline import PipelineService
from app.services.storage import S3ObjectStore

logger = logging.getLogger(__name__)
GROUP = "ai-marks-workers"


def run() -> None:
    settings = Settings.from_environment()
    configure_logging(settings.log_level)
    queue = RedisJobQueue(settings.redis_url)
    pipeline = PipelineService(settings, S3ObjectStore(settings))
    consumer = f"{socket.gethostname()}-{os.getpid()}"
    try:
        queue.client.xgroup_create(queue.stream_name, GROUP, id="0", mkstream=True)
    except ResponseError as error:
        if "BUSYGROUP" not in str(error):
            raise
    logger.info("AI worker started as %s", consumer)
    while True:
        claimed = cast(
            tuple[str, list[tuple[str, dict[str, str]]], list[str]],
            queue.client.xautoclaim(
                queue.stream_name,
                GROUP,
                consumer,
                min_idle_time=60_000,
                start_id="0-0",
                count=1,
            ),
        )
        messages = (
            [(queue.stream_name, claimed[1])]
            if claimed[1]
            else cast(
                list[tuple[str, list[tuple[str, dict[str, str]]]]],
                queue.client.xreadgroup(
                    GROUP, consumer, {queue.stream_name: ">"}, count=1, block=5000
                ),
            )
        )
        if not messages:
            continue
        for _, entries in messages:
            for message_id, fields in entries:
                _process(queue, pipeline, message_id, cast(dict[str, str], fields))


def _process(
    queue: RedisJobQueue, pipeline: PipelineService, message_id: str, fields: dict[str, str]
) -> None:
    job_key = fields["job_key"]
    try:
        request = ProcessMarkSheetRequest.model_validate_json(fields["payload"])
        queue.client.hset(job_key, mapping={"status": JobStatus.PROCESSING.value})
        result = pipeline.extract_marks(request)
        queue.client.hset(
            job_key,
            mapping={"status": JobStatus.COMPLETED.value, "result": result.model_dump_json()},
        )
    except ServiceError as error:
        queue.client.hset(
            job_key,
            mapping={
                "status": JobStatus.FAILED.value,
                "error_code": error.code,
                "error_message": error.message,
            },
        )
    except Exception:
        logger.exception("Unhandled AI job failure")
        queue.client.hset(
            job_key,
            mapping={
                "status": JobStatus.FAILED.value,
                "error_code": "UNEXPECTED_PROCESSING_ERROR",
                "error_message": "AI processing failed unexpectedly",
            },
        )
    finally:
        queue.client.xack(queue.stream_name, GROUP, message_id)


if __name__ == "__main__":
    run()
