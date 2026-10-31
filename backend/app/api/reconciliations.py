"""HTTP handlers: validation and orchestration only. Routes follow AGENTS.md API contract."""

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.schemas.domain import Corrections, DocumentKind, Reconciliation
from app.services import claims, corrections as correction_service, pipeline, store
from app.services.extract import ExtractionError

router = APIRouter(prefix="/reconciliations", tags=["reconciliations"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


async def _read(file: UploadFile, kind: DocumentKind) -> pipeline.Upload:
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"{kind.value} is larger than {MAX_UPLOAD_BYTES // 1024 // 1024} MB")
    if not content:
        raise HTTPException(422, f"{kind.value} is empty")
    return pipeline.Upload(kind=kind, filename=file.filename or kind.value, content=content)


@router.post("", response_model=Reconciliation)
async def create_reconciliation(
    purchase_order: UploadFile, delivery_note: UploadFile, invoice: UploadFile | None = None
) -> Reconciliation:
    po = await _read(purchase_order, DocumentKind.PURCHASE_ORDER)
    dn = await _read(delivery_note, DocumentKind.DELIVERY_NOTE)
    inv = await _read(invoice, DocumentKind.INVOICE) if invoice and invoice.filename else None
    try:
        return await pipeline.run_reconciliation(po, dn, inv)
    except ExtractionError as exc:
        raise HTTPException(422, str(exc)) from exc


def _get_or_404(reconciliation_id: str) -> Reconciliation:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise HTTPException(404, "Reconciliation not found")
    return rec


@router.get("/{reconciliation_id}", response_model=Reconciliation)
def get_reconciliation(reconciliation_id: str) -> Reconciliation:
    return _get_or_404(reconciliation_id)


@router.get("/{reconciliation_id}/documents/{document_id}/file")
def get_document_file(reconciliation_id: str, document_id: str) -> FileResponse:
    """The original scan, so the UI can show extracted lines beside it for confirmation."""
    rec = _get_or_404(reconciliation_id)
    if document_id not in {d.id for d in rec.documents}:  # also blocks path traversal
        raise HTTPException(404, "Document not found")
    path = pipeline.upload_path(reconciliation_id, document_id)
    if not path.is_file():
        raise HTTPException(404, "Document file missing")
    return FileResponse(path, media_type=pipeline.media_type(path.read_bytes()))


@router.post("/{reconciliation_id}/approve", response_model=Reconciliation)
def approve_reconciliation(reconciliation_id: str) -> Reconciliation:
    _get_or_404(reconciliation_id)
    try:
        claims.approve_claim(reconciliation_id)
    except claims.ClaimError as exc:
        raise HTTPException(409, str(exc)) from exc
    return _get_or_404(reconciliation_id)


@router.post("/{reconciliation_id}/corrections", response_model=Reconciliation)
async def correct_reconciliation(reconciliation_id: str, corrections: Corrections) -> Reconciliation:
    """Fix OCR-misread lines or choose products manually; re-reconciles and updates the draft claim."""
    try:
        return await correction_service.apply_corrections(reconciliation_id, corrections)
    except correction_service.CorrectionNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except correction_service.CorrectionConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except correction_service.CorrectionInvalid as exc:
        raise HTTPException(422, str(exc)) from exc
