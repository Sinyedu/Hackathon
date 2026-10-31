"""Draft replacement orders and internal approve/reject.

Nothing here contacts a supplier, sends an email, or changes inventory: approval only records a
status in process-local memory. At most one live (draft/approved) order exists per recovery plan.
"""

import uuid

from app.schemas.recovery import OrderStatus, RecoveryPlan, ReplacementOrder
from app.services import recovery, store


class OrderError(Exception):
    pass


class OrderNotFound(OrderError):
    pass


class OrderConflict(OrderError):
    pass


class OrderInvalid(OrderError):
    pass


def _live_order(state: store.SessionStore, plan_id: str) -> ReplacementOrder | None:
    return next((order for payload in state.replacement_orders.values()
                 if (order := ReplacementOrder.model_validate_json(payload)).plan_id == plan_id and
                 order.status in {OrderStatus.DRAFT, OrderStatus.APPROVED}), None)


def _warning(option) -> str | None:
    if option.requires_confirmation:
        return f"Substitute product, not verified by rules: {option.ai_reason or option.compatibility_note}"
    if option.compatibility.value == "repack":
        return option.compatibility_note
    return None


def create_draft_order(plan_id: str, option_id: str) -> ReplacementOrder:
    """Idempotent: asking again for the same option returns the existing live order."""
    plan: RecoveryPlan | None = recovery.get_plan(plan_id)
    if plan is None:
        raise OrderNotFound("Recovery plan not found")
    option = next((o for o in plan.options if o.option_id == option_id), None)
    if option is None:
        raise OrderInvalid("Unknown recovery option")
    if not option.fulfills_shortage:
        raise OrderInvalid("This option cannot cover the full shortage")
    with store.transaction() as state:
        live = _live_order(state, plan_id)
        if live is not None:
            if live.option.option_id == option_id:
                return live
            raise OrderConflict(f"This plan already has a {live.status.value} order; reject it first")
        order = ReplacementOrder(
            id=f"RO-{uuid.uuid4().hex[:10]}", plan_id=plan_id, reconciliation_id=plan.reconciliation_id,
            catalog_item_id=plan.catalog_item_id, original_description=plan.description,
            missing_quantity=plan.missing_quantity, original_unit=plan.unit, option=option,
            packages=option.packages_orderable, unit_price=option.unit_price,
            total_estimated_cost=option.total_cost, currency=option.currency,
            lead_time_days=option.lead_time_days, warning=_warning(option),
            requires_confirmation=option.requires_confirmation, created_at=store.now())
        state.replacement_orders[order.id] = order.model_dump_json()
        store.audit(state, plan.reconciliation_id, "replacement_order_drafted", order.id)
        return order


def _decide(order_id: str, status: OrderStatus, confirm: bool = False) -> ReplacementOrder:
    with store.transaction() as state:
        payload = state.replacement_orders.get(order_id)
        if payload is None:
            raise OrderNotFound("Replacement order not found")
        order = ReplacementOrder.model_validate_json(payload)
        if order.status != OrderStatus.DRAFT:
            raise OrderConflict(f"Order is already {order.status.value}")
        if status == OrderStatus.APPROVED and order.requires_confirmation and not confirm:
            raise OrderInvalid("This is an AI-assessed substitute; explicit confirmation is required")
        order.status, order.decided_at = status, store.now()
        order.substitution_confirmed = confirm and order.requires_confirmation and status == OrderStatus.APPROVED
        state.replacement_orders[order_id] = order.model_dump_json()
        store.audit(state, order.reconciliation_id, f"replacement_order_{status.value}", order_id)
        return order


def approve_order(order_id: str, confirm_substitution: bool = False) -> ReplacementOrder:
    return _decide(order_id, OrderStatus.APPROVED, confirm_substitution)


def reject_order(order_id: str) -> ReplacementOrder:
    return _decide(order_id, OrderStatus.REJECTED)
