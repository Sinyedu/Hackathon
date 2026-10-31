import type { Reconciliation } from '../types/reconciliation'

/** Synthetic "Missing Tomatoes" result: 24 ordered, 18 delivered, plus one line that still needs review. */
export function makeReconciliation(overrides: Partial<Reconciliation> = {}): Reconciliation {
  const line = (id: string, doc: string, description: string, quantity: string) => ({
    id, source_document_id: doc, source_text: `${doc}: ${description} ${quantity}`, description, quantity,
    unit: 'case', unit_price: null, page: 1, bbox: null, corrected: false,
  })
  return {
    id: 'rec-1',
    status: 'ready',
    documents: [
      { id: 'po', kind: 'purchase_order', filename: 'purchase_order.png', status: 'extracted' },
      { id: 'dn', kind: 'delivery_note', filename: 'delivery_note.png', status: 'extracted' },
    ],
    line_items: [
      line('l1', 'po', 'Tomatoes, case 5 kg', '24'),
      line('l2', 'dn', 'Tomato Box 5KG', '18'),
    ],
    matches: [
      { source_line_id: 'l1', target_line_id: null, catalog_item_id: 'tomato', method: 'exact', score: 1, status: 'matched' },
      { source_line_id: 'l2', target_line_id: 'l1', catalog_item_id: 'tomato', method: 'model', score: null, status: 'matched' },
    ],
    discrepancies: [{
      catalog_item_id: 'tomato', description: 'Tomatoes, case 5 kg', unit: 'case',
      ordered_quantity: '24', delivered_quantity: '18', difference: '-6',
      evidence: ['po: Tomatoes, case 5 kg 24', 'dn: Tomato Box 5KG 18'],
    }],
    claim: null,
    warnings: [],
    ...overrides,
  }
}
