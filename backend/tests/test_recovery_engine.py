from decimal import Decimal

import pytest

from app.schemas.domain import CatalogItem
from app.schemas.recovery import Compatibility, SupplierProduct
from app.services.compat import classify, core_tokens
from app.services.recovery_engine import make_option, rank_options, required_amount

ORIGINAL = CatalogItem(id="P001", description="Tomatoes, case 5 kg", unit="case",
                       category="produce", pack_size=Decimal(5), pack_unit="kg")


def product(id="X", description="Tomatoes, 5 kg case", sale_unit="case", pack="5", unit="kg", price="95",
            stock="20", lead=1, available=True, category="produce", supplier="S") -> SupplierProduct:
    return SupplierProduct(id=id, supplier_id=supplier.lower(), supplier_name=supplier, description=description,
                           category=category, sale_unit=sale_unit, pack_size=Decimal(pack), pack_unit=unit,
                           unit_price=Decimal(price), available_qty=Decimal(stock), lead_time_days=lead,
                           available=available)


def option(p: SupplierProduct, required: str = "30", kind=Compatibility.EXACT):
    return make_option(p, kind, "note", Decimal(required))


def test_core_tokens_ignore_pack_words_numbers_and_filler() -> None:
    assert core_tokens("Tomatoes, case 5 kg") == core_tokens("Tomato Box 5KG") == core_tokens("Fresh Tomatoes, 10 kg box")


def test_exact_match_is_verified() -> None:
    assert classify(ORIGINAL, product(description="Tomato Box 5KG", sale_unit="box")).kind == "exact"


def test_different_product_is_rejected_even_with_identical_pack() -> None:
    assert classify(ORIGINAL, product(description="Potatoes, 5 kg case")).kind == "reject"


def test_compatible_package_conversion_is_a_verified_repack() -> None:
    v = classify(ORIGINAL, product(description="Fresh Tomatoes, 10 kg box", sale_unit="box", pack="10"))
    assert v.kind == "repack" and "10 kg" in v.note


def test_incompatible_measure_is_not_converted() -> None:
    v = classify(ORIGINAL, product(description="Tomatoes, tray of 24 pieces", pack="24", unit="pcs"))
    assert v.kind == "reject" and "no conversion" in v.note


def test_related_product_is_ambiguous_and_wrong_category_rejected() -> None:
    assert classify(ORIGINAL, product(description="Cherry tomatoes, 5 kg case")).kind == "ambiguous"
    assert classify(ORIGINAL, product(category="pantry")).kind == "reject"


def test_unknown_original_pack_rejects_everything() -> None:
    bare = CatalogItem(id="P1", description="Tomatoes", unit="case")
    assert classify(bare, product()).kind == "reject"


def test_decimal_costs_for_the_spec_example() -> None:
    assert required_amount(Decimal(6), ORIGINAL) == Decimal(30)
    a = option(product(price="95", pack="5"))
    b = option(product(description="Fresh Tomatoes, 10 kg box", sale_unit="box", pack="10", price="180"),
               kind=Compatibility.REPACK)
    assert (a.packages_needed, a.total_cost) == (6, Decimal("570.00"))
    assert (b.packages_needed, b.total_cost, b.excess_amount) == (3, Decimal("540.00"), Decimal(0))


def test_package_rounding_creates_excess() -> None:
    o = option(product(pack="10", price="180"), required="32")
    assert (o.packages_needed, o.excess_amount, o.total_cost) == (4, Decimal(8), Decimal("720.00"))


def test_money_stays_exact_with_cents() -> None:
    o = option(product(price="0.10", pack="1"), required="3")
    assert o.total_cost == Decimal("0.30")


def test_insufficient_stock_is_partial_not_fulfilling() -> None:
    o = option(product(stock="4"))
    assert (o.fulfills_shortage, o.packages_orderable, o.packages_needed) == (False, 4, 6)
    assert o.excess_amount == 0


def test_complete_options_outrank_partial_even_if_partial_is_cheaper() -> None:
    cheap_partial = option(product(id="A", price="10", stock="1", supplier="A"))
    complete = option(product(id="B", price="95", supplier="B"))
    ranked = rank_options([cheap_partial, complete], "cost")
    assert [o.option_id for o in ranked] == ["B", "A"] and ranked[0].tags[0] == "recommended"
    assert "recommended" not in ranked[1].tags


def test_cheapest_vs_fastest_priority_changes_the_order() -> None:
    cheap_slow = option(product(id="SLOW", price="80", lead=3, supplier="Slow"))
    fast_pricey = option(product(id="FAST", price="110", lead=0, supplier="Fast"))
    by_cost = rank_options([cheap_slow, fast_pricey], "cost")
    by_speed = rank_options([cheap_slow, fast_pricey], "speed")
    assert by_cost[0].option_id == "SLOW" and by_speed[0].option_id == "FAST"
    assert {"cheapest"} <= set(by_cost[0].tags) and {"fastest"} <= set(by_cost[1].tags)


def test_verified_beats_ai_substitute_even_when_cheaper() -> None:
    verified = option(product(id="V", price="120", supplier="V"))
    ai = make_option(product(id="AI", price="50", supplier="AI"), Compatibility.AI_SUBSTITUTE, "n", Decimal(30), "ok")
    assert [o.option_id for o in rank_options([ai, verified], "cost")] == ["V", "AI"]
    assert ai.requires_confirmation and not ai.verified


def test_rank_reasons_are_derived_from_the_data() -> None:
    ranked = rank_options([option(product(price="95", lead=0))], "cost")
    reasons = ranked[0].rank_reasons
    assert any("Covers the full shortage (6 x 5 kg)" in r for r in reasons)
    assert any("Lowest total cost" in r for r in reasons) and any("Fastest" in r for r in reasons)


@pytest.mark.parametrize("stock,expected", [("6", True), ("5.9", False)])
def test_stock_is_floored_to_whole_packages(stock, expected) -> None:
    assert option(product(stock=stock)).fulfills_shortage is expected
