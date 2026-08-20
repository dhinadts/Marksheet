from dataclasses import dataclass


@dataclass(slots=True)
class ServiceError(Exception):
    status_code: int
    code: str
    message: str


class CapabilityUnavailableError(ServiceError):
    def __init__(self, capability: str, target_phase: int) -> None:
        super().__init__(
            501, "CAPABILITY_NOT_IMPLEMENTED", f"{capability} is reserved for Phase {target_phase}"
        )
