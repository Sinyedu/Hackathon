"""HTTP handlers: validation and orchestration only. Routes follow AGENTS.md API contract."""

from fastapi import APIRouter, HTTPException, UploadFile

from app.schemas.domain import Reconciliation

router = APIRouter(prefix="/reconciliations", tags=["reconciliations"])

NOT_IMPLEMENTED = HTTPException(status_code=501, detail="Not implemented yet")


@router.post("", response_model=Reconciliation)
async def create_reconciliation(
    purchase_order: UploadFile, delivery_note: UploadFile, invoice: UploadFile | None = None
) -> Reconciliation:
    raise NOT_IMPLEMENTED


@router.get("/{reconciliation_id}", response_model=Reconciliation)
def get_reconciliation(reconciliation_id: str) -> Reconciliation:
    raise NOT_IMPLEMENTED


@router.post("/{reconciliation_id}/approve", response_model=Reconciliation)
def approve_reconciliation(reconciliation_id: str) -> Reconciliation:
    raise NOT_IMPLEMENTED
