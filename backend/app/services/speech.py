"""Owner: AI. Speech-to-text with open-weight Whisper (faster-whisper, CPU, int8).

The model (~480 MB for small.en) downloads from Hugging Face on first use and is then cached.
Transcripts are untrusted text like any other input.
"""

import io
from functools import lru_cache
from typing import Any

from app.core.config import get_settings


# Vocabulary hint: biases Whisper toward the words this app hears (the wake phrase, products, documents).
# Measured on noisy synthetic speech: halves word errors versus no hint.
INITIAL_PROMPT = ("Hey agent. DockProof delivery check. Purchase order, delivery note, tomatoes, potatoes, "
                  "olive oil, mozzarella, cases, sacks, shortage, supplier, claim, FarmDirect, GreenSupply.")


class SpeechError(Exception):
    """The audio could not be read or transcribed."""


class SpeechUnavailable(SpeechError):
    """The speech model could not be loaded (e.g. first download failed)."""


@lru_cache(maxsize=1)
def _model() -> Any:
    from faster_whisper import WhisperModel  # heavy import; only when speech is actually used

    try:
        return WhisperModel(get_settings().whisper_model, device="cpu", compute_type="int8")
    except Exception as exc:  # download / load failures raise assorted types
        raise SpeechUnavailable(f"Speech model could not be loaded: {exc}") from exc


def transcribe(content: bytes) -> str:
    """Synchronous and CPU-bound: call from a threadpool. Returns '' when no speech was heard."""
    model = _model()
    try:
        segments, _ = model.transcribe(io.BytesIO(content), language=get_settings().whisper_language or None,
                                       beam_size=5, vad_filter=True, initial_prompt=INITIAL_PROMPT,
                                       condition_on_previous_text=False)
        return " ".join(s.text.strip() for s in segments).strip()
    except Exception as exc:  # undecodable audio raises av/ctranslate2 errors
        raise SpeechError("Could not read the audio") from exc
