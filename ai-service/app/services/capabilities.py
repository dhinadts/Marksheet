from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Capability:
    name: str
    available: bool
    target_phase: int


CAPABILITIES = (
    Capability("quality_check", True, 10),
    Capability("preprocess", True, 10),
    Capability("template_detection", True, 11),
    Capability("cell_detection", True, 11),
    Capability("handwriting_recognition", True, 12),
    Capability("mark_validation", True, 12),
    Capability("mark_sheet_processing", True, 12),
    Capability("openai_vision_recognition", True, 13),
    Capability("vision_language_local_recognition", False, 14),
)
