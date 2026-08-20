import hashlib
from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.errors import ServiceError
from app.services.recognition import OnnxMarkRecognizer, parse_mark


def test_model_must_be_configured_with_checksum() -> None:
    with pytest.raises(ServiceError) as raised:
        OnnxMarkRecognizer(Settings())

    assert raised.value.code == "MODEL_NOT_CONFIGURED"


def test_modified_model_artifact_is_rejected(tmp_path: Path) -> None:
    artifact = tmp_path / "recognizer.onnx"
    artifact.write_bytes(b"not-a-reviewed-model")
    different_checksum = hashlib.sha256(b"different").hexdigest()

    with pytest.raises(ServiceError) as raised:
        OnnxMarkRecognizer(
            Settings(
                model_path=str(artifact),
                model_checksum_sha256=different_checksum,
            )
        )

    assert raised.value.code == "MODEL_CHECKSUM_MISMATCH"


@pytest.mark.parametrize(("raw", "expected"), [("13", 13.0), ("6.5", 6.5), ("?", None)])
def test_model_labels_can_represent_configurable_mark_values(
    raw: str, expected: float | None
) -> None:
    assert parse_mark(raw) == expected
