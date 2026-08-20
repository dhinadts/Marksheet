from uuid import UUID

import fakeredis
import pytest

from app.core.errors import ServiceError
from app.schemas.common import ProcessMarkSheetRequest
from app.services.jobs import RedisJobQueue

TENANT_ID = "11111111-1111-4111-8111-111111111111"


def job_request(
    model_version: str = "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
) -> ProcessMarkSheetRequest:
    return ProcessMarkSheetRequest.model_validate(
        {
            "context": {
                "tenant_id": TENANT_ID,
                "mark_sheet_id": "22222222-2222-4222-8222-222222222222",
                "image_id": "33333333-3333-4333-8333-333333333333",
                "question_paper_version_id": "44444444-4444-4444-8444-444444444444",
                "marking_scheme_version_id": "55555555-5555-4555-8555-555555555555",
            },
            "source": {
                "bucket": "private-marks",
                "object_key": f"{TENANT_ID}/mark-sheets/source.jpg",
                "mime_type": "image/jpeg",
                "size_bytes": 4096,
                "checksum_sha256": "a" * 64,
            },
            "template": {
                "template_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "version": 1,
                "expected_aspect_ratio": 0.75,
                "cells": [
                    {
                        "marking_scheme_item_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                        "question_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                        "label": "Q1",
                        "maximum_mark": 2,
                        "box": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.1},
                    }
                ],
            },
            "confidence_thresholds": {
                "auto_accept": 0.95,
                "review_recommended": 0.8,
                "review_required": 0.6,
            },
            "model_version_id": model_version,
            "job_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        }
    )


def queue() -> RedisJobQueue:
    instance = RedisJobQueue("redis://unused")
    instance.client = fakeredis.FakeRedis(decode_responses=True)
    return instance


def test_enqueue_is_idempotent_for_identical_tenant_job_payload() -> None:
    jobs = queue()
    request = job_request()

    first = jobs.enqueue(request)
    second = jobs.enqueue(request)

    assert first == second
    assert jobs.client.xlen(jobs.stream_name) == 1


def test_job_id_reuse_with_changed_payload_is_rejected() -> None:
    jobs = queue()
    jobs.enqueue(job_request())

    with pytest.raises(ServiceError, match="another payload") as raised:
        jobs.enqueue(job_request("ffffffff-ffff-4fff-8fff-ffffffffffff"))

    assert raised.value.code == "JOB_ID_CONFLICT"


def test_job_lookup_is_tenant_scoped() -> None:
    jobs = queue()
    request = job_request()
    jobs.enqueue(request)

    with pytest.raises(ServiceError) as raised:
        jobs.get(UUID("99999999-9999-4999-8999-999999999999"), request.job_id)

    assert raised.value.code == "JOB_NOT_FOUND"
