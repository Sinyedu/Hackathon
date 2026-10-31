"""Voice + question endpoints: validation and orchestration only."""

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.schemas.domain import Document
from app.services import assistant, ollama, recovery, speech, store

router = APIRouter(tags=["assistant"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    focus: str | None = Field(default=None, max_length=100)  # card the user has open


class AskResponse(BaseModel):
    answer: str
    sources: list[Document]  # the scans the answer is based on (UI links to the originals)
    focus: str | None = None  # card the answer is about; the UI opens it
    grounded: bool = True  # False: the model's wording was rejected and the answer comes straight from the data


class TranscriptResponse(BaseModel):
    text: str


@router.get("/reconciliations/{reconciliation_id}/cards", response_model=list[assistant.Card])
def cards(reconciliation_id: str) -> list[assistant.Card]:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise HTTPException(404, "Reconciliation not found")
    return assistant.build_cards(rec, recovery.get_plans_for_all(reconciliation_id))


@router.post("/reconciliations/{reconciliation_id}/ask", response_model=AskResponse)
async def ask(reconciliation_id: str, body: AskRequest) -> AskResponse:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise HTTPException(404, "Reconciliation not found")
    question = body.question.strip()
    if not question:
        raise HTTPException(422, "Question is empty")
    plans = recovery.get_plans_for_all(reconciliation_id)
    try:
        reply, sources, focus, grounded = await assistant.answer(rec, plans, question, body.focus)
    except ollama.OllamaError as exc:
        raise HTTPException(503, "The local AI model is not available right now") from exc
    return AskResponse(answer=reply, sources=sources, focus=focus, grounded=grounded)


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
