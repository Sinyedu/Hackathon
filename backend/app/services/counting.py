"""Pallet count arithmetic; no model output enters this module."""

from decimal import Decimal

from pydantic import BaseModel


class CountVerdict(BaseModel):
    ordered: Decimal
    noted: Decimal
    counted: Decimal | None
    received: Decimal
    shortage: Decimal
    note_overstated: Decimal
    over_delivery: Decimal
    claim_cents: int | None


def calculate(ordered: Decimal, noted: Decimal, counted: Decimal | None,
              unit_price_cents: int | None) -> CountVerdict:
    if ordered < 0 or noted < 0 or (counted is not None and counted < 0):
        raise ValueError("Quantities cannot be negative")
    received = counted if counted is not None else noted
    shortage = max(ordered - received, Decimal(0))
    note_overstated = max(noted - counted, Decimal(0)) if counted is not None else Decimal(0)
    over_delivery = max(received - ordered, Decimal(0))
    cents = None
    if unit_price_cents is not None:
        value = (shortage + note_overstated) * unit_price_cents
        if value != value.to_integral_value():
            raise ValueError("Claim amount is not whole cents")
        cents = int(value)
    return CountVerdict(ordered=ordered, noted=noted, counted=counted,
                        received=received, shortage=shortage,
                        note_overstated=note_overstated, over_delivery=over_delivery,
                        claim_cents=cents)
