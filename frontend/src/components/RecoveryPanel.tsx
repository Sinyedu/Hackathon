import { LifeBuoy, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRecovery } from '../hooks/useRecovery'
import type { Document } from '../types/reconciliation'
import type { Priority } from '../types/recovery'
import RecoveryOptionCard from './RecoveryOptionCard'
import RecoveryOptionRow from './RecoveryOptionRow'
import ReplacementOrderCard from './ReplacementOrderCard'

interface Props {
  reconciliationId: string
  itemId: string
  title?: string
  documents?: Document[]
}

export default function RecoveryPanel({ reconciliationId, itemId, title = 'Recovery options', documents = [] }: Props) {
  const { plan, loaded, busy, error, find, createOrder, decide } = useRecovery(reconciliationId, itemId)
  const [priority, setPriority] = useState<Priority>('cost')
  if (!loaded) return null

  const err = error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
  if (!plan) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">AutoRecover searches the supplier catalog for a replacement and ranks the options. Nothing is ordered.</p>
        </div>
        {err}
        <button onClick={() => void find(priority)} disabled={busy !== null}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
          {busy === 'find' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LifeBuoy className="size-4" aria-hidden />}
          Find Recovery Options
        </button>
      </section>
    )
  }

  const best = plan.options.find((o) => o.option_id === plan.recommended_option_id)
  const others = plan.options.filter((o) => o !== best)
  const liveOrder = plan.orders.some((o) => o.status !== 'rejected')
  const pick = (id: string) => void createOrder(id)
  const toggle = (p: Priority, label: string) => (
    <button key={p} onClick={() => { setPriority(p); void find(p) }} disabled={busy !== null}
      className={`rounded-md px-3 py-1 text-sm font-medium disabled:opacity-50 ${plan.priority === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
  )
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">Need {plan.missing_quantity} {plan.unit} ({plan.required_amount} {plan.amount_unit})</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-200/70 p-1">
          {busy === 'find' && <Loader2 className="ml-1 size-4 animate-spin text-slate-500" aria-hidden />}
          {toggle('cost', 'Cheapest')}{toggle('speed', 'Fastest')}
        </div>
      </div>
      {err}
      {plan.warnings.map((w) => <p key={w} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{w}</p>)}
      {best ? (
        <RecoveryOptionCard option={best} hasLiveOrder={liveOrder} busy={busy !== null} onSelect={() => pick(best.option_id)} />
      ) : (
        plan.options.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-slate-600">No feasible recovery option was found; nothing was invented.</p>
      )}
      {plan.orders.map((o) => (
        <ReplacementOrderCard key={o.id} order={o} documents={documents} busy={busy !== null}
          onDecide={(d, confirm) => void decide(o.id, d, confirm)} />
      ))}
      {others.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Other options ({others.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {others.map((o) => <RecoveryOptionRow key={o.option_id} option={o} hasLiveOrder={liveOrder} busy={busy !== null} onSelect={() => pick(o.option_id)} />)}
          </ul>
        </details>
      )}
      {plan.excluded.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">Why {plan.excluded.length} candidates were excluded</summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {plan.excluded.map((e) => <li key={`${e.supplier_name}${e.description}`}>{e.supplier_name}, {e.description}: {e.reason}</li>)}
          </ul>
        </details>
      )}
    </section>
  )
}
