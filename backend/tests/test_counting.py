from decimal import Decimal

import pytest

from app.services.counting import calculate


@pytest.mark.parametrize("ordered,noted,counted,shortage,overstated,overdelivery,cents", [
    (24, 24, 24, 0, 0, 0, 0),
    (24, 18, 18, 6, 0, 0, 7500),
    (24, 24, 18, 6, 6, 0, 15000),
    (24, 30, 30, 0, 0, 6, 0),
    (24, 18, None, 6, 0, 0, 7500),
])
def test_count_arithmetic(ordered, noted, counted, shortage, overstated, overdelivery, cents):
    result = calculate(Decimal(ordered), Decimal(noted), Decimal(counted) if counted is not None else None, 1250)
    assert (result.shortage, result.note_overstated, result.over_delivery, result.claim_cents) == (
        shortage, overstated, overdelivery, cents)


def test_price_unknown_is_not_guessed():
    assert calculate(Decimal(24), Decimal(18), None, None).claim_cents is None


def test_negative_count_is_rejected():
    with pytest.raises(ValueError):
        calculate(Decimal(24), Decimal(18), Decimal(-1), 1250)
