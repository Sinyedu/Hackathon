import { ExternalLink } from 'lucide-react'
import type { RecoveryOption } from '../types/recovery'
import CompatBadge from './CompatBadge'

interface Props {
  option: RecoveryOption
  hasLiveOrder: boolean
  busy: boolean
  onSelect: () => void
}

/** A compact alternative; details are one tap away. */
export default function RecoveryOptionRow({ option: o, hasLiveOrder, busy, onSelect }: Props) {
  return (
    <li className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{o.supplier_name}</p>
          <p className="truncate text-xs text-slate-500">{o.description}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-slate-900">{o.total_cost} {o.currency}</p>
          <p className="text-xs text-slate-500">{o.lead_time_days === 0 ? 'same day' : `${o.lead_time_days} day${o.lead_time_days === 1 ? '' : 's'}`}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CompatBadge option={o} />
        {o.tags.filter((t) => t !== 'recommended').map((t) => <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">{t}</span>)}
        {!o.fulfills_shortage && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Partial: {o.packages_orderable}/{o.packages_needed}</span>}
        <a href={o.buy_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline underline-offset-2">
          <ExternalLink className="size-3.5" aria-hidden /> {o.buy_url_is_search ? 'Find online' : 'Supplier page'}
        </a>
        {o.fulfills_shortage && (
          <button onClick={onSelect} disabled={busy || hasLiveOrder}
            className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">Select</button>
        )}
      </div>
      <details className="mt-2 text-xs text-slate-600">
        <summary className="cursor-pointer">Details</summary>
        <p className="mt-1">{o.packages_needed} × {o.pack_size} {o.pack_unit} at {o.unit_price} {o.currency}/{o.sale_unit} · {o.available_qty} in stock</p>
        {o.ai_reason && <p className="mt-1 text-violet-800">AI note: {o.ai_reason}</p>}
        <ul className="mt-1 list-disc pl-4">{o.rank_reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>
    </li>
  )
}
