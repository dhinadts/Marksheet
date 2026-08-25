from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.core.errors import CapabilityUnavailableError
from app.schemas.common import (
    ConfidenceThresholds,
    RecognitionRequest,
    StageRequest,
    TemplateCell,
    TemplateStageRequest,
)
from app.schemas.results import (
    CellDetectionResponse,
    DetectedCell,
    ExtractedMarkResult,
    ExtractionQuality,
    ExtractionResponse,
    PreprocessResponse,
    QualityResponse,
    TemplateMatchResponse,
)
from app.services.arithmetic import validate_arithmetic
from app.services.openai_vision import OpenAiPageRecognizer, PageMarkResult, PageRecognition
from app.services.preprocessing import ImageArray, ImagePreprocessor, PreprocessedImage
from app.services.recognition import OnnxMarkRecognizer, Recognition, parse_mark
from app.services.storage import ObjectStore
from app.services.table_detection import MarksTableDetector
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
        table_detector: MarksTableDetector | None = None,
        page_recognizer: PageRecognition | None = None,
    ) -> None:
        self._settings = settings
        self._storage = storage
        self._preprocessor = preprocessor or ImagePreprocessor()
        self._templates = template_detector or TemplateDetector()
        self._recognizer = recognizer
        self._table_detector = table_detector or MarksTableDetector()
        self._page_recognizer = page_recognizer

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
        table = self._table_detector.detect(prepared.processed.image)
        crops = self._templates.extract_cells(prepared.processed.image, request.template, table)
        return CellDetectionResponse(
            template_match=match, cells=self._store_crops(crops, prepared.object_key_prefix)
        )

    def extract_marks(self, request: RecognitionRequest) -> ExtractionResponse:
        if self._settings.recognizer_backend == "vision_language_local":
            # Extension point for a future local vision-language model (e.g. a
            # Qwen2-VL-class model) that would read the whole preprocessed page
            # once GPU capacity is available after the EC2 upgrade. Fails loudly
            # rather than silently falling back to a different backend, and
            # before any storage writes so an unimplemented backend has no
            # side effects.
            raise CapabilityUnavailableError("vision_language_local_recognition", target_phase=14)

        prepared = self._prepare(request)
        # Keep one deterministic converted page beside the captured original.
        # The checksum makes this an immutable processing version and retries
        # overwrite only the same version key.
        page_png = self._preprocessor.encode_png(prepared.processed.image)
        self._storage.put(f"{prepared.object_key_prefix}/converted.png", page_png, "image/png")
        match = self._templates.match(prepared.processed.image, request.template)
        table = self._table_detector.detect(prepared.processed.image)

        marks: list[ExtractedMarkResult]
        if self._settings.recognizer_backend == "openai_vision":
            page_recognizer = self._page_recognizer or OpenAiPageRecognizer(self._settings)
            page_results = page_recognizer.recognize_page(page_png, request.template.cells)
            marks = self._map_page_results(
                page_results, request.template.cells, request.confidence_thresholds
            )
        else:
            crops = self._templates.extract_cells(prepared.processed.image, request.template, table)
            recognizer = self._recognizer or OnnxMarkRecognizer(self._settings)
            marks = []
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
        validation = validate_arithmetic(marks)
        return ExtractionResponse(
            model_version_id=request.model_version_id,
            template_match=match,
            marks=marks,
            quality=ExtractionQuality(
                status="accepted" if table.detected else "warning",
                width=prepared.processed.image.shape[1],
                height=prepared.processed.image.shape[0],
                table_detected=table.detected,
                table_confidence=round(table.confidence, 6),
                warnings=[]
                if table.detected
                else ["Marks table grid was not detected reliably; template cells require review"],
            ),
            validation=validation,
            requires_human_review=not all(
                mark.status == "AUTO_ACCEPT" for mark in marks
            ) or not validation.complete,
        )

    def _map_page_results(
        self,
        page_results: list[PageMarkResult],
        cells: list[TemplateCell],
        thresholds: ConfidenceThresholds,
    ) -> list[ExtractedMarkResult]:
        # OpenAI has no calibrated confidence score the way the ONNX classifier's
        # softmax does. Rather than trust a self-reported number, every mark from
        # this backend is capped just below the auto-accept threshold, so it can
        # at best reach REVIEW_RECOMMENDED -- a human always reviews cloud-sourced
        # marks before they count toward a grade.
        capped_confidence = max(0.0, thresholds.auto_accept - 1e-6)
        results_by_label = {result.label: result for result in page_results}
        marks: list[ExtractedMarkResult] = []
        for cell in cells:
            result = results_by_label.get(cell.label)
            value = result.value if result is not None else None
            confidence = capped_confidence if value is not None else 0.0
            status, reason = classify_extraction(value, cell.maximum_mark, confidence, thresholds)
            marks.append(
                ExtractedMarkResult(
                    marking_scheme_item_id=cell.marking_scheme_item_id,
                    question_id=cell.question_id,
                    question_part_id=cell.question_part_id,
                    label=cell.label,
                    raw_text=result.raw_text if result is not None else None,
                    value=value,
                    maximum_mark=cell.maximum_mark,
                    confidence=round(confidence, 6),
                    status=status,
                    reason=reason,
                    bounding_box=cell.box,
                )
            )
        return marks

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
