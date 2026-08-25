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
        horizontal_count = self._line_count(roi_h, axis=1)
        vertical_count = self._line_count(roi_v, axis=0)
        confidence = min(1.0, (horizontal_count / 8 + vertical_count / 6) / 2)
        detected = horizontal_count >= 4 and vertical_count >= 3
        return TableDetection(
            detected, x, y, box_width, box_height, horizontal_count, vertical_count, confidence
        )

    @staticmethod
    def _line_count(mask: ImageArray, axis: int) -> int:
        projection = np.count_nonzero(mask, axis=axis)
        threshold = mask.shape[axis] * 0.35
        active = projection >= threshold
        return int(np.count_nonzero(active & ~np.r_[False, active[:-1]]))
