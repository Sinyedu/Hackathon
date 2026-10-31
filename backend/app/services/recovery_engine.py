"""Owner: backend. Pure deterministic recovery maths and ranking. No LLM, no I/O.

All money/quantity values are Decimal. Package conversion happens only between identical
measures (kg->kg, l->l, pcs->pcs); anything else is rejected upstream by compat.classify.
"""

from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
from urllib.parse import quote_plus

from app.schemas.domain import CatalogItem
from app.schemas.recovery import Compatibility, Priority, RecoveryOption, SupplierProduct

CENT = Decimal("0.01")


def required_amount(missing_quantity: Decimal, original: CatalogItem) -> Decimal:
    """Shortage in measure units, e.g. 6 cases x 5 kg = 30 kg."""
    if original.pack_size is None:
        raise ValueError("Original package size is unknown")
    return missing_quantity * original.pack_size


def buy_link(candidate: SupplierProduct) -> tuple[str, bool]:
    """The supplier's page when the catalog has one; otherwise a live web search for the product.
    The demo catalog is synthetic, so a search is the honest way to reach real offers."""
    if candidate.url:
        return candidate.url, False
    pack = f"{candidate.pack_size.normalize():f}"
    query = " ".join(filter(None, [candidate.description, "" if pack in candidate.description else f"{pack} {candidate.pack_unit}", "wholesale"]))
    return f"https://www.google.com/search?q={quote_plus(query)}", True


def make_option(candidate: SupplierProduct, compatibility: Compatibility, note: str,
                required: Decimal, ai_reason: str | None = None) -> RecoveryOption:
    needed = int((required / candidate.pack_size).to_integral_value(rounding=ROUND_CEILING))
    in_stock = int(candidate.available_qty.to_integral_value(rounding=ROUND_FLOOR))
    orderable = min(needed, in_stock)
    fulfills = orderable >= needed
    covered = candidate.pack_size * orderable
    verified = compatibility != Compatibility.AI_SUBSTITUTE
    url, is_search = buy_link(candidate)
    return RecoveryOption(
        option_id=candidate.id, supplier_id=candidate.supplier_id, supplier_name=candidate.supplier_name,
        product_id=candidate.id, description=candidate.description, compatibility=compatibility,
        verified=verified, requires_confirmation=not verified, compatibility_note=note, ai_reason=ai_reason,
        sale_unit=candidate.sale_unit, pack_size=candidate.pack_size, pack_unit=candidate.pack_unit,
        required_amount=required, packages_needed=needed, packages_orderable=orderable,
        available_qty=candidate.available_qty, fulfills_shortage=fulfills, unit_price=candidate.unit_price,
        currency=candidate.currency, total_cost=(candidate.unit_price * orderable).quantize(CENT),
        excess_amount=max(covered - required, Decimal(0)) if fulfills else Decimal(0),
        lead_time_days=candidate.lead_time_days, buy_url=url, buy_url_is_search=is_search)


def _sort_key(option: RecoveryOption, priority: Priority) -> tuple:
    # Complete fulfilment first, verified compatibility before AI-assessed, then the user's priority.
    primary = (option.total_cost, option.lead_time_days) if priority == "cost" else (
        option.lead_time_days, option.total_cost)
    return (not option.fulfills_shortage, option.requires_confirmation, *primary,
            option.supplier_name, option.option_id)


def rank_options(options: list[RecoveryOption], priority: Priority) -> list[RecoveryOption]:
    """Sort by the transparent rule above and attach the facts that justify each position."""
    ordered = sorted(options, key=lambda o: _sort_key(o, priority))
    complete = [o for o in ordered if o.fulfills_shortage]
    cheapest = min((o.total_cost for o in complete), default=None)
    fastest = min((o.lead_time_days for o in complete), default=None)
    for position, o in enumerate(ordered, start=1):
        o.rank = position
        reasons = []
        if o.fulfills_shortage:
            reasons.append(f"Covers the full shortage ({o.packages_needed} x {o.pack_size} {o.pack_unit})")
        else:
            reasons.append(f"Partial only: {o.packages_orderable} of {o.packages_needed} packages in stock")
        reasons.append({
            Compatibility.EXACT: "Verified exact product match",
            Compatibility.REPACK: "Verified same product, repackaged",
            Compatibility.AI_SUBSTITUTE: "AI-assessed substitute, needs your confirmation",
        }[o.compatibility])
        if o.fulfills_shortage and o.total_cost == cheapest:
            o.tags.append("cheapest")
            reasons.append(f"Lowest total cost among complete options ({o.total_cost} {o.currency})")
        if o.fulfills_shortage and o.lead_time_days == fastest:
            o.tags.append("fastest")
            reasons.append(f"Fastest among complete options ({o.lead_time_days} day(s))")
        if o.excess_amount > 0:
            reasons.append(f"Surplus of {o.excess_amount} {o.pack_unit} from package rounding")
        o.rank_reasons = reasons
    if ordered and ordered[0].fulfills_shortage:
        ordered[0].tags.insert(0, "recommended")
    return ordered
