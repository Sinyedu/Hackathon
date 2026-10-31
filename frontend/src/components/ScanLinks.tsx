import { ExternalLink } from 'lucide-react'
import { documentFileUrl } from '../services/api'
import type { Document } from '../types/reconciliation'

const LABELS = { purchase_order: 'Purchase order', delivery_note: 'Delivery note', invoice: 'Invoice' } as const

/** Links to the original uploaded scans (served by the backend; open full size in a new tab). */
export default function ScanLinks({ reconciliationId, documents, label = 'Scans' }: {
  reconciliationId: string
  documents: Document[]
  label?: string
}) {
  if (documents.length === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
      <span className="text-slate-500">{label}:</span>
      {documents.map((d) => (
        <a key={d.id} href={documentFileUrl(reconciliationId, d.id)} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900">
          {LABELS[d.kind]} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ))}
    </p>
  )
}
