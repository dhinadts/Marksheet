from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Protocol

from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import ServiceError
from app.schemas.common import StrictModel, TemplateCell


@dataclass(frozen=True, slots=True)
class PageMarkResult:
    label: str
    raw_text: str | None
    value: float | None


class PageRecognition(Protocol):
    def recognize_page(self, page_png: bytes, cells: list[TemplateCell]) -> list[PageMarkResult]: ...


class _OpenAiMark(StrictModel):
    label: str
    obtained_mark: float | None = None


class _OpenAiMarksResponse(StrictModel):
    marks: list[_OpenAiMark]


_SYSTEM_PROMPT = (
    "You read a single photographed exam answer sheet and report the handwritten "
    "obtained mark an examiner wrote for each listed question. Only report what is "
    "actually written on the page; if a question's obtained mark is missing, "
    "unreadable, or crossed out without a clear replacement, return null for it. "
    "Never guess a value, and never invent a question that is not in the requested list."
)


def _build_user_prompt(cells: list[TemplateCell]) -> str:
    expected = "\n".join(f"- {cell.label}: maximum mark {cell.maximum_mark}" for cell in cells)
    return (
        "Report the handwritten obtained mark for each of these questions, using "
        "exactly these labels:\n"
        f"{expected}\n\n"
        'Respond with JSON only, shaped as: {"marks": [{"label": "Q1", "obtained_mark": 4}]}. '
        "Include every requested label exactly once."
    )


class OpenAiPageRecognizer:
    """Reads the whole preprocessed page in one call instead of cropping per cell,
    mirroring how a vision-language model reasons about the marks table holistically.
    Opt-in via AI_RECOGNIZER_BACKEND=openai_vision; sends the page image to OpenAI.
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.openai_api_key:
            raise ServiceError(
                503, "OPENAI_NOT_CONFIGURED", "OPENAI_API_KEY is required for the openai_vision backend"
            )
        try:
            from openai import OpenAI  # local import: only needed for this opt-in backend
        except ImportError as error:
            raise ServiceError(
                503, "OPENAI_NOT_CONFIGURED", "The openai package is not installed"
            ) from error
        self._client = OpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_vision_model

    def recognize_page(self, page_png: bytes, cells: list[TemplateCell]) -> list[PageMarkResult]:
        data_url = f"data:image/png;base64,{base64.b64encode(page_png).decode('ascii')}"
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _build_user_prompt(cells)},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("OpenAI response contained no message content")
            parsed = _OpenAiMarksResponse.model_validate(json.loads(content))
        except (ValidationError, json.JSONDecodeError, ValueError, IndexError) as error:
            raise ServiceError(
                502, "OPENAI_REQUEST_FAILED", "OpenAI vision response was empty or malformed"
            ) from error
        except Exception as error:
            if getattr(error, "code", None) == "insufficient_quota" or "insufficient_quota" in str(
                error
            ):
                raise ServiceError(
                    503,
                    "OPENAI_QUOTA_EXCEEDED",
                    "OpenAI API quota is unavailable; add API billing credits and retry the queue",
                ) from error
            raise ServiceError(
                502, "OPENAI_REQUEST_FAILED", "OpenAI vision request failed"
            ) from error
        return [
            PageMarkResult(
                label=mark.label,
                raw_text=None if mark.obtained_mark is None else str(mark.obtained_mark),
                value=mark.obtained_mark,
            )
            for mark in parsed.marks
        ]
