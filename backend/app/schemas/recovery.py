"""AutoRecover data contract. Mirrored by frontend/src/types/recovery.ts; change both together.

Money and quantities are Decimal (JSON strings). Nothing here is produced by the language model
except the optional `ai_reason` text and the compatibility classification, both validated.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["cost", "speed"]


class SupplierProduct(BaseModel):
    id: str
    supplier_id: str
    supplier_name: str
    description: str
    category: str
    sale_unit: str
    pack_size: Decimal
    pack_unit: str
    unit_price: Decimal
    currency: str = "DKK"
    available_qty: Decimal
    lead_time_days: int
    available: bool


class Supplier(BaseModel):
    id: str
    name: str
    products: list[SupplierProduct]


class Compatibility(StrEnum):
    EXACT = "exact"  # same product and pack: verified by deterministic rules
    REPACK = "repack"  # same product, different pack size: verified, explicit conversion
    AI_SUBSTITUTE = "ai_substitute"  # model-assessed: always needs human confirmation


class CompatResult(BaseModel):
    """Validated shape of the model's compatibility answer."""

    candidate_id: str | None
    classification: Literal["equivalent", "acceptable_substitute", "incompatible"]
    reason: str = ""
    needs_review: bool = True


class RecoveryOption(BaseModel):
    option_id: str  # = supplier product id (stable across refreshes)
    supplier_id: str
    supplier_name: str
    product_id: str
    description: str
    compatibility: Compatibility
    verified: bool
    requires_confirmation: bool
    compatibility_note: str
    ai_reason: str | None = None
    sale_unit: str
    pack_size: Decimal
    pack_unit: str
    required_amount: Decimal  # shortage expressed in pack_unit
    packages_needed: int
    packages_orderable: int  # limited by supplier stock
    available_qty: Decimal
    fulfills_shortage: bool
    unit_price: Decimal
    currency: str
    total_cost: Decimal  # packages_orderable x unit_price; taxes/shipping not included
    excess_amount: Decimal  # surplus from package-size rounding
    lead_time_days: int
    rank: int = 0
    rank_reasons: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)  # recommended | cheapest | fastest


class ExcludedCandidate(BaseModel):
    supplier_name: str
    description: str
    reason: str


class OrderStatus(StrEnum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReplacementOrder(BaseModel):
    id: str
    plan_id: str
    reconciliation_id: str
    catalog_item_id: str
    original_description: str
    missing_quantity: Decimal
    original_unit: str
    option: RecoveryOption  # snapshot at draft time
    packages: int
    unit_price: Decimal
    total_estimated_cost: Decimal
    currency: str
    lead_time_days: int
    warning: str | None = None
    requires_confirmation: bool
    substitution_confirmed: bool = False
    status: OrderStatus = OrderStatus.DRAFT
    created_at: datetime
    decided_at: datetime | None = None


class RecoveryPlan(BaseModel):
    id: str
    reconciliation_id: str
    catalog_item_id: str
    description: str
    missing_quantity: Decimal
    unit: str
    required_amount: Decimal
    amount_unit: str
    priority: Priority = "cost"
    recommended_option_id: str | None = None
    recommendation_summary: str | None = None
    options: list[RecoveryOption] = Field(default_factory=list)
    excluded: list[ExcludedCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    created_at: datetime
    orders: list[ReplacementOrder] = Field(default_factory=list)


class DraftOrderRequest(BaseModel):
    option_id: str


class DecisionRequest(BaseModel):
    confirm_substitution: bool = False
