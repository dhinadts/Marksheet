from app.schemas.common import NormalizedBox
from app.services.grid_detection import GridSnapper, normalized_to_pixel_box
from app.services.table_detection import TableDetection

IMAGE_WIDTH = 1000
IMAGE_HEIGHT = 1000


def box(x: float, y: float, width: float, height: float) -> NormalizedBox:
    return NormalizedBox(x=x, y=y, width=width, height=height)


def test_normalized_to_pixel_box_matches_legacy_rounding_rule() -> None:
    result = normalized_to_pixel_box(box(0.1, 0.2, 0.2, 0.1), 750, 1000)

    assert (result.x1, result.y1, result.x2, result.y2) == (75, 200, 225, 300)


def test_snap_returns_none_when_boundaries_too_sparse() -> None:
    table = TableDetection(
        True, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT, row_boundaries=(100,), column_boundaries=(100, 900)
    )

    result = GridSnapper().snap(box(0.1, 0.1, 0.2, 0.1), table, IMAGE_WIDTH, IMAGE_HEIGHT)

    assert result is None


def test_snap_returns_none_when_center_falls_outside_boundary_range() -> None:
    table = TableDetection(
        True,
        0,
        0,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        row_boundaries=(800, 900),
        column_boundaries=(800, 900),
    )

    result = GridSnapper().snap(box(0.1, 0.1, 0.2, 0.1), table, IMAGE_WIDTH, IMAGE_HEIGHT)

    assert result is None


def test_snap_returns_bracketing_cell_within_tolerance() -> None:
    # Template expects roughly x:[100,300] y:[100,200]; the detected grid places
    # the real cell a little to the right/below, within the default 30% tolerance.
    table = TableDetection(
        True,
        0,
        0,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        row_boundaries=(110, 210),
        column_boundaries=(120, 310),
    )

    result = GridSnapper().snap(box(0.1, 0.1, 0.2, 0.1), table, IMAGE_WIDTH, IMAGE_HEIGHT)

    assert result is not None
    assert (result.x1, result.y1, result.x2, result.y2) == (120, 110, 310, 210)


def test_snap_returns_none_when_cell_size_exceeds_tolerance() -> None:
    # Template expects a 200x100 cell; the bracketing grid cell is far larger.
    table = TableDetection(
        True,
        0,
        0,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        row_boundaries=(0, 900),
        column_boundaries=(0, 900),
    )

    result = GridSnapper().snap(box(0.1, 0.1, 0.2, 0.1), table, IMAGE_WIDTH, IMAGE_HEIGHT)

    assert result is None


def test_snap_returns_none_when_snapped_cell_smaller_than_minimum_pixels() -> None:
    table = TableDetection(
        True,
        0,
        0,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        row_boundaries=(149, 151),
        column_boundaries=(199, 201),
    )

    result = GridSnapper(size_tolerance_fraction=1.0).snap(
        box(0.1, 0.1, 0.2, 0.1), table, IMAGE_WIDTH, IMAGE_HEIGHT
    )

    assert result is None
