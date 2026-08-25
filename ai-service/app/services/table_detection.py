from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import cv2
import numpy as np

from app.services.preprocessing import ImageArray


@dataclass(frozen=True, slots=True)
class TableDetection:
    detected: bool
    x: int = 0
    y: int = 0
    width: int = 0
    height: int = 0
    horizontal_lines: int = 0
    vertical_lines: int = 0
    confidence: float = 0.0
    row_boundaries: tuple[int, ...] = ()
    column_boundaries: tuple[int, ...] = ()


class MarksTableDetector:
    """Find a ruled marks table without depending on input pixel dimensions."""

    def detect(self, image: ImageArray) -> TableDetection:
        gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 12
        )
        height, width = gray.shape
        horizontal = cv2.morphologyEx(
            binary,
            cv2.MORPH_OPEN,
            cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, width // 18), 1)),
        )
        vertical = cv2.morphologyEx(
            binary,
            cv2.MORPH_OPEN,
            cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, height // 25))),
        )
        grid = cv2.bitwise_or(horizontal, vertical)
        contours, _ = cv2.findContours(grid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates: list[tuple[int, int, int, int]] = []
        for contour in contours:
            x, y, box_width, box_height = cv2.boundingRect(contour)
            area_ratio = box_width * box_height / (width * height)
            if area_ratio >= 0.08 and box_width >= width * 0.35 and box_height >= height * 0.12:
                candidates.append((x, y, box_width, box_height))
        if not candidates:
            return TableDetection(False)
        x, y, box_width, box_height = max(candidates, key=lambda box: box[2] * box[3])
        roi_h = cast(ImageArray, horizontal[y : y + box_height, x : x + box_width])
        roi_v = cast(ImageArray, vertical[y : y + box_height, x : x + box_width])
        # axis=1 on the horizontal-line mask projects along columns, giving the
        # y-position of each row-separating rule line; axis=0 on the vertical-line
        # mask projects along rows, giving the x-position of each column separator.
        row_boundaries = [y + p for p in self._line_positions(roi_h, axis=1)]
        column_boundaries = [x + p for p in self._line_positions(roi_v, axis=0)]
        horizontal_count = len(row_boundaries)
        vertical_count = len(column_boundaries)
        confidence = min(1.0, (horizontal_count / 8 + vertical_count / 6) / 2)
        detected = horizontal_count >= 4 and vertical_count >= 3
        return TableDetection(
            detected,
            x,
            y,
            box_width,
            box_height,
            horizontal_count,
            vertical_count,
            confidence,
            row_boundaries=tuple(row_boundaries),
            column_boundaries=tuple(column_boundaries),
        )

    @staticmethod
    def _line_positions(mask: ImageArray, axis: int) -> list[int]:
        """Center pixel index (relative to `mask`) of each contiguous rule-line band."""
        projection = np.count_nonzero(mask, axis=axis)
        threshold = mask.shape[axis] * 0.35
        active = projection >= threshold
        positions: list[int] = []
        start: int | None = None
        for index, is_active in enumerate(active):
            if is_active and start is None:
                start = index
            elif not is_active and start is not None:
                positions.append((start + index - 1) // 2)
                start = None
        if start is not None:
            positions.append((start + len(active) - 1) // 2)
        return positions
