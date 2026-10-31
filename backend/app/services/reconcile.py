"""Owner: backend. Pure deterministic functions. No LLM arithmetic, no I/O.

Only confirmed (status=matched) matches are reconciled. Anything uncertain is reported back as
unresolved so the caller can send it to manual review; it is never silently counted or ignored.
"""

from collections import defaultdict
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.domain import CatalogItem, Discrepancy, LineItem, Match, MatchStatus
from app.services.match import normalize_unit


class ReconcileError(ValueError):
    """Raised for inconsistent input (e.g. a match pointing at an item not in the catalog)."""


class ReconcileResult(BaseModel):
    discrepancies: list[Discrepancy] = Field(default_factory=list)
    unresolved_line_ids: list[str] = Field(default_factory=list)  # need manual review
    warnings: list[str] = Field(default_factory=list)  # surfaced to the user, e.g. unit mismatch


def _evidence(line: LineItem) -> str:
    return f"{line.source_document_id}: {line.source_text} (qty {line.quantity} {line.unit})".strip()


def _confirmed_item_ids(lines: list[LineItem], matches: dict[str, Match],
                        catalog: dict[str, CatalogItem]) -> tuple[dict[str, list[LineItem]], list[str]]:
    """Group lines by confirmed catalog item; return (groups, unresolved line ids)."""
    groups: dict[str, list[LineItem]] = defaultdict(list)
    unresolved: list[str] = []
    for line in lines:
        match = matches.get(line.id)
        if match is None or match.status != MatchStatus.MATCHED or match.catalog_item_id is None:
            unresolved.append(line.id)
        elif match.catalog_item_id not in catalog:
            raise ReconcileError(f"Match for {line.id} points at unknown item {match.catalog_item_id!r}")
        else:
            groups[match.catalog_item_id].append(line)
    return groups, unresolved


def compute_discrepancies(
    ordered: list[LineItem],
    delivered: list[LineItem],
    matches: list[Match],
    catalog: list[CatalogItem],
) -> ReconcileResult:
    """Compare ordered vs delivered quantities per catalog item using Decimal.

    difference = delivered - ordered (negative = shortage). Units are never converted: an item whose
    lines use different units is reported as a warning instead of a discrepancy.
    """
    by_line: dict[str, Match] = {}
    for m in matches:
        if m.source_line_id in by_line:
            raise ReconcileError(f"Duplicate match for line {m.source_line_id}")
        by_line[m.source_line_id] = m
    items = {c.id: c for c in catalog}

    ordered_by_item, ordered_unresolved = _confirmed_item_ids(ordered, by_line, items)
    delivered_by_item, delivered_unresolved = _confirmed_item_ids(delivered, by_line, items)
    result = ReconcileResult(unresolved_line_ids=ordered_unresolved + delivered_unresolved)

    for item_id, item in items.items():  # catalog order keeps output deterministic
        o_lines, d_lines = ordered_by_item.get(item_id, []), delivered_by_item.get(item_id, [])
        if not o_lines and not d_lines:
            continue
        units = {normalize_unit(line.unit) for line in o_lines + d_lines}
        if len(units) > 1:
            result.warnings.append(
                f"{item.description}: ordered and delivered units differ "
                f"({', '.join(sorted(units))}); not converted, needs review"
            )
            continue
        # One-sided item while the other side has unreviewed lines: they may be the same product.
        if (not d_lines and delivered_unresolved) or (not o_lines and ordered_unresolved):
            result.warnings.append(f"{item.description}: other document has unresolved lines; needs review")
            continue

        ordered_qty = sum((line.quantity for line in o_lines), Decimal(0))
        delivered_qty = sum((line.quantity for line in d_lines), Decimal(0))
        if ordered_qty == delivered_qty:
            continue
        result.discrepancies.append(Discrepancy(
            catalog_item_id=item_id,
            description=item.description,
            unit=item.unit,
            ordered_quantity=ordered_qty,
            delivered_quantity=delivered_qty,
            difference=delivered_qty - ordered_qty,
            evidence=[_evidence(line) for line in o_lines + d_lines],
        ))

    if result.unresolved_line_ids:
        result.warnings.append(f"{len(result.unresolved_line_ids)} line(s) not confirmed; excluded from totals")
    return result
