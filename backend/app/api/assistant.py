"""Voice + question endpoints: validation and orchestration only."""

import json

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.schemas.domain import Document
from app.services import assistant, ollama, recovery, speech, store

router = APIRouter(tags=["assistant"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[assistant.Turn] = Field(default_factory=list, max_length=20)  # earlier turns, oldest first
    focus: str | None = Field(default=None, max_length=100)  # card the user has open


class AskResponse(BaseModel):
    answer: str
    sources: list[Document]  # the scans the answer is based on (UI links to the originals)
    focus: str | None = None  # card the answer is about; the UI opens it
    grounded: bool = True  # False: the model's wording was rejected and the answer comes straight from the data


class TranscriptResponse(BaseModel):
    text: str


def provider_from_request(request: Request) -> ollama.ProviderConfig | None:
    """Read optional per-browser settings without persisting the user's key."""
    raw_provider = request.headers.get("x-kiwi-provider")
    # No headers means a normal server-configured request. This preserves the backend's
    # assistant-model fallback and keeps the browser override opt-in.
    if not raw_provider:
        return None
    provider = raw_provider.lower().strip()
    if provider not in {"ollama", "openai"}:
        raise HTTPException(400, "Unknown AI provider")
    if provider == "ollama":
        return ollama.ProviderConfig(
            provider="ollama",
            base_url=request.headers.get("x-kiwi-base-url") or None,
            model=request.headers.get("x-kiwi-model") or None,
        )
    key = request.headers.get("x-kiwi-api-key", "").strip()
    if not key:
        raise HTTPException(400, "Add your personal API key in Kiwi's dashboard first")
    return ollama.ProviderConfig(
        provider="openai",
        base_url=request.headers.get("x-kiwi-base-url") or None,
        model=request.headers.get("x-kiwi-model") or None,
        api_key=key,
    )


@router.get("/reconciliations/{reconciliation_id}/cards", response_model=list[assistant.Card])
def cards(reconciliation_id: str) -> list[assistant.Card]:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise HTTPException(404, "Reconciliation not found")
    return assistant.build_cards(rec, recovery.get_plans_for_all(reconciliation_id))


@router.post("/reconciliations/{reconciliation_id}/ask", response_model=AskResponse)
async def ask(reconciliation_id: str, body: AskRequest, request: Request) -> AskResponse:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise HTTPException(404, "Reconciliation not found")
    question = body.question.strip()
    if not question:
        raise HTTPException(422, "Question is empty")
    plans = recovery.get_plans_for_all(reconciliation_id)
    try:
        reply, sources, focus, grounded = await assistant.answer(rec, plans, question, body.focus, body.history, provider_from_request(request))
    except ollama.OllamaError as exc:
        raise HTTPException(503, "The configured AI model is not available right now") from exc
    return AskResponse(answer=reply, sources=sources, focus=focus, grounded=grounded)


@router.post("/reconciliations/{reconciliation_id}/ask/stream")
async def ask_stream(reconciliation_id: str, body: AskRequest, request: Request) -> StreamingResponse:
    """NDJSON: one JSON event per line (meta, sentence, fallback, done, or error)."""
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise HTTPException(404, "Reconciliation not found")
    if not body.question.strip():
        raise HTTPException(422, "Question is empty")
    plans = recovery.get_plans_for_all(reconciliation_id)
    provider = provider_from_request(request)

    async def events():
        try:
            async for event in assistant.answer_stream(rec, plans, body.question.strip(), body.focus, body.history, provider):
                yield json.dumps(event) + "\n"
        except ollama.OllamaError:
            yield json.dumps({"type": "error", "detail": "The configured AI model is not available right now"}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


@router.post("/voice/transcribe", response_model=TranscriptResponse)
async def transcribe(audio: UploadFile) -> TranscriptResponse:
    content = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Recording is too long")
    if not content:
        raise HTTPException(422, "Recording is empty")
    try:
        text = await run_in_threadpool(speech.transcribe, content)
    except speech.SpeechUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except speech.SpeechError as exc:
        raise HTTPException(422, str(exc)) from exc
    return TranscriptResponse(text=text)
