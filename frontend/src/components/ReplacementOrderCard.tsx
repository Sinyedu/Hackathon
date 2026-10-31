import { useState } from 'react'
import type { ReplacementOrder } from '../types/recovery'

const STATUS = {
  draft: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-slate-200 text-slate-700',
} as const

interface Props {
  order: ReplacementOrder
  busy: boolean
  onDecide: (decision: 'approve' | 'reject', confirm: boolean) => void
}

export default function ReplacementOrderCard({ order: o, busy, onDecide }: Props) {
  const [confirmed, setConfirmed] = useState(false)
  const draft = o.status === 'draft'
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-900">Replacement order <span className="font-mono text-sm text-slate-500">{o.id}</span></h4>
        <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS[o.status]}`}>{o.status}</span>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Replaces</dt><dd>{o.missing_quantity} {o.original_unit} of {o.original_description}</dd></div>
        <div><dt className="text-slate-500">With</dt><dd>{o.option.description} ({o.option.supplier_name})</dd></div>
        <div><dt className="text-slate-500">Quantity</dt><dd>{o.packages} × {o.option.pack_size} {o.option.pack_unit} {o.option.sale_unit}</dd></div>
        <div><dt className="text-slate-500">Unit price</dt><dd>{o.unit_price} {o.currency}</dd></div>
        <div><dt className="text-slate-500">Estimated total</dt><dd className="font-semibold">{o.total_estimated_cost} {o.currency} (excl. taxes/shipping)</dd></div>
        <div><dt className="text-slate-500">Lead time</dt><dd>{o.lead_time_days} day(s)</dd></div>
      </dl>
      {o.warning && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{o.warning}</p>}
      {draft ? (
        <div className="mt-3 flex flex-col gap-2">
          {o.requires_confirmation && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
              I have checked that this substitute is acceptable.
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={() => onDecide('approve', confirmed)} disabled={busy || (o.requires_confirmation && !confirmed)}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:bg-slate-300">Approve draft</button>
            <button onClick={() => onDecide('reject', false)} disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50">Reject</button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          {o.status === 'approved' ? 'Approved' : 'Rejected'} internally{o.decided_at ? ` on ${new Date(o.decided_at).toLocaleString()}` : ''}.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">Internal record only: no order is placed and no supplier is contacted.</p>
    </section>
  )
}
