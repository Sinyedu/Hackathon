// Mirror of backend/app/schemas/domain.py. Change both together.
// Decimal values arrive as strings; never parse them into floats for money.

export type DocumentKind = 'purchase_order' | 'delivery_note' | 'invoice'
export type MatchStatus = 'matched' | 'needs_review' | 'unmatched'
export type MatchMethod = 'exact' | 'fuzzy' | 'model' | 'manual'
export type ClaimStatus = 'draft' | 'approved'

export interface Document {
  id: string
  kind: DocumentKind
  filename: string
  status: string
}

export interface LineItem {
  id: string
  source_document_id: string
  source_text: string
  description: string
  quantity: string
  unit: string
  unit_price: string | null
  page: number | null
}

export interface Match {
  source_line_id: string
  target_line_id: string | null
  catalog_item_id: string | null
  method: MatchMethod
  score: number | null
  status: MatchStatus
}

export interface Discrepancy {
  catalog_item_id: string
  description: string
  unit: string
  ordered_quantity: string
  delivered_quantity: string
  difference: string
  evidence: string[]
}

export interface Claim {
  id: string
  status: ClaimStatus
  discrepancies: Discrepancy[]
  created_at: string
  approved_at: string | null
}

export interface Reconciliation {
  id: string
  status: string
  documents: Document[]
  line_items: LineItem[]
  matches: Match[]
  discrepancies: Discrepancy[]
  claim: Claim | null
  warnings: string[]
}
