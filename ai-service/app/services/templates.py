from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.core.errors import ServiceError
from app.schemas.common import TemplateDefinition
from app.schemas.results import DetectedCell, TemplateMatchResponse
from app.services.preprocessing import ImageArray


@dataclass(slots=True)
class CellCrop:
    definition: DetectedCell
    image: ImageArray


class TemplateDetector:
    def match(self, image: ImageArray, template: TemplateDefinition) -> TemplateMatchResponse:
        height, width = image.shape[:2]
        observed = width / height
        relative_error = (
            abs(observed - template.expected_aspect_ratio) / template.expected_aspect_ratio
        )
        confidence = max(0.0, 1.0 - relative_error / template.aspect_ratio_tolerance)
        return TemplateMatchResponse(
            template_id=template.template_id,
            template_version=template.version,
            matched=relative_error <= template.aspect_ratio_tolerance,
            confidence=round(confidence, 6),
            observed_aspect_ratio=round(observed, 6),
        )

    def extract_cells(self, image: ImageArray, template: TemplateDefinition) -> list[CellCrop]:
        match = self.match(image, template)
        if not match.matched:
            raise ServiceError(
                422, "TEMPLATE_MISMATCH", "Image aspect ratio does not match the selected template"
            )
        height, width = image.shape[:2]
        cells: list[CellCrop] = []
        for cell in template.cells:
            x1 = max(0, round(cell.box.x * width))
            y1 = max(0, round(cell.box.y * height))
            x2 = min(width, round((cell.box.x + cell.box.width) * width))
            y2 = min(height, round((cell.box.y + cell.box.height) * height))
            crop = image[y1:y2, x1:x2]
            if crop.size == 0 or min(crop.shape[:2]) < 4:
                raise ServiceError(
                    422,
                    "INVALID_TEMPLATE_CELL",
                    f"Template cell {cell.label} is empty or too small",
                )
            cells.append(
                CellCrop(
                    definition=DetectedCell(
                        marking_scheme_item_id=cell.marking_scheme_item_id,
                        question_id=cell.question_id,
                        question_part_id=cell.question_part_id,
                        label=cell.label,
                        maximum_mark=cell.maximum_mark,
                        bounding_box=cell.box,
                    ),
                    image=np.ascontiguousarray(crop),
                )
            )
        return cells
