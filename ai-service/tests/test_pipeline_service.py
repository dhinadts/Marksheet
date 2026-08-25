import hashlib
from uuid import UUID

import cv2
import numpy as np
import pytest

from app.core.config import Settings
from app.core.errors import CapabilityUnavailableError
from app.schemas.common import (
    ConfidenceThresholds,
    NormalizedBox,
    ObjectReference,
    ProcessingContext,
    RecognitionRequest,
    TemplateCell,
    TemplateDefinition,
)
from app.schemas.results import ExtractionStatus
from app.services.openai_vision import PageMarkResult
from app.services.pipeline import PipelineService
from app.services.preprocessing import ImageArray, ImagePreprocessor


class MemoryStore:
    def __init__(self, source: bytes) -> None:
        self.source = source
        self.outputs: dict[str, bytes] = {}

    def get(self, reference: ObjectReference) -> bytes:
        return self.source

    def put(self, object_key: str, data: bytes, mime_type: str) -> ObjectReference:
        self.outputs[object_key] = data
        return ObjectReference(
            bucket="private-marks",
            object_key=object_key,
            mime_type=mime_type,
            size_bytes=len(data),
            checksum_sha256=hashlib.sha256(data).hexdigest(),
        )


class FixedRecognizer:
    last_image: ImageArray | None = None

    def recognize(self, image: ImageArray) -> tuple[str | None, float]:
        self.last_image = image
        return "8", 0.99


def test_pipeline_preserves_individual_invalid_mark_for_human_review() -> None:
    image = np.full((1200, 900, 3), 190, dtype=np.uint8)
    cv2.rectangle(image, (20, 20), (880, 1180), (20, 20, 20), 8)
    success, encoded = cv2.imencode(".jpg", image)
    assert success
    source = encoded.tobytes()
    store = MemoryStore(source)
    tenant_id = UUID("11111111-1111-4111-8111-111111111111")
    request = RecognitionRequest(
        context=ProcessingContext(
            tenant_id=tenant_id,
            mark_sheet_id=UUID("22222222-2222-4222-8222-222222222222"),
            image_id=UUID("33333333-3333-4333-8333-333333333333"),
            question_paper_version_id=UUID("44444444-4444-4444-8444-444444444444"),
            marking_scheme_version_id=UUID("55555555-5555-4555-8555-555555555555"),
        ),
        source=ObjectReference(
            bucket="private-marks",
            object_key=f"{tenant_id}/mark-sheets/source.jpg",
            mime_type="image/jpeg",
            size_bytes=len(source),
            checksum_sha256=hashlib.sha256(source).hexdigest(),
        ),
        template=TemplateDefinition(
            template_id=UUID("66666666-6666-4666-8666-666666666666"),
            version=1,
            expected_aspect_ratio=0.75,
            aspect_ratio_tolerance=0.3,
            cells=[
                TemplateCell(
                    marking_scheme_item_id=UUID("77777777-7777-4777-8777-777777777777"),
                    question_id=UUID("88888888-8888-4888-8888-888888888888"),
                    label="Q1",
                    maximum_mark=2,
                    box=NormalizedBox(x=0.1, y=0.1, width=0.2, height=0.1),
                )
            ],
        ),
        confidence_thresholds=ConfidenceThresholds(
            auto_accept=0.95,
            review_recommended=0.8,
            review_required=0.6,
        ),
        model_version_id=UUID("99999999-9999-4999-8999-999999999999"),
    )
    recognizer = FixedRecognizer()
    service = PipelineService(
        Settings(max_image_bytes=10_000_000),
        store,
        preprocessor=ImagePreprocessor(),
        recognizer=recognizer,
    )

    result = service.extract_marks(request)

    assert result.requires_human_review
    assert len(result.marks) == 1
    assert result.marks[0].value == 8
    assert result.marks[0].maximum_mark == 2
    assert result.marks[0].status == ExtractionStatus.INVALID_EXTRACTION
    assert recognizer.last_image is not None
    assert recognizer.last_image.ndim == 3


class FakePageRecognizer:
    def __init__(self, results: list[PageMarkResult]) -> None:
        self._results = results
        self.received_cells: list[TemplateCell] | None = None

    def recognize_page(
        self, page_png: bytes, cells: list[TemplateCell]
    ) -> list[PageMarkResult]:
        self.received_cells = cells
        return self._results


