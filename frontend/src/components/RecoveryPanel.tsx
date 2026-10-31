import { LifeBuoy, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRecovery } from '../hooks/useRecovery'
import type { Priority } from '../types/recovery'
import RecoveryOptionCard from './RecoveryOptionCard'
import ReplacementOrderCard from './ReplacementOrderCard'

export default function RecoveryPanel({ reconciliationId, itemId }: { reconciliationId: string; itemId: string }) {
  const { plan, loaded, busy, error, find, createOrder, decide } = useRecovery(reconciliationId, itemId)
  const [priority, setPriority] = useState<Priority>('cost')
  if (!loaded) return null

  const liveOrder = plan?.orders.find((o) => o.status !== 'rejected')
  const finder = (p: Priority) => (
    <button onClick={() => { setPriority(p); void find(p) }} disabled={busy !== null}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${plan?.priority === p ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700'}`}>
      {p === 'cost' ? 'Cheapest first' : 'Fastest first'}
    </button>
  )

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      {error && <p role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {!plan ? (
        <button onClick={() => void find(priority)} disabled={busy !== null}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
          {busy === 'find' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LifeBuoy className="size-4" aria-hidden />}
          Find Recovery Options
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              AutoRecover: need {plan.missing_quantity} {plan.unit} = {plan.required_amount} {plan.amount_unit}
            </p>
            <div className="flex items-center gap-2">
              {busy === 'find' && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {finder('cost')}{finder('speed')}
            </div>
          </div>
          {plan.recommendation_summary && (
            <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900"><strong>Why recommended:</strong> {plan.recommendation_summary}</p>
          )}
          {plan.warnings.map((w) => <p key={w} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{w}</p>)}
          {plan.options.length === 0 && <p className="text-sm text-slate-600">No feasible recovery option was found; nothing was invented.</p>}
          <ul className="flex flex-col gap-3">
            {plan.options.map((o) => (
              <RecoveryOptionCard key={o.option_id} option={o} hasLiveOrder={liveOrder !== undefined}
                busy={busy !== null} onSelect={() => void createOrder(o.option_id)} />
            ))}
          </ul>
          {plan.orders.map((o) => (
            <ReplacementOrderCard key={o.id} order={o} busy={busy !== null}
              onDecide={(d, confirm) => void decide(o.id, d, confirm)} />
          ))}
          {plan.excluded.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-600">Excluded candidates ({plan.excluded.length})</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
                {plan.excluded.map((e) => <li key={`${e.supplier_name}${e.description}`}>{e.supplier_name}: {e.description}: {e.reason}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
