from __future__ import annotations

from dataclasses import dataclass
from itertools import pairwise

from app.schemas.common import NormalizedBox
from app.services.table_detection import TableDetection


@dataclass(frozen=True, slots=True)
class PixelBox:
    x1: int
    y1: int
    x2: int
    y2: int


def normalized_to_pixel_box(box: NormalizedBox, image_width: int, image_height: int) -> PixelBox:
    """The rounding rule template cell cropping has always used for percentage boxes."""
    x1 = max(0, round(box.x * image_width))
    y1 = max(0, round(box.y * image_height))
    x2 = min(image_width, round((box.x + box.width) * image_width))
    y2 = min(image_height, round((box.y + box.height) * image_height))
    return PixelBox(x1, y1, x2, y2)


class GridSnapper:
    """Snaps a template cell's normalized box onto the ruled grid actually detected
    in the photographed page, so photo alignment drift does not silently crop the
    wrong cell. Returns None whenever the grid is too sparse to be usable or the
    snap would be ambiguous; callers must fall back to the raw percentage crop in
    that case, so this can only make extraction more robust, never worse, than
    blind percentage cropping.
    """

    def __init__(
        self,
        min_row_boundaries: int = 2,
        min_column_boundaries: int = 2,
        size_tolerance_fraction: float = 0.3,
        minimum_cell_size_px: int = 4,
    ) -> None:
        self._min_row_boundaries = min_row_boundaries
        self._min_column_boundaries = min_column_boundaries
        self._size_tolerance_fraction = size_tolerance_fraction
        self._minimum_cell_size_px = minimum_cell_size_px

    def snap(
        self, box: NormalizedBox, table: TableDetection, image_width: int, image_height: int
    ) -> PixelBox | None:
        if (
            len(table.row_boundaries) < self._min_row_boundaries
            or len(table.column_boundaries) < self._min_column_boundaries
        ):
            return None
        raw = normalized_to_pixel_box(box, image_width, image_height)
        center_x, center_y = (raw.x1 + raw.x2) / 2, (raw.y1 + raw.y2) / 2
        row = self._bracket(table.row_boundaries, center_y)
        column = self._bracket(table.column_boundaries, center_x)
        if row is None or column is None:
            return None
        top, bottom = row
        left, right = column
        if self._too_different(bottom - top, raw.y2 - raw.y1) or self._too_different(
            right - left, raw.x2 - raw.x1
        ):
            return None
        if (bottom - top) < self._minimum_cell_size_px or (
            right - left
        ) < self._minimum_cell_size_px:
            return None
        return PixelBox(
            max(0, left), max(0, top), min(image_width, right), min(image_height, bottom)
        )

    @staticmethod
    def _bracket(boundaries: tuple[int, ...], value: float) -> tuple[int, int] | None:
        for lower, upper in pairwise(boundaries):
            if lower <= value <= upper:
                return lower, upper
        return None

    def _too_different(self, detected: int, expected: int) -> bool:
        if expected <= 0:
            return True
        return abs(detected - expected) / expected > self._size_tolerance_fraction
