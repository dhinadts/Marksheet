from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import cast

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image
from pillow_heif import register_heif_opener  # type: ignore[import-untyped]

from app.core.errors import ServiceError
from app.schemas.results import QualityMetrics, QualityResponse

ImageArray = NDArray[np.uint8]
register_heif_opener()


@dataclass(frozen=True, slots=True)
class QualityPolicy:
    minimum_width: int = 1000
    minimum_height: int = 1000
    minimum_blur_variance: float = 80.0
    minimum_brightness: float = 45.0
    maximum_brightness: float = 240.0
    maximum_glare_ratio: float = 0.08
    minimum_document_area_ratio: float = 0.2


@dataclass(slots=True)
class PreprocessedImage:
    image: ImageArray
    deskew_angle: float
    perspective_corrected: bool


class ImagePreprocessor:
    def __init__(self, policy: QualityPolicy | None = None) -> None:
        self.policy = policy or QualityPolicy()

    def decode(self, data: bytes) -> ImageArray:
        decoded = cast(
            ImageArray | None,
            cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR),
        )
        if decoded is None:
            try:
                with Image.open(BytesIO(data)) as image:
                    decoded = cast(
                        ImageArray,
                        cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2BGR),
                    )
            except Exception as error:
                raise ServiceError(
                    422, "IMAGE_DECODE_FAILED", "Image bytes could not be decoded"
                ) from error
        return decoded

    def quality(self, image: ImageArray) -> QualityResponse:
        gray = cast(ImageArray, cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
        height, width = gray.shape
        brightness = float(np.mean(gray))
        blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        glare = float(np.count_nonzero(gray >= 250) / gray.size)
        contour = self._document_contour(gray)
        area_ratio = float(cv2.contourArea(contour) / gray.size) if contour is not None else 0.0
        reasons: list[str] = []
        if width < self.policy.minimum_width or height < self.policy.minimum_height:
            reasons.append("LOW_RESOLUTION")
        if blur < self.policy.minimum_blur_variance:
            reasons.append("BLURRY")
        if brightness < self.policy.minimum_brightness:
            reasons.append("TOO_DARK")
        if brightness > self.policy.maximum_brightness:
            reasons.append("TOO_BRIGHT")
        if glare > self.policy.maximum_glare_ratio:
            reasons.append("GLARE_DETECTED")
        if area_ratio < self.policy.minimum_document_area_ratio:
            reasons.append("PAPER_NOT_FULLY_VISIBLE")
        return QualityResponse(
            acceptable=not reasons,
            reasons=reasons,
            metrics=QualityMetrics(
                width=width,
                height=height,
                brightness=round(brightness, 4),
                blur_variance=round(blur, 4),
                glare_ratio=round(glare, 6),
                document_area_ratio=round(area_ratio, 6),
            ),
        )

    def preprocess(self, image: ImageArray) -> PreprocessedImage:
        gray = cast(ImageArray, cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
        contour = self._document_contour(gray)
        corrected = False
        working: ImageArray = image
        if contour is not None:
            perimeter = cv2.arcLength(contour, True)
            polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
            if len(polygon) == 4:
                working = self._four_point_transform(
                    image, polygon.reshape(4, 2).astype(np.float32)
                )
                corrected = True
        angle = self._deskew_angle(cast(ImageArray, cv2.cvtColor(working, cv2.COLOR_BGR2GRAY)))
        if abs(angle) >= 0.1:
            height, width = working.shape[:2]
            matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
            working = cast(
                ImageArray,
                cv2.warpAffine(working, matrix, (width, height), borderMode=cv2.BORDER_REPLICATE),
            )
        gray = cast(ImageArray, cv2.cvtColor(working, cv2.COLOR_BGR2GRAY))
        enhanced = cast(
            ImageArray,
            cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray),
        )
        return PreprocessedImage(enhanced, round(angle, 4), corrected)

    def encode_png(self, image: ImageArray) -> bytes:
        success, encoded = cv2.imencode(".png", image, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        if not success:
            raise ServiceError(500, "IMAGE_ENCODE_FAILED", "Processed image could not be encoded")
        return encoded.tobytes()

    def _document_contour(self, gray: ImageArray) -> ImageArray | None:
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return cast(ImageArray, max(contours, key=cv2.contourArea)) if contours else None

    def _deskew_angle(self, gray: ImageArray) -> float:
        coordinates = np.column_stack(
            np.where(cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1] > 0)
        )
        if len(coordinates) < 10:
            return 0.0
        angle = float(cv2.minAreaRect(coordinates.astype(np.float32))[-1])
        return -(90 + angle) if angle < -45 else -angle

    def _four_point_transform(self, image: ImageArray, points: NDArray[np.float32]) -> ImageArray:
        ordered = np.zeros((4, 2), dtype=np.float32)
        sums = points.sum(axis=1)
        differences = np.diff(points, axis=1).reshape(-1)
        ordered[0], ordered[2] = points[np.argmin(sums)], points[np.argmax(sums)]
        ordered[1], ordered[3] = points[np.argmin(differences)], points[np.argmax(differences)]
        top_left, top_right, bottom_right, bottom_left = ordered
        width = int(
            max(np.linalg.norm(bottom_right - bottom_left), np.linalg.norm(top_right - top_left))
        )
        height = int(
            max(np.linalg.norm(top_right - bottom_right), np.linalg.norm(top_left - bottom_left))
        )
        destination = np.array(
            [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32
        )
        return cast(
            ImageArray,
            cv2.warpPerspective(
                image, cv2.getPerspectiveTransform(ordered, destination), (width, height)
            ),
        )
