"""Thin async client for a local Ollama server. No inference runs at startup."""

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import get_settings


class OllamaError(Exception):
    """Raised when Ollama is unreachable, times out, or returns an error."""


async def chat(
    messages: list[dict[str, str]],
    *,
    format: str | dict[str, Any] | None = None,
    timeout: float = 60.0,
    model: str | None = None,
    think: bool = False,
) -> str:
    """Send messages to Ollama's /api/chat and return the raw message content.

    The caller must validate the content; it is never trusted as-is.
    """
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": model or settings.ollama_model,
        "messages": messages,
        "stream": False,
        "think": think,
        "keep_alive": "30m",  # stay loaded: a cold start costs seconds on every first question
        "options": {"temperature": 0},
    }
    if format is not None:
        payload["format"] = format

    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=timeout) as client:
            response = await client.post("/api/chat", json=payload)
            response.raise_for_status()
            return str(response.json()["message"]["content"])
    except httpx.TimeoutException as exc:
        raise OllamaError("Ollama request timed out") from exc
    except httpx.HTTPError as exc:
        raise OllamaError(f"Ollama request failed: {exc}") from exc
    except (KeyError, ValueError) as exc:
        raise OllamaError("Unexpected response from Ollama") from exc


async def chat_stream(
    messages: list[dict[str, str]],
    *,
    timeout: float = 120.0,
    model: str | None = None,
    think: bool = False,
) -> AsyncIterator[str]:
    """Yield the reply in pieces as the model writes it, so the caller can start speaking sooner.

    Thinking tokens (when think=True) are not yielded; only the final answer is.
    """
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": model or settings.ollama_model, "messages": messages, "stream": True, "think": think,
        "keep_alive": "30m", "options": {"temperature": 0},
    }
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=timeout) as client:
            async with client.stream("POST", "/api/chat", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    piece = json.loads(line).get("message", {}).get("content", "")
                    if piece:
                        yield piece
    except httpx.TimeoutException as exc:
        raise OllamaError("Ollama request timed out") from exc
    except httpx.HTTPError as exc:
        raise OllamaError(f"Ollama request failed: {exc}") from exc
    except ValueError as exc:
        raise OllamaError("Unexpected response from Ollama") from exc
