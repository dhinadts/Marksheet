import cv2
import numpy as np

from app.services.table_detection import MarksTableDetector


def ruled_table(width: int = 900, height: int = 1200) -> np.ndarray:
    image = np.full((height, width, 3), 245, dtype=np.uint8)
    left, right, top, bottom = width // 10, width * 9 // 10, height // 3, height * 4 // 5
    for x in np.linspace(left, right, 8, dtype=int):
        cv2.line(image, (x, top), (x, bottom), (50, 80, 100), 3)
    for y in np.linspace(top, bottom, 14, dtype=int):
        cv2.line(image, (left, y), (right, y), (50, 80, 100), 3)
    return image


def test_detects_marks_table_at_different_resolutions() -> None:
    detector = MarksTableDetector()

    large = detector.detect(ruled_table())
    small = detector.detect(cv2.resize(ruled_table(), (450, 600)))

    assert large.detected and small.detected
    assert large.horizontal_lines >= 10
    assert large.vertical_lines >= 6


def test_missing_table_is_reported_without_inventing_a_region() -> None:
    blank = np.full((800, 600, 3), 240, dtype=np.uint8)

    result = MarksTableDetector().detect(blank)

    assert not result.detected
    assert result.confidence == 0
