"""AutoRecover orchestration: shortage, candidates, options, process-local plan."""

import uuid

from app.schemas.domain import CatalogItem
from app.schemas.recovery import (
    Compatibility,
    ExcludedCandidate,
    Priority,
    RecoveryOption,
    RecoveryPlan,
    ReplacementOrder,
)
from app.services import compat, ollama, store, suppliers
from app.services.catalog import load_catalog
from app.services.recovery_engine import make_option, rank_options, required_amount

MAX_MODEL_CHECKS = 5  # bound inference work per plan


class RecoveryError(Exception):
    pass


class RecoveryNotFound(RecoveryError):
    pass


class RecoveryInvalid(RecoveryError):
    pass


def _load_orders(state: store.SessionStore, plan_id: str) -> list[ReplacementOrder]:
    orders = [ReplacementOrder.model_validate_json(payload) for payload in state.replacement_orders.values()]
    return sorted((order for order in orders if order.plan_id == plan_id), key=lambda order: (order.created_at, order.id))


def _plan_from_payload(state: store.SessionStore, payload: str | None) -> RecoveryPlan | None:
    if payload is None:
        return None
    plan = RecoveryPlan.model_validate_json(payload)
    plan.orders = _load_orders(state, plan.id)
    return plan


def get_plan(plan_id: str) -> RecoveryPlan | None:
    with store.transaction() as state:
        return _plan_from_payload(state, state.recovery_plans.get(plan_id))


def get_plan_for(reconciliation_id: str, catalog_item_id: str) -> RecoveryPlan | None:
    with store.transaction() as state:
        for payload in state.recovery_plans.values():
            plan = RecoveryPlan.model_validate_json(payload)
            if plan.reconciliation_id == reconciliation_id and plan.catalog_item_id == catalog_item_id:
                plan.orders = _load_orders(state, plan.id)
                return plan
    return None


def get_plans_for_all(reconciliation_id: str) -> list[RecoveryPlan]:
    with store.transaction() as state:
        plans = [RecoveryPlan.model_validate_json(p) for p in state.recovery_plans.values()]
        plans = [p for p in plans if p.reconciliation_id == reconciliation_id]
        for plan in plans:
            plan.orders = _load_orders(state, plan.id)
        return plans


async def _evaluate(original: CatalogItem, required) -> tuple[list[RecoveryOption], list[ExcludedCandidate], list[str]]:
    options: list[RecoveryOption] = []
    excluded: list[ExcludedCandidate] = []
    warnings: list[str] = []
    model_checks = 0
    for product in suppliers.list_products():
        verdict = compat.classify(original, product)
        skip = lambda reason: excluded.append(  # noqa: E731
            ExcludedCandidate(supplier_name=product.supplier_name, description=product.description, reason=reason))
        if verdict.kind == "reject":
            skip(verdict.note)
            continue
        if not product.available or product.available_qty <= 0:
            skip("Compatible, but marked unavailable or out of stock")
            continue
        if verdict.kind == "ambiguous":
            if model_checks >= MAX_MODEL_CHECKS:
                skip("Not evaluated: too many ambiguous candidates")
                continue
            model_checks += 1
            try:
                result = await compat.assess_with_model(original, product)
            except (ollama.OllamaError, ValueError) as exc:
                skip("Could not be evaluated by the model")
                warnings.append(f"AI compatibility check unavailable for {product.description} "
                                f"({'model unavailable' if isinstance(exc, ollama.OllamaError) else 'invalid model answer'})")
                continue
            if result.classification == "incompatible":
                skip(f"AI judged it incompatible: {result.reason}".strip())
                continue
            options.append(make_option(product, Compatibility.AI_SUBSTITUTE,
                                       f"AI-assessed {result.classification.replace('_', ' ')}: confirm before ordering",
                                       required, ai_reason=result.reason))
        else:
            options.append(make_option(product, Compatibility(verdict.kind), verdict.note, required))
    return options, excluded, warnings


def _summary(options: list[RecoveryOption]) -> str | None:
    if not options or not options[0].fulfills_shortage:
        return None
    return ". ".join(options[0].rank_reasons) + "."


async def recover(reconciliation_id: str, catalog_item_id: str, priority: Priority = "cost") -> RecoveryPlan:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None:
        raise RecoveryNotFound("Reconciliation not found")
    discrepancy = next((d for d in rec.discrepancies if d.catalog_item_id == catalog_item_id), None)
    if discrepancy is None:
        raise RecoveryNotFound("Discrepancy not found")
    if discrepancy.difference >= 0:
        raise RecoveryInvalid("Only shortages can be recovered; this is not a shortage")
    original = next((c for c in load_catalog() if c.id == catalog_item_id), None)
    if original is None or original.pack_size is None:
        raise RecoveryInvalid("The ordered product has no known package size; cannot convert safely")

    missing = -discrepancy.difference
    required = required_amount(missing, original)
    options, excluded, warnings = await _evaluate(original, required)
    ranked = rank_options(options, priority)
    if not ranked:
        warnings.append("No compatible supplier product is available for this shortage")
    elif not ranked[0].fulfills_shortage:
        warnings.append("No single supplier can cover the full shortage")

    with store.transaction() as state:
        existing = None
        for value in state.recovery_plans.values():
            candidate = RecoveryPlan.model_validate_json(value)
            if candidate.reconciliation_id == reconciliation_id and candidate.catalog_item_id == catalog_item_id:
                existing = candidate
                break
        plan = RecoveryPlan(
            id=existing.id if existing else f"RP-{uuid.uuid4().hex[:10]}",
            reconciliation_id=reconciliation_id, catalog_item_id=catalog_item_id,
            description=discrepancy.description, missing_quantity=missing, unit=discrepancy.unit,
            required_amount=required, amount_unit=original.pack_unit or "", priority=priority,
            recommended_option_id=ranked[0].option_id if ranked and ranked[0].fulfills_shortage else None,
            recommendation_summary=_summary(ranked), options=ranked, excluded=excluded,
            warnings=warnings, created_at=store.now())
        state.recovery_plans[plan.id] = plan.model_dump_json()
        store.audit(state, reconciliation_id, "recovery_planned", f"{plan.id} {priority} options={len(ranked)}")
        plan.orders = _load_orders(state, plan.id)
    return plan
