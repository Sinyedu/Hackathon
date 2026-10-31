import { Bot, ShieldCheck } from 'lucide-react'
import type { RecoveryOption } from '../types/recovery'

const TAGS: Record<string, string> = { recommended: 'Recommended', cheapest: 'Cheapest', fastest: 'Fastest' }

function CompatBadge({ option }: { option: RecoveryOption }) {
  if (option.verified) {
    return (
      <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <ShieldCheck className="size-3.5" aria-hidden />
        {option.compatibility === 'exact' ? 'Verified exact match' : 'Verified, repackaged'}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
      <Bot className="size-3.5" aria-hidden />AI-assessed substitute
    </span>
  )
}

interface Props {
  option: RecoveryOption
  hasLiveOrder: boolean
  busy: boolean
  onSelect: () => void
}

export default function RecoveryOptionCard({ option: o, hasLiveOrder, busy, onSelect }: Props) {
  const recommended = o.tags.includes('recommended')
  return (
    <li className={`rounded-xl border p-4 ${recommended ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{o.supplier_name}</p>
          <p className="text-sm text-slate-600">{o.description}</p>
        </div>
        <p className="text-right text-xl font-bold text-slate-900">
          {o.total_cost} <span className="text-sm font-normal text-slate-500">{o.currency}</span>
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CompatBadge option={o} />
        {o.tags.map((t) => (
          <span key={t} className={`rounded px-2 py-0.5 text-xs font-medium ${t === 'recommended' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {TAGS[t] ?? t}
          </span>
        ))}
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${o.fulfills_shortage ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          {o.fulfills_shortage ? 'Covers full shortage' : `Partial: ${o.packages_orderable}/${o.packages_needed}`}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-500">Quantity</dt><dd>{o.packages_needed} × {o.pack_size} {o.pack_unit}</dd></div>
        <div><dt className="text-slate-500">Unit price</dt><dd>{o.unit_price} {o.currency}/{o.sale_unit}</dd></div>
        <div><dt className="text-slate-500">In stock</dt><dd>{o.available_qty} {o.sale_unit}</dd></div>
        <div><dt className="text-slate-500">Lead time</dt><dd>{o.lead_time_days === 0 ? 'Same day' : `${o.lead_time_days} day(s)`}</dd></div>
      </dl>
      {o.ai_reason && <p className="mt-2 text-sm text-violet-800">AI note: {o.ai_reason}</p>}
      <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
        {o.rank_reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {o.fulfills_shortage && (
        <button onClick={onSelect} disabled={busy || hasLiveOrder}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
          Create Replacement Order
        </button>
      )}
    </li>
  )
}
