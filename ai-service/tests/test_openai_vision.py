import json
from uuid import UUID

import pytest

from app.core.config import Settings
from app.core.errors import ServiceError
from app.schemas.common import NormalizedBox, TemplateCell
from app.services.openai_vision import OpenAiPageRecognizer, PageMarkResult


def cells() -> list[TemplateCell]:
    return [
        TemplateCell(
            marking_scheme_item_id=UUID("11111111-1111-4111-8111-111111111111"),
            question_id=UUID("22222222-2222-4222-8222-222222222222"),
            label="Q1",
            maximum_mark=5,
            box=NormalizedBox(x=0.1, y=0.1, width=0.2, height=0.1),
        ),
        TemplateCell(
            marking_scheme_item_id=UUID("33333333-3333-4333-8333-333333333333"),
            question_id=UUID("44444444-4444-4444-8444-444444444444"),
            label="Q2",
            maximum_mark=5,
            box=NormalizedBox(x=0.1, y=0.3, width=0.2, height=0.1),
        ),
    ]


class _FakeMessage:
    def __init__(self, content: str | None) -> None:
        self.content = content


class _FakeChoice:
    def __init__(self, content: str | None) -> None:
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content: str | None) -> None:
        self.choices = [_FakeChoice(content)]


def _fake_create(content: str | None):
    def create(**kwargs: object) -> _FakeResponse:
        return _FakeResponse(content)

    return create


def _raise(error: Exception):
    def create(**kwargs: object) -> _FakeResponse:
        raise error

    return create


def test_missing_api_key_raises_not_configured() -> None:
    with pytest.raises(ServiceError) as raised:
        OpenAiPageRecognizer(Settings(openai_api_key=None))

    assert raised.value.code == "OPENAI_NOT_CONFIGURED"


def test_recognize_page_maps_labels_to_results() -> None:
    recognizer = OpenAiPageRecognizer(Settings(openai_api_key="sk-test-key"))
    recognizer._client.chat.completions.create = _fake_create(  # type: ignore[method-assign]
        json.dumps(
            {
                "marks": [
                    {"label": "Q1", "obtained_mark": 4},
                    {"label": "Q2", "obtained_mark": None},
                ]
            }
        )
    )

    results = recognizer.recognize_page(b"fake-png-bytes", cells())

    assert results == [
        PageMarkResult(label="Q1", raw_text="4.0", value=4.0),
        PageMarkResult(label="Q2", raw_text=None, value=None),
    ]


def test_malformed_response_raises_request_failed() -> None:
    recognizer = OpenAiPageRecognizer(Settings(openai_api_key="sk-test-key"))
    recognizer._client.chat.completions.create = _fake_create("not json")  # type: ignore[method-assign]

    with pytest.raises(ServiceError) as raised:
        recognizer.recognize_page(b"fake-png-bytes", cells())

    assert raised.value.code == "OPENAI_REQUEST_FAILED"


def test_empty_response_raises_request_failed() -> None:
    recognizer = OpenAiPageRecognizer(Settings(openai_api_key="sk-test-key"))
    recognizer._client.chat.completions.create = _fake_create(None)  # type: ignore[method-assign]

    with pytest.raises(ServiceError) as raised:
        recognizer.recognize_page(b"fake-png-bytes", cells())

    assert raised.value.code == "OPENAI_REQUEST_FAILED"


def test_insufficient_quota_has_actionable_error() -> None:
    recognizer = OpenAiPageRecognizer(Settings(openai_api_key="sk-test-key"))
    quota_error = RuntimeError("429 insufficient_quota")
    recognizer._client.chat.completions.create = _raise(quota_error)  # type: ignore[method-assign]

    with pytest.raises(ServiceError) as raised:
        recognizer.recognize_page(b"fake-png-bytes", cells())

    assert raised.value.status_code == 503
    assert raised.value.code == "OPENAI_QUOTA_EXCEEDED"
    assert "billing credits" in raised.value.message
