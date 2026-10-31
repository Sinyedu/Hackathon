"""Owner: backend. Pure deterministic functions. No LLM arithmetic, no I/O."""

from app.schemas.domain import CatalogItem, Discrepancy, LineItem, Match


def compute_discrepancies(
    ordered: list[LineItem],
    delivered: list[LineItem],
    matches: list[Match],
    catalog: list[CatalogItem],
) -> list[Discrepancy]:
    """Compare ordered vs delivered quantities per catalog item using Decimal.
    Flag unit mismatches instead of converting; skip unconfirmed matches."""
    raise NotImplementedError
