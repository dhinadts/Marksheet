from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Capability:
    name: str
    available: bool
    target_phase: int


CAPABILITIES = (
    Capability("quality_check", False, 10),
    Capability("preprocess", False, 10),
    Capability("template_detection", False, 11),
    Capability("cell_detection", False, 11),
    Capability("handwriting_recognition", False, 12),
    Capability("mark_validation", False, 12),
    Capability("mark_sheet_processing", False, 12),
)
