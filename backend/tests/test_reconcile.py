from decimal import Decimal

import pytest

from app.schemas.domain import CatalogItem, LineItem, Match, MatchMethod, MatchStatus
from app.services.reconcile import ReconcileError, compute_discrepancies

CATALOG = [
    CatalogItem(id="P001", description="Tomatoes, case 5 kg", unit="case"),
    CatalogItem(id="P002", description="Potatoes, sack 10 kg", unit="sack"),
]


def line(id: str, doc: str, text: str, qty: str, unit: str) -> LineItem:
    return LineItem(id=id, source_document_id=doc, source_text=text, description=text,
                    quantity=Decimal(qty), unit=unit)


def match(line_id: str, item: str | None, status: MatchStatus = MatchStatus.MATCHED) -> Match:
    return Match(source_line_id=line_id, catalog_item_id=item, method=MatchMethod.EXACT, status=status)


def test_shortage_detected_with_evidence() -> None:
    po, dn = [line("po1", "PO", "Tomatoes, case 5 kg", "24", "case")], [line("dn1", "DN", "Tomato Box 5KG", "18", "box")]
    r = compute_discrepancies(po, dn, [match("po1", "P001"), match("dn1", "P001")], CATALOG)
    d = r.discrepancies[0]
    assert (d.ordered_quantity, d.delivered_quantity, d.difference) == (Decimal(24), Decimal(18), Decimal(-6))
    assert any("Tomato Box 5KG" in e for e in d.evidence) and any("Tomatoes, case 5 kg" in e for e in d.evidence)
    assert not r.warnings


def test_equal_quantities_produce_no_discrepancy() -> None:
    po, dn = [line("po1", "PO", "T", "24", "case")], [line("dn1", "DN", "T", "24", "case")]
    assert compute_discrepancies(po, dn, [match("po1", "P001"), match("dn1", "P001")], CATALOG).discrepancies == []


def test_over_delivery_is_positive_difference() -> None:
    po, dn = [line("po1", "PO", "T", "10", "case")], [line("dn1", "DN", "T", "12", "case")]
    r = compute_discrepancies(po, dn, [match("po1", "P001"), match("dn1", "P001")], CATALOG)
    assert r.discrepancies[0].difference == Decimal(2)


def test_duplicate_lines_are_summed_exactly() -> None:
    po = [line("po1", "PO", "T", "0.1", "case"), line("po2", "PO", "T", "0.2", "case")]
    dn = [line("dn1", "DN", "T", "0.3", "case")]
    ms = [match("po1", "P001"), match("po2", "P001"), match("dn1", "P001")]
    assert compute_discrepancies(po, dn, ms, CATALOG).discrepancies == []  # no float rounding


def test_unmatched_line_is_not_silently_reconciled() -> None:
    po, dn = [line("po1", "PO", "T", "24", "case")], [line("dn1", "DN", "Mystery", "18", "case")]
    ms = [match("po1", "P001"), match("dn1", None, MatchStatus.NEEDS_REVIEW)]
    r = compute_discrepancies(po, dn, ms, CATALOG)
    assert r.discrepancies == []  # no false "full shortage" claim
    assert r.unresolved_line_ids == ["dn1"]
    assert any("unresolved" in w for w in r.warnings)


def test_missing_match_counts_as_unresolved() -> None:
    r = compute_discrepancies([line("po1", "PO", "T", "5", "case")], [], [], CATALOG)
    assert r.unresolved_line_ids == ["po1"] and r.discrepancies == []


def test_unit_mismatch_is_flagged_not_converted() -> None:
    po, dn = [line("po1", "PO", "T", "24", "case")], [line("dn1", "DN", "T", "120", "kg")]
    r = compute_discrepancies(po, dn, [match("po1", "P001"), match("dn1", "P001")], CATALOG)
    assert r.discrepancies == [] and any("units differ" in w for w in r.warnings)


def test_unit_synonyms_are_the_same_unit() -> None:
    po, dn = [line("po1", "PO", "T", "24", "case")], [line("dn1", "DN", "T", "18", "box")]
    r = compute_discrepancies(po, dn, [match("po1", "P001"), match("dn1", "P001")], CATALOG)
    assert r.discrepancies[0].difference == Decimal(-6)


def test_item_ordered_but_not_delivered_is_full_shortage() -> None:
    r = compute_discrepancies([line("po1", "PO", "Potatoes", "10", "sack")], [], [match("po1", "P002")], CATALOG)
    assert r.discrepancies[0].delivered_quantity == 0 and r.discrepancies[0].difference == Decimal(-10)


def test_unknown_catalog_id_raises() -> None:
    with pytest.raises(ReconcileError):
        compute_discrepancies([line("po1", "PO", "T", "1", "case")], [], [match("po1", "P999")], CATALOG)


def test_duplicate_match_raises() -> None:
    with pytest.raises(ReconcileError):
        compute_discrepancies([], [], [match("po1", "P001"), match("po1", "P002")], CATALOG)
