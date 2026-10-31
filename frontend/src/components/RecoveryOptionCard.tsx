import { ExternalLink } from 'lucide-react'
import type { RecoveryOption } from '../types/recovery'
import CompatBadge from './CompatBadge'

interface Props {
  option: RecoveryOption
  hasLiveOrder: boolean
  busy: boolean
  onSelect: () => void
}

/** The featured (recommended) option: the one thing to look at first. */
export default function RecoveryOptionCard({ option: o, hasLiveOrder, busy, onSelect }: Props) {
  return (
    <section className="rounded-2xl border-2 border-indigo-500 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Best option</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold text-slate-900">{o.supplier_name}</p>
          <p className="text-sm text-slate-600">{o.description}</p>
        </div>
        <p className="text-right text-2xl font-bold text-slate-900">{o.total_cost}<span className="ml-1 text-sm font-normal text-slate-500">{o.currency}</span></p>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {o.packages_needed} × {o.pack_size} {o.pack_unit} · {o.lead_time_days === 0 ? 'same day' : `${o.lead_time_days} day${o.lead_time_days === 1 ? '' : 's'}`} · {o.available_qty} in stock
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CompatBadge option={o} />
        {o.rank_reasons.slice(0, 3).map((r) => <span key={r} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{r}</span>)}
      </div>
      {o.ai_reason && <p className="mt-2 text-sm text-violet-800">AI note: {o.ai_reason}</p>}
      <a href={o.buy_url} target="_blank" rel="noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-indigo-600 px-4 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50">
        <ExternalLink className="size-4" aria-hidden /> {o.buy_url_is_search ? 'Find this product online' : 'Open supplier page'}
      </a>
      <button onClick={onSelect} disabled={busy || hasLiveOrder}
        className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
        Create Replacement Order
      </button>
    </section>
  )
}
