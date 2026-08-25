import pytest

from app.core.config import Settings


def test_rejects_short_internal_service_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_INTERNAL_API_KEY", "too-short")

    with pytest.raises(ValueError, match="at least 32"):
        Settings.from_environment()


def test_rejects_unbounded_image_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_MAX_IMAGE_BYTES", "100")

    with pytest.raises(ValueError, match="between 1 KiB and 100 MiB"):
        Settings.from_environment()


def test_rejects_unknown_log_level(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_LOG_LEVEL", "verbose")

    with pytest.raises(ValueError, match="standard logging level"):
        Settings.from_environment()


def test_recognizer_backend_defaults_to_template_cnn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AI_RECOGNIZER_BACKEND", raising=False)

    assert Settings.from_environment().recognizer_backend == "template_cnn"


def test_rejects_unknown_recognizer_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_RECOGNIZER_BACKEND", "gpt4v")

    with pytest.raises(ValueError, match="template_cnn"):
        Settings.from_environment()


def test_openai_api_key_round_trips_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")

    assert Settings.from_environment().openai_api_key == "sk-test-key"
