import { TriangleAlert } from 'lucide-react'
import type { Discrepancy } from '../types/reconciliation'

export default function DiscrepancyList({ discrepancies }: { discrepancies: Discrepancy[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {discrepancies.map((d) => {
        const short = d.difference.startsWith('-')
        return (
          <li key={d.catalog_item_id} className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <TriangleAlert className="size-5 text-red-600" aria-hidden />{d.description}
                </p>
                <p className="text-sm text-slate-600">Ordered {d.ordered_quantity} · Delivered {d.delivered_quantity}</p>
              </div>
              <p className="text-right text-2xl font-bold text-red-600">
                {short ? '−' : '+'}{d.difference.replace('-', '')}
                <span className="block text-xs font-normal text-slate-500">{short ? 'short' : 'extra'} ({d.unit})</span>
              </p>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-slate-600">Evidence ({d.evidence.length})</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5 font-mono text-xs text-slate-600">
                {d.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
