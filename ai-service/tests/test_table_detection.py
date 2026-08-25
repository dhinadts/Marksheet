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


def shifted_ruled_table(
    dx: int, dy: int, width: int = 900, height: int = 1200
) -> np.ndarray:
    image = np.full((height, width, 3), 245, dtype=np.uint8)
    left, right = width // 10 + dx, width * 9 // 10 + dx
    top, bottom = height // 3 + dy, height * 4 // 5 + dy
    for x in np.linspace(left, right, 8, dtype=int):
        cv2.line(image, (x, top), (x, bottom), (50, 80, 100), 3)
    for y in np.linspace(top, bottom, 14, dtype=int):
        cv2.line(image, (left, y), (right, y), (50, 80, 100), 3)
    return image


def test_grid_boundary_positions_match_reported_line_counts() -> None:
    result = MarksTableDetector().detect(ruled_table())

    assert len(result.row_boundaries) == result.horizontal_lines
    assert len(result.column_boundaries) == result.vertical_lines
    assert list(result.row_boundaries) == sorted(result.row_boundaries)
    assert list(result.column_boundaries) == sorted(result.column_boundaries)
    assert all(result.y <= value <= result.y + result.height for value in result.row_boundaries)
    assert all(
        result.x <= value <= result.x + result.width for value in result.column_boundaries
    )


def test_boundary_positions_shift_with_a_relocated_grid() -> None:
    detector = MarksTableDetector()
    baseline = detector.detect(ruled_table())
    dx, dy = 40, 25

    shifted = detector.detect(shifted_ruled_table(dx, dy))

    assert shifted.detected
    assert len(shifted.row_boundaries) == len(baseline.row_boundaries)
    assert len(shifted.column_boundaries) == len(baseline.column_boundaries)
    for base_value, shifted_value in zip(baseline.row_boundaries, shifted.row_boundaries):
        assert shifted_value - base_value == dy
    for base_value, shifted_value in zip(baseline.column_boundaries, shifted.column_boundaries):
        assert shifted_value - base_value == dx
