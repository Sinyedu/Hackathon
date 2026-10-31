"""AutoRecover HTTP handlers: validation and orchestration only."""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.domain import DocumentKind, Reconciliation
from app.schemas.recovery import (
    DecisionRequest,
    DraftOrderRequest,
    Priority,
    RecoveryPlan,
    ReplacementOrder,
    Supplier,
)
from app.services import pipeline, recovery, replacement_orders, suppliers

router = APIRouter(tags=["autorecover"])


@router.get("/suppliers", response_model=list[Supplier])
def list_suppliers() -> list[Supplier]:
    return suppliers.list_suppliers()


@router.get("/reconciliations/{reconciliation_id}/discrepancies/{item_id}/recovery", response_model=RecoveryPlan)
def get_recovery(reconciliation_id: str, item_id: str) -> RecoveryPlan:
    plan = recovery.get_plan_for(reconciliation_id, item_id)
    if plan is None:
        raise HTTPException(404, "No recovery plan yet")
    return plan


@router.post("/reconciliations/{reconciliation_id}/discrepancies/{item_id}/recover", response_model=RecoveryPlan)
async def recover(reconciliation_id: str, item_id: str, priority: Priority = "cost") -> RecoveryPlan:
    """Generate (or refresh) the recovery plan for a persisted shortage."""
    try:
        return await recovery.recover(reconciliation_id, item_id, priority)
    except recovery.RecoveryNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except recovery.RecoveryInvalid as exc:
        raise HTTPException(422, str(exc)) from exc


def _order_errors(exc: replacement_orders.OrderError) -> HTTPException:
    status = {replacement_orders.OrderNotFound: 404, replacement_orders.OrderConflict: 409}.get(type(exc), 422)
    return HTTPException(status, str(exc))


@router.post("/recovery-plans/{plan_id}/draft-order", response_model=ReplacementOrder)
def draft_order(plan_id: str, body: DraftOrderRequest) -> ReplacementOrder:
    try:
        return replacement_orders.create_draft_order(plan_id, body.option_id)
    except replacement_orders.OrderError as exc:
        raise _order_errors(exc) from exc


@router.post("/replacement-orders/{order_id}/approve", response_model=ReplacementOrder)
def approve_order(order_id: str, body: DecisionRequest | None = None) -> ReplacementOrder:
    try:
        return replacement_orders.approve_order(order_id, body.confirm_substitution if body else False)
    except replacement_orders.OrderError as exc:
        raise _order_errors(exc) from exc


@router.post("/replacement-orders/{order_id}/reject", response_model=ReplacementOrder)
def reject_order(order_id: str) -> ReplacementOrder:
    try:
        return replacement_orders.reject_order(order_id)
    except replacement_orders.OrderError as exc:
        raise _order_errors(exc) from exc


@router.post("/demo/missing-tomatoes", response_model=Reconciliation)
async def demo_missing_tomatoes() -> Reconciliation:
    """Run the real pipeline (OCR, matching, reconcile) on the synthetic fixture scans.

    PO: 24 cases of tomatoes; delivery note: 18. Nothing is hardcoded about the outcome.
    """
    fixtures = Path(get_settings().catalog_path).parent
    try:
        po = pipeline.Upload(DocumentKind.PURCHASE_ORDER, "demo_purchase_order.png",
                             (fixtures / "purchase_order.png").read_bytes())
        dn = pipeline.Upload(DocumentKind.DELIVERY_NOTE, "demo_delivery_note.png",
                             (fixtures / "delivery_note.png").read_bytes())
    except OSError as exc:
        raise HTTPException(500, "Demo fixtures are missing") from exc
    return await pipeline.run_reconciliation(po, dn)
