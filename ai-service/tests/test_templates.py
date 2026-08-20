from uuid import UUID

import numpy as np
import pytest

from app.core.errors import ServiceError
from app.schemas.common import NormalizedBox, TemplateCell, TemplateDefinition
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
