from uuid import UUID

import cv2
import numpy as np
import pytest

from app.core.errors import ServiceError
from app.schemas.common import NormalizedBox, TemplateCell, TemplateDefinition
from app.services.table_detection import MarksTableDetector, TableDetection
from app.services.templates import TemplateDetector

TEMPLATE_ID = UUID("11111111-1111-4111-8111-111111111111")


def template(expected_aspect_ratio: float = 0.75) -> TemplateDefinition:
    return TemplateDefinition(
        template_id=TEMPLATE_ID,
        version=2,
        expected_aspect_ratio=expected_aspect_ratio,
        aspect_ratio_tolerance=0.1,
        cells=[
            TemplateCell(
                marking_scheme_item_id=UUID("22222222-2222-4222-8222-222222222222"),
                question_id=UUID("33333333-3333-4333-8333-333333333333"),
                label="Q1",
                maximum_mark=2,
                box=NormalizedBox(x=0.1, y=0.2, width=0.2, height=0.1),
            )
        ],
    )


def test_normalized_template_cells_scale_to_current_image() -> None:
    image = np.zeros((1000, 750), dtype=np.uint8)
    detector = TemplateDetector()

    crops = detector.extract_cells(image, template())

    assert crops[0].image.shape == (100, 150)
    assert crops[0].definition.label == "Q1"


def test_template_mismatch_fails_before_cell_extraction() -> None:
    image = np.zeros((1000, 1000), dtype=np.uint8)

    with pytest.raises(ServiceError, match="selected template") as raised:
        TemplateDetector().extract_cells(image, template())

    assert raised.value.code == "TEMPLATE_MISMATCH"


def test_cell_falls_back_to_percentage_crop_when_table_not_detected() -> None:
    image = np.zeros((1000, 750), dtype=np.uint8)
    detector = TemplateDetector()

    with_table = detector.extract_cells(image, template(), TableDetection(False))
    without_table = detector.extract_cells(image, template())

    assert with_table[0].image.shape == without_table[0].image.shape == (100, 150)


def test_cell_falls_back_when_grid_too_sparse() -> None:
    image = np.zeros((1000, 750), dtype=np.uint8)
    table = TableDetection(
        True, 0, 0, 750, 1000, row_boundaries=(250,), column_boundaries=(100, 300)
    )

    crops = TemplateDetector().extract_cells(image, template(), table)

    assert crops[0].image.shape == (100, 150)


def test_cell_snaps_to_detected_grid_cell_within_tolerance() -> None:
    image = np.fromfunction(lambda i, j: (i + j) % 256, (1000, 750)).astype(np.uint8)
    # Template box (0.1, 0.2, 0.2, 0.1) on this 750x1000 image is raw pixels
    # x:[75,225] y:[200,300] (150x100). These boundaries bracket its center
    # (150, 250) at a nearby but different rectangle, within tolerance.
    table = TableDetection(
        True, 0, 0, 750, 1000, row_boundaries=(190, 270), column_boundaries=(60, 200)
    )

    crops = TemplateDetector().extract_cells(image, template(), table)

    assert crops[0].image.shape == (80, 140)
    assert np.array_equal(crops[0].image, image[190:270, 60:200])


def test_cell_falls_back_when_snapped_cell_disagrees_in_size() -> None:
    image = np.zeros((1000, 750), dtype=np.uint8)
    # Boundaries bracket the cell's center but describe a far larger cell.
    table = TableDetection(
        True, 0, 0, 750, 1000, row_boundaries=(0, 1000), column_boundaries=(0, 750)
    )

    crops = TemplateDetector().extract_cells(image, template(), table)

    assert crops[0].image.shape == (100, 150)


def _ruled_table(dx: int = 0, dy: int = 0, width: int = 900, height: int = 1200) -> np.ndarray:
    image = np.full((height, width, 3), 245, dtype=np.uint8)
    left, right = width // 10 + dx, width * 9 // 10 + dx
    top, bottom = height // 3 + dy, height * 4 // 5 + dy
    for x in np.linspace(left, right, 8, dtype=int):
        cv2.line(image, (x, top), (x, bottom), (50, 80, 100), 3)
    for y in np.linspace(top, bottom, 14, dtype=int):
        cv2.line(image, (left, y), (right, y), (50, 80, 100), 3)
    return image


def test_cell_recovers_alignment_on_shifted_synthetic_grid() -> None:
    width, height = 900, 1200
    reference = MarksTableDetector().detect(_ruled_table())
    assert len(reference.row_boundaries) >= 3
    assert len(reference.column_boundaries) >= 3

    # Author a template cell from one grid cell of a well-aligned reference
    # photo, the way a real template would be authored by hand.
    row_top, row_bottom = reference.row_boundaries[1], reference.row_boundaries[2]
    col_left, col_right = reference.column_boundaries[1], reference.column_boundaries[2]
    authored = TemplateDefinition(
        template_id=TEMPLATE_ID,
        version=1,
        expected_aspect_ratio=width / height,
        aspect_ratio_tolerance=0.1,
        cells=[
            TemplateCell(
                marking_scheme_item_id=UUID("22222222-2222-4222-8222-222222222222"),
                question_id=UUID("33333333-3333-4333-8333-333333333333"),
                label="Q1",
                maximum_mark=2,
                box=NormalizedBox(
                    x=col_left / width,
                    y=row_top / height,
                    width=(col_right - col_left) / width,
                    height=(row_bottom - row_top) / height,
                ),
            )
        ],
    )

    # The photographed page is shifted from where the template was authored --
    # more than deskew alone would correct.
    dx, dy = 35, 20
    shifted_image = _ruled_table(dx, dy)
    shifted_table = MarksTableDetector().detect(shifted_image)
    assert shifted_table.detected

    detector = TemplateDetector()
    naive = detector.extract_cells(shifted_image, authored)[0]
    snapped = detector.extract_cells(shifted_image, authored, shifted_table)[0]

    expected_crop = shifted_image[
        shifted_table.row_boundaries[1] : shifted_table.row_boundaries[2],
        shifted_table.column_boundaries[1] : shifted_table.column_boundaries[2],
    ]
    assert np.array_equal(snapped.image, expected_crop)
    assert naive.image.shape != expected_crop.shape or not np.array_equal(
        naive.image, expected_crop
    )
