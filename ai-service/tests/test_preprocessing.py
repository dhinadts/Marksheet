import cv2
import numpy as np

from app.services.preprocessing import ImagePreprocessor, QualityPolicy


def document_image() -> np.ndarray:
    image = np.full((1200, 900, 3), 190, dtype=np.uint8)
    cv2.rectangle(image, (20, 20), (880, 1180), (20, 20, 20), 8)
    for row in range(100, 1100, 100):
        cv2.line(image, (80, row), (820, row), (50, 50, 50), 3)
    return image


def test_quality_metrics_are_derived_from_pixels() -> None:
    service = ImagePreprocessor(
        QualityPolicy(
            minimum_width=800,
            minimum_height=1000,
            minimum_blur_variance=10,
            minimum_brightness=30,
            maximum_brightness=240,
            maximum_glare_ratio=0.2,
            minimum_document_area_ratio=0.5,
        )
    )

    result = service.quality(document_image())

    assert result.acceptable
    assert result.metrics.width == 900
    assert result.metrics.height == 1200
    assert result.metrics.document_area_ratio > 0.8


def test_dark_blurred_low_resolution_image_requires_retake() -> None:
    image = np.full((200, 200, 3), 10, dtype=np.uint8)

    result = ImagePreprocessor().quality(image)

    assert not result.acceptable
    assert {"LOW_RESOLUTION", "BLURRY", "TOO_DARK"}.issubset(result.reasons)


def test_preprocess_preserves_colour_for_form_line_filtering() -> None:
    image = document_image()
    cv2.line(image, (100, 300), (800, 300), (220, 140, 40), 5)
    cv2.line(image, (100, 400), (800, 400), (40, 40, 220), 5)

    result = ImagePreprocessor().preprocess(image)

    assert result.image.ndim == 3
    assert result.image.shape[2] == 3
    assert result.image.dtype == np.uint8
    assert result.image.size > 0
    assert np.any(result.image[:, :, 0] != result.image[:, :, 2])
