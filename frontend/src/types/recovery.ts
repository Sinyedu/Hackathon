// Mirror of backend/app/schemas/recovery.py. Change both together.
// Decimal values arrive as strings.

export type Priority = 'cost' | 'speed'
export type Compatibility = 'exact' | 'repack' | 'ai_substitute'
export type OrderStatus = 'draft' | 'approved' | 'rejected'

export interface RecoveryOption {
  option_id: string
  supplier_id: string
  supplier_name: string
  product_id: string
  description: string
  compatibility: Compatibility
  verified: boolean
  requires_confirmation: boolean
  compatibility_note: string
  ai_reason: string | null
  sale_unit: string
  pack_size: string
  pack_unit: string
  required_amount: string
  packages_needed: number
  packages_orderable: number
  available_qty: string
  fulfills_shortage: boolean
  unit_price: string
  currency: string
  total_cost: string
  excess_amount: string
  lead_time_days: number
  rank: number
  rank_reasons: string[]
  tags: string[]
  buy_url: string
  buy_url_is_search: boolean
}

export interface ExcludedCandidate {
  supplier_name: string
  description: string
  reason: string
}

export interface ReplacementOrder {
  id: string
  plan_id: string
  reconciliation_id: string
  catalog_item_id: string
  original_description: string
  missing_quantity: string
  original_unit: string
  option: RecoveryOption
  packages: number
  unit_price: string
  total_estimated_cost: string
  currency: string
  lead_time_days: number
  warning: string | null
  requires_confirmation: boolean
  substitution_confirmed: boolean
  status: OrderStatus
  created_at: string
  decided_at: string | null
}

export interface RecoveryPlan {
  id: string
  reconciliation_id: string
  catalog_item_id: string
  description: string
  missing_quantity: string
  unit: string
  required_amount: string
  amount_unit: string
  priority: Priority
  recommended_option_id: string | null
  recommendation_summary: string | null
  options: RecoveryOption[]
  excluded: ExcludedCandidate[]
  warnings: string[]
  created_at: string
  orders: ReplacementOrder[]
}
