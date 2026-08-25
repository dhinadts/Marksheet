from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.schemas.common import RecognitionRequest, StageRequest, TemplateStageRequest
from app.schemas.results import (
    CellDetectionResponse,
    DetectedCell,
    ExtractedMarkResult,
    ExtractionResponse,
    PreprocessResponse,
    QualityResponse,
    TemplateMatchResponse,
)
from app.services.preprocessing import ImageArray, ImagePreprocessor, PreprocessedImage
from app.services.recognition import OnnxMarkRecognizer, Recognition, parse_mark
from app.services.storage import ObjectStore
from app.services.templates import CellCrop, TemplateDetector
from app.services.validation import classify_extraction


@dataclass(slots=True)
class PreparedDocument:
    processed: PreprocessedImage
    object_key_prefix: str


class PipelineService:
    def __init__(
        self,
        settings: Settings,
        storage: ObjectStore,
        preprocessor: ImagePreprocessor | None = None,
        template_detector: TemplateDetector | None = None,
        recognizer: Recognition | None = None,
    ) -> None:
        self._settings = settings
        self._storage = storage
        self._preprocessor = preprocessor or ImagePreprocessor()
        self._templates = template_detector or TemplateDetector()
        self._recognizer = recognizer

    def quality_check(self, request: StageRequest) -> QualityResponse:
        return self._preprocessor.quality(self._load(request))

    def preprocess(self, request: StageRequest) -> PreprocessResponse:
        prepared = self._prepare(request)
        data = self._preprocessor.encode_png(prepared.processed.image)
        reference = self._storage.put(
            f"{prepared.object_key_prefix}/preprocessed.png", data, "image/png"
        )
        height, width = prepared.processed.image.shape[:2]
        return PreprocessResponse(
            processed=reference,
            width=width,
            height=height,
            deskew_angle=prepared.processed.deskew_angle,
            perspective_corrected=prepared.processed.perspective_corrected,
        )

    def detect_template(self, request: TemplateStageRequest) -> TemplateMatchResponse:
        prepared = self._prepare(request)
        return self._templates.match(prepared.processed.image, request.template)

    def detect_cells(self, request: TemplateStageRequest) -> CellDetectionResponse:
        prepared = self._prepare(request)
        match = self._templates.match(prepared.processed.image, request.template)
        crops = self._templates.extract_cells(prepared.processed.image, request.template)
        return CellDetectionResponse(
            template_match=match, cells=self._store_crops(crops, prepared.object_key_prefix)
        )

    def extract_marks(self, request: RecognitionRequest) -> ExtractionResponse:
        prepared = self._prepare(request)
        # Keep one deterministic converted page beside the captured original.
        # The checksum makes this an immutable processing version and retries
        # overwrite only the same version key.
        self._storage.put(
            f"{prepared.object_key_prefix}/converted.png",
            self._preprocessor.encode_png(prepared.processed.image),
            "image/png",
        )
        match = self._templates.match(prepared.processed.image, request.template)
        crops = self._templates.extract_cells(prepared.processed.image, request.template)
        recognizer = self._recognizer or OnnxMarkRecognizer(self._settings)
        marks: list[ExtractedMarkResult] = []
        for crop in crops:
            raw_text, confidence = recognizer.recognize(crop.image)
            value = parse_mark(raw_text)
            status, reason = classify_extraction(
                value,
                crop.definition.maximum_mark,
                confidence,
                request.confidence_thresholds,
            )
            marks.append(
                ExtractedMarkResult(
                    marking_scheme_item_id=crop.definition.marking_scheme_item_id,
                    question_id=crop.definition.question_id,
                    question_part_id=crop.definition.question_part_id,
                    label=crop.definition.label,
                    raw_text=raw_text,
                    value=value,
                    maximum_mark=crop.definition.maximum_mark,
                    confidence=round(confidence, 6),
                    status=status,
                    reason=reason,
                    bounding_box=crop.definition.bounding_box,
                )
            )
        return ExtractionResponse(
            model_version_id=request.model_version_id,
            template_match=match,
            marks=marks,
            requires_human_review=True,
        )

    def _load(self, request: StageRequest) -> ImageArray:
        if request.source.size_bytes > self._settings.max_image_bytes:
            from app.core.errors import ServiceError

            raise ServiceError(
                413, "IMAGE_TOO_LARGE", "Source image exceeds the configured byte limit"
            )
        return self._preprocessor.decode(self._storage.get(request.source))

    def _prepare(self, request: StageRequest) -> PreparedDocument:
        processed = self._preprocessor.preprocess(self._load(request))
        captured_marker = "/captured/"
        if captured_marker in request.source.object_key:
            sheet_prefix = request.source.object_key.split(captured_marker, 1)[0]
            prefix = (
                f"{sheet_prefix}/converted/versions/"
                f"{request.source.checksum_sha256}"
            )
        else:
            # Backward compatibility for captures stored before hierarchical
            # object keys were introduced.
            prefix = f"{request.context.tenant_id}/mark-sheets/{request.context.mark_sheet_id}/derived/{request.source.checksum_sha256}"
        return PreparedDocument(processed, prefix)

    def _store_crops(self, crops: list[CellCrop], prefix: str) -> list[DetectedCell]:
        stored: list[DetectedCell] = []
        for crop in crops:
            data = self._preprocessor.encode_png(crop.image)
            reference = self._storage.put(
                f"{prefix}/cells/{crop.definition.marking_scheme_item_id}.png",
                data,
                "image/png",
            )
            stored.append(crop.definition.model_copy(update={"crop": reference}))
        return stored
