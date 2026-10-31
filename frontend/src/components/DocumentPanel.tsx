import { CircleAlert, ExternalLink, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { useCorrections } from '../hooks/useCorrections'
import { documentFileUrl } from '../services/api'
import type { CatalogItem, Document, Reconciliation } from '../types/reconciliation'
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
  const needsAttention = lines.some((l) => matches.get(l.id)?.status !== 'matched')
  const [editing, setEditing] = useState(needsAttention)
  const isPdf = doc.filename.toLowerCase().endsWith('.pdf')

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {!isPdf && (
          <a href={url} target="_blank" rel="noreferrer" title="Open the original scan">
            <img src={url} alt={`Scan of ${TITLES[doc.kind]}`} className="h-24 w-20 rounded-lg border bg-slate-100 object-cover object-top" />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{TITLES[doc.kind]}</h3>
          <p className="truncate text-sm text-slate-500">{doc.filename}</p>
          <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 underline underline-offset-2">
            Open original <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        {!disabled && lines.length > 0 && (
          <button onClick={() => setEditing(!editing)} aria-pressed={editing}
            className="flex h-fit items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            <Pencil className="size-3.5" aria-hidden />{editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No lines were read from this document.</p>
      ) : editing && !disabled ? (
        <ul className="mt-3 flex flex-col gap-2">
          {lines.map((line) => (
            <LineRow key={line.id} line={line} match={matches.get(line.id)} catalog={catalog}
              edit={corrections.edits[line.id]} choice={corrections.choices[line.id]}
              invalid={corrections.invalid.has(line.id)} disabled={disabled}
              onField={(f, v) => corrections.setField(line, f, v)} onChoice={(v) => corrections.setChoice(line.id, v)} />
          ))}
        </ul>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-800">
                {matches.get(line.id)?.status !== 'matched' && <CircleAlert className="size-4 shrink-0 text-amber-600" aria-label="Needs review" />}
                <span className="truncate">{line.description}</span>
              </span>
              <span className="shrink-0 font-medium text-slate-900">{line.quantity} {line.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
