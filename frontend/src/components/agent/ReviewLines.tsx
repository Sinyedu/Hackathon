import { useEffect, useState } from 'react'
import { getCatalog } from '../../services/api'
import type { CatalogItem, Reconciliation } from '../../types/reconciliation'

interface Props { result: Reconciliation; busy: boolean; onResolve: (lineId: string, catalogItemId: string | null) => void }

/**
 * Manual review for lines the matcher could not settle (also the path when the local model is
 * offline). The user names the product; nothing is guessed. One line at a time.
 */
export default function ReviewLines({ result, busy, onResolve }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  useEffect(() => { getCatalog().then(setCatalog).catch(() => setCatalog([])) }, [])

  const open = result.matches.filter((m) => m.status !== 'matched' && !(m.status === 'needs_review' && m.catalog_item_id))
  const line = open.length ? result.line_items.find((item) => item.id === open[0].source_line_id) : undefined
  if (!line) return null
  const document = result.documents.find((d) => d.id === line.source_document_id)
  return (
    <section className="review-line" aria-live="polite">
      <h2>Which product is this?{open.length > 1 && <span> {open.length} to check</span>}</h2>
      <p className="review-line__text"><b>{line.description}</b> · {line.quantity} {line.unit}<small>{document?.kind.replace('_', ' ')}</small></p>
      <select aria-label={`Product for ${line.description}`} disabled={busy} defaultValue="" key={line.id}
        onChange={(event) => { const value = event.target.value; if (value) onResolve(line.id, value === 'none' ? null : value) }}>
        <option value="" disabled>Choose a product…</option>
        {catalog.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}
        <option value="none">Not in my catalog</option>
      </select>
    </section>
  )
}
