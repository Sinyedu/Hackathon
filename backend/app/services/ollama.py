"""Thin async client for a local Ollama server. No inference runs at startup."""

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
) -> str:
    """Send messages to Ollama's /api/chat and return the raw message content.

    The caller must validate the content; it is never trusted as-is.
    """
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "think": False,
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
