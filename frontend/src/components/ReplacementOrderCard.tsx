import { useState } from 'react'
import type { Document } from '../types/reconciliation'
import type { ReplacementOrder } from '../types/recovery'
import ScanLinks from './ScanLinks'

const STATUS = {
  draft: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-slate-200 text-slate-700',
} as const

interface Props {
  order: ReplacementOrder
  documents: Document[]
  busy: boolean
  onDecide: (decision: 'approve' | 'reject', confirm: boolean) => void
}

export default function ReplacementOrderCard({ order: o, documents, busy, onDecide }: Props) {
  const [confirmed, setConfirmed] = useState(false)
  const draft = o.status === 'draft'
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Replacement order</h3>
        <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS[o.status]}`}>{o.status}</span>
      </div>
      <p className="mt-2 text-slate-800">{o.packages} × {o.option.pack_size} {o.option.pack_unit} from <strong>{o.option.supplier_name}</strong></p>
      <p className="text-sm text-slate-600">
        Replaces {o.missing_quantity} {o.original_unit} of {o.original_description} · est. {o.total_estimated_cost} {o.currency} (excl. tax/shipping) · {o.lead_time_days} day(s)
      </p>
      {o.warning && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{o.warning}</p>}
      <div className="mt-3"><ScanLinks reconciliationId={o.reconciliation_id} documents={documents} label="Based on" /></div>
      {draft ? (
        <div className="mt-4 flex flex-col gap-2">
          {o.requires_confirmation && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
              I have checked that this substitute is acceptable.
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={() => onDecide('approve', confirmed)} disabled={busy || (o.requires_confirmation && !confirmed)}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white disabled:bg-slate-300">Approve draft</button>
            <button onClick={() => onDecide('reject', false)} disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 disabled:opacity-50">Reject</button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{o.status === 'approved' ? 'Approved' : 'Rejected'} internally{o.decided_at ? ` on ${new Date(o.decided_at).toLocaleString()}` : ''}.</p>
      )}
      <p className="mt-3 text-xs text-slate-500">Internal record only: no order is placed and no supplier is contacted.</p>
    </section>
  )
}
