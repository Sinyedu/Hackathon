import { FileText } from 'lucide-react'
import { documentFileUrl } from '../services/api'
import type { CatalogItem, Document, Reconciliation } from '../types/reconciliation'
import type { useCorrections } from '../hooks/useCorrections'
import LineRow from './LineRow'

const TITLES = { purchase_order: 'Purchase order', delivery_note: 'Delivery note', invoice: 'Invoice' } as const

interface Props {
  rec: Reconciliation
  doc: Document
  catalog: CatalogItem[]
  corrections: ReturnType<typeof useCorrections>
  disabled: boolean
}

export default function DocumentPanel({ rec, doc, catalog, corrections, disabled }: Props) {
  const url = documentFileUrl(rec.id, doc.id)
  const lines = rec.line_items.filter((l) => l.source_document_id === doc.id)
  const matches = new Map(rec.matches.map((m) => [m.source_line_id, m]))
  const isPdf = doc.filename.toLowerCase().endsWith('.pdf')

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">{TITLES[doc.kind]}</h3>
      <p className="mb-3 truncate text-sm text-slate-500">{doc.filename}</p>
      {isPdf ? (
        <a href={url} target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-2 text-indigo-700 underline">
          <FileText className="size-5" aria-hidden /> Open original PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
          <img src={url} alt={`Scan of ${TITLES[doc.kind]}`} className="mb-3 max-h-64 w-full rounded-lg border bg-slate-100 object-contain" />
        </a>
      )}
      {lines.length === 0 ? (
        <p className="text-sm text-slate-500">No lines were read from this document.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <LineRow key={line.id} line={line} match={matches.get(line.id)} catalog={catalog}
              edit={corrections.edits[line.id]} choice={corrections.choices[line.id]}
              invalid={corrections.invalid.has(line.id)} disabled={disabled}
              onField={(f, v) => corrections.setField(line, f, v)}
              onChoice={(v) => corrections.setChoice(line.id, v)} />
          ))}
        </ul>
      )}
    </section>
  )
}
