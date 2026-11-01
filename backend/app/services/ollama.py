"""Thin async client for a local Ollama server. No inference runs at startup."""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings


class OllamaError(Exception):
    """Raised when Ollama is unreachable, times out, or returns an error."""


@dataclass(frozen=True)
class ProviderConfig:
    """Per-request provider override. API keys are never put in prompts or logs."""

    provider: str = "ollama"
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None


def _target(config: ProviderConfig | None) -> tuple[str, str, dict[str, str], str, bool]:
    settings = get_settings()
    if config and config.provider == "openai":
        if not config.api_key or not config.base_url or not config.model:
            raise OllamaError("A personal API key, model and compatible API URL are required")
        base = config.base_url.rstrip("/")
        endpoint = base if base.endswith("/chat/completions") else f"{base}/chat/completions" if base.endswith("/v1") else f"{base}/v1/chat/completions"
        return endpoint, config.model, {"Authorization": f"Bearer {config.api_key}"}, "openai", False
    base = (config.base_url if config else None) or settings.ollama_base_url
    model = (config.model if config else None) or settings.ollama_model
    return f"{base.rstrip('/')}/api/chat", model, {}, "ollama", True


def _payload(messages: list[dict[str, str]], model: str, provider: str, stream: bool, think: bool) -> dict[str, Any]:
    if provider == "openai":
        return {"model": model, "messages": messages, "stream": stream, "temperature": 0}
    return {
        "model": model, "messages": messages, "stream": stream, "think": think,
        "keep_alive": "30m", "options": {"temperature": 0},
    }


async def chat(
    messages: list[dict[str, str]],
    *,
    format: str | dict[str, Any] | None = None,
    timeout: float = 60.0,
    model: str | None = None,
    think: bool = False,
    provider: ProviderConfig | None = None,
) -> str:
    """Send messages to Ollama's /api/chat and return the raw message content.

    The caller must validate the content; it is never trusted as-is.
    """
    config = provider or ProviderConfig(model=model)
    endpoint, selected_model, headers, provider_name, _ = _target(config)
    payload = _payload(messages, model or selected_model, provider_name, False, think)
    if format is not None:
        payload["format"] = format

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            body = response.json()
            if provider_name == "openai":
                return str(body["choices"][0]["message"]["content"])
            return str(body["message"]["content"])
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
    provider: ProviderConfig | None = None,
) -> AsyncIterator[str]:
    """Yield the reply in pieces as the model writes it, so the caller can start speaking sooner.

    Thinking tokens (when think=True) are not yielded; only the final answer is.
    """
    config = provider or ProviderConfig(model=model)
    endpoint, selected_model, headers, provider_name, _ = _target(config)
    payload = _payload(messages, model or selected_model, provider_name, True, think)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    raw = line.removeprefix("data:").strip() if provider_name == "openai" else line
                    if raw == "[DONE]":
                        break
                    body = json.loads(raw)
                    piece = body.get("choices", [{}])[0].get("delta", {}).get("content", "") if provider_name == "openai" else body.get("message", {}).get("content", "")
                    if piece:
                        yield piece
    except httpx.TimeoutException as exc:
        raise OllamaError("Ollama request timed out") from exc
    except httpx.HTTPError as exc:
        raise OllamaError(f"Ollama request failed: {exc}") from exc
    except (ValueError, KeyError, IndexError) as exc:
        raise OllamaError("Unexpected response from Ollama") from exc
