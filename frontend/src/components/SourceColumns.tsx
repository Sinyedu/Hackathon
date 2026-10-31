import type { DocumentKind, Reconciliation } from '../types/reconciliation'

const TITLES: [DocumentKind, string][] = [['purchase_order', 'Ordered'], ['delivery_note', 'Delivered']]

/** The two documents side by side, as read from the scans. Lines behind a discrepancy are marked. */
export default function SourceColumns({ result, onProof }: { result: Reconciliation; onProof: (lineId: string) => void }) {
  const flagged = new Set(result.discrepancies.map((d) => d.catalog_item_id))
  const catalogOf = new Map(result.matches.map((m) => [m.source_line_id, m.catalog_item_id]))
  return (
    <div className="source-columns">
      {TITLES.map(([kind, title]) => {
        const doc = result.documents.find((d) => d.kind === kind)
        const lines = result.line_items.filter((line) => line.source_document_id === doc?.id)
        return (
          <section className="source-col" key={kind} aria-label={title}>
            <header><h3>{title}</h3><span>{doc?.filename ?? 'Waiting for document'}</span></header>
            <ul>
              {lines.map((line) => {
                const off = flagged.has(catalogOf.get(line.id) ?? '')
                return (
                  <li key={line.id} className={off ? 'source-line source-line--off' : 'source-line'}>
                    <button onClick={() => onProof(line.id)} aria-label={`Show ${line.description} on the scan`}>
                      <span>{line.description}</span>
                      <b>{line.quantity} {line.unit}</b>
                    </button>
                  </li>
                )
              })}
              {!lines.length && <li className="source-line source-line--empty">No lines read</li>}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
