from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.core.errors import ServiceError
from app.schemas.common import TemplateDefinition
from app.schemas.results import DetectedCell, TemplateMatchResponse
from app.services.grid_detection import GridSnapper, normalized_to_pixel_box
from app.services.preprocessing import ImageArray
from app.services.table_detection import TableDetection


@dataclass(slots=True)
class CellCrop:
    definition: DetectedCell
    image: ImageArray


class TemplateDetector:
    def __init__(self, snapper: GridSnapper | None = None) -> None:
        self._snapper = snapper or GridSnapper()

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

    def extract_cells(
        self,
        image: ImageArray,
        template: TemplateDefinition,
        table: TableDetection | None = None,
    ) -> list[CellCrop]:
        match = self.match(image, template)
        if not match.matched:
            raise ServiceError(
                422, "TEMPLATE_MISMATCH", "Image aspect ratio does not match the selected template"
            )
        height, width = image.shape[:2]
        cells: list[CellCrop] = []
        for cell in template.cells:
            pixel_box = None
            if table is not None and table.detected:
                pixel_box = self._snapper.snap(cell.box, table, width, height)
            if pixel_box is None:
                pixel_box = normalized_to_pixel_box(cell.box, width, height)
            crop = image[pixel_box.y1 : pixel_box.y2, pixel_box.x1 : pixel_box.x2]
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