def _build_request_and_source(
    *, thresholds: ConfidenceThresholds | None = None
) -> tuple[RecognitionRequest, bytes]:
    image = np.full((1200, 900, 3), 190, dtype=np.uint8)
    cv2.rectangle(image, (20, 20), (880, 1180), (20, 20, 20), 8)
    success, encoded = cv2.imencode(".jpg", image)
    assert success
    source = encoded.tobytes()
    tenant_id = UUID("11111111-1111-4111-8111-111111111111")
    request = RecognitionRequest(
        context=ProcessingContext(
            tenant_id=tenant_id,
            mark_sheet_id=UUID("22222222-2222-4222-8222-222222222222"),
            image_id=UUID("33333333-3333-4333-8333-333333333333"),
            question_paper_version_id=UUID("44444444-4444-4444-8444-444444444444"),
            marking_scheme_version_id=UUID("55555555-5555-4555-8555-555555555555"),
        ),
        source=ObjectReference(
            bucket="private-marks",
            object_key=f"{tenant_id}/mark-sheets/source.jpg",
            mime_type="image/jpeg",
            size_bytes=len(source),
            checksum_sha256=hashlib.sha256(source).hexdigest(),
        ),
        template=TemplateDefinition(
            template_id=UUID("66666666-6666-4666-8666-666666666666"),
            version=1,
            expected_aspect_ratio=0.75,
            aspect_ratio_tolerance=0.3,
            cells=[
                TemplateCell(
                    marking_scheme_item_id=UUID("77777777-7777-4777-8777-777777777777"),
                    question_id=UUID("88888888-8888-4888-8888-888888888888"),
                    label="Q1",
                    maximum_mark=5,
                    box=NormalizedBox(x=0.1, y=0.1, width=0.2, height=0.1),
                )
            ],
        ),
        confidence_thresholds=thresholds
        or ConfidenceThresholds(auto_accept=0.95, review_recommended=0.8, review_required=0.6),
        model_version_id=UUID("99999999-9999-4999-8999-999999999999"),
    )
    return request, source


def test_extract_marks_maps_openai_results_to_marking_scheme_items() -> None:
    request, source = _build_request_and_source()
    page_recognizer = FakePageRecognizer(
        [PageMarkResult(label="Q1", raw_text="4.0", value=4.0)]
    )
    service = PipelineService(
        Settings(max_image_bytes=10_000_000, recognizer_backend="openai_vision"),
        MemoryStore(source),
        preprocessor=ImagePreprocessor(),
        page_recognizer=page_recognizer,
    )

    result = service.extract_marks(request)

    assert len(result.marks) == 1
    mark = result.marks[0]
    assert mark.marking_scheme_item_id == UUID("77777777-7777-4777-8777-777777777777")
    assert mark.value == 4.0
    assert mark.confidence < 0.95
    assert mark.status != ExtractionStatus.AUTO_ACCEPT
    assert page_recognizer.received_cells is not None
    assert page_recognizer.received_cells[0].label == "Q1"


def test_extract_marks_openai_backend_requires_manual_entry_for_unmatched_label() -> None:
    request, source = _build_request_and_source()
    page_recognizer = FakePageRecognizer([])
    service = PipelineService(
        Settings(max_image_bytes=10_000_000, recognizer_backend="openai_vision"),
        MemoryStore(source),
        preprocessor=ImagePreprocessor(),
        page_recognizer=page_recognizer,
    )

    result = service.extract_marks(request)

    assert result.marks[0].status == ExtractionStatus.MANUAL_ENTRY_REQUIRED
    assert result.marks[0].value is None


def test_extract_marks_raises_capability_unavailable_for_local_vision_language_backend() -> None:
    # This backend must fail before any storage access, so an empty/unused
    # store is fine here.
    request, _source = _build_request_and_source()
    service = PipelineService(
        Settings(max_image_bytes=10_000_000, recognizer_backend="vision_language_local"),
        MemoryStore(b"unused"),
        preprocessor=ImagePreprocessor(),
    )

    with pytest.raises(CapabilityUnavailableError) as raised:
        service.extract_marks(request)

    assert raised.value.status_code == 501
    assert raised.value.code == "CAPABILITY_NOT_IMPLEMENTED"
