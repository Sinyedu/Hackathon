import type { LineItem, Reconciliation } from '../types/reconciliation'

// Pairs the purchase-order and delivery-note lines for display. Nothing is recomputed here:
// status and differences come from the backend's matches and discrepancies.

export type RowStatus = 'ok' | 'short' | 'over' | 'missing' | 'extra' | 'review'
export interface CompareRow {
  key: string
  po: LineItem | null
  dn: LineItem | null
  status: RowStatus
  note: string
  /** Words both descriptions share (lowercased, singular), highlighted in the UI. */
  shared: Set<string>
}
export interface CompareSummary { ok: number; bad: number; review: number }

const WORD = /[\p{L}\p{N}]+/gu
const stem = (word: string) => {
  const lower = word.toLowerCase()
  return lower.length > 3 ? lower.replace(/(es|s)$/, '') : lower
}
export const wordsOf = (text: string) => (text.match(WORD) ?? []).map(stem)
export const isBad = (status: RowStatus) => status !== 'ok' && status !== 'review'

function sharedWords(a: LineItem | null, b: LineItem | null): Set<string> {
  if (!a || !b) return new Set()
  const other = new Set(wordsOf(b.description))
  return new Set(wordsOf(a.description).filter((word) => other.has(word)))
}

export function buildRows(rec: Reconciliation): CompareRow[] {
  const kindOf = new Map(rec.documents.map((d) => [d.id, d.kind]))
  const matchOf = new Map(rec.matches.map((m) => [m.source_line_id, m]))
  const catalogId = (line: LineItem) => {
    const match = matchOf.get(line.id)
    return match?.status === 'matched' ? match.catalog_item_id : null
  }
  const pos = rec.line_items.filter((l) => kindOf.get(l.source_document_id) === 'purchase_order')
  const dns = rec.line_items.filter((l) => kindOf.get(l.source_document_id) === 'delivery_note')
  const unresolved = (lines: LineItem[]) => lines.some((l) => !catalogId(l))
  const poWaiting = unresolved(pos)
  const dnWaiting = unresolved(dns)

  const used = new Set<string>()
  const rows: CompareRow[] = []
  const row = (po: LineItem | null, dn: LineItem | null): CompareRow => {
    const line = po ?? dn!
    const id = catalogId(line)
    const base = { key: line.id, po, dn, shared: sharedWords(po, dn) }
    if (!id) return { ...base, status: 'review', note: 'Needs a product match' }
    if (po && dn) {
      const found = rec.discrepancies.find((d) => d.catalog_item_id === id)
      if (!found) return { ...base, status: 'ok', note: 'Matches' }
      const gap = found.difference.replace(/^[-+]/, '')
      return found.difference.startsWith('-')
        ? { ...base, status: 'short', note: `Short ${gap} ${found.unit}` }
        : { ...base, status: 'over', note: `${gap} ${found.unit} extra` }
    }
    if (po) return dnWaiting ? { ...base, status: 'review', note: 'Waiting for a product match' } : { ...base, status: 'missing', note: 'Not on the delivery note' }
    return poWaiting ? { ...base, status: 'review', note: 'Waiting for a product match' } : { ...base, status: 'extra', note: 'Not on the purchase order' }
  }
  for (const po of pos) {
    const id = catalogId(po)
    const dn = id ? dns.find((d) => !used.has(d.id) && catalogId(d) === id) ?? null : null
    if (dn) used.add(dn.id)
    rows.push(row(po, dn))
  }
  for (const dn of dns) if (!used.has(dn.id)) rows.push(row(null, dn))
  return rows
}

export function summarise(rows: CompareRow[]): CompareSummary {
  return {
    ok: rows.filter((r) => r.status === 'ok').length,
    bad: rows.filter((r) => isBad(r.status)).length,
    review: rows.filter((r) => r.status === 'review').length,
  }
}
