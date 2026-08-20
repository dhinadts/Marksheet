from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Protocol, cast

import cv2
import numpy as np
import onnxruntime as ort  # type: ignore[import-untyped]
from numpy.typing import NDArray

from app.core.config import Settings
from app.core.errors import ServiceError
from app.services.preprocessing import ImageArray


class Recognition(Protocol):
    def recognize(self, image: ImageArray) -> tuple[str | None, float]: ...


class OnnxMarkRecognizer:
    """Adapter for a reviewed classification model; it does not imply model accuracy."""

    def __init__(self, settings: Settings) -> None:
        if not settings.model_path or not settings.model_checksum_sha256:
            raise ServiceError(503, "MODEL_NOT_CONFIGURED", "A checksummed ONNX model is required")
        path = Path(settings.model_path).resolve()
        if not path.is_file():
            raise ServiceError(
                503, "MODEL_NOT_FOUND", "Configured ONNX model artifact was not found"
            )
        if hashlib.sha256(path.read_bytes()).hexdigest() != settings.model_checksum_sha256:
            raise ServiceError(
                503, "MODEL_CHECKSUM_MISMATCH", "Configured model checksum verification failed"
            )
        try:
            self._session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        except Exception as error:
            raise ServiceError(
                503, "MODEL_LOAD_FAILED", "Configured ONNX model could not be loaded"
            ) from error
        inputs = self._session.get_inputs()
        if len(inputs) != 1:
            raise ServiceError(
                503, "MODEL_CONTRACT_INVALID", "Recognition model must have exactly one input"
            )
        self._input_name = inputs[0].name
        self._labels = settings.model_labels

    def recognize(self, image: ImageArray) -> tuple[str | None, float]:
        tensor = self._prepare(image)
        try:
            output = cast(
                list[NDArray[np.float32]], self._session.run(None, {self._input_name: tensor})
            )
        except Exception as error:
            raise ServiceError(
                502, "MODEL_INFERENCE_FAILED", "Recognition model inference failed"
            ) from error
        if not output or output[0].size != len(self._labels):
            raise ServiceError(
                502,
                "MODEL_OUTPUT_INVALID",
                "Recognition model output does not match configured labels",
            )
        logits = output[0].reshape(-1).astype(np.float64)
        probabilities = np.exp(logits - np.max(logits))
        probabilities /= probabilities.sum()
        index = int(np.argmax(probabilities))
        return self._labels[index], float(probabilities[index])

    def _prepare(self, image: ImageArray) -> NDArray[np.float32]:
        gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, (28, 28), interpolation=cv2.INTER_AREA)
        normalized = resized.astype(np.float32) / 255.0
        return normalized.reshape(1, 1, 28, 28)


def parse_mark(raw_text: str | None) -> float | None:
    if raw_text is None:
        return None
    try:
        return float(raw_text)
    except ValueError:
        return None
