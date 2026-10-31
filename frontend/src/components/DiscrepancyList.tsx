import type { Discrepancy } from '../types/reconciliation'

/** "R-123-purchase_order: Tomatoes ..." -> "Purchase order: Tomatoes ..." */
function readable(evidence: string): string {
  return evidence
    .replace(/^[^:]*-purchase_order: /, 'Purchase order: ')
    .replace(/^[^:]*-delivery_note: /, 'Delivery note: ')
    .replace(/^[^:]*-invoice: /, 'Invoice: ')
}

export default function DiscrepancyList({ discrepancies }: { discrepancies: Discrepancy[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {discrepancies.map((d) => {
        const short = d.difference.startsWith('-')
        return (
          <li key={d.catalog_item_id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{d.description}</p>
                <p className="text-sm text-slate-600">Ordered {d.ordered_quantity} · Delivered {d.delivered_quantity}</p>
              </div>
              <p className={`text-2xl font-bold ${short ? 'text-red-600' : 'text-amber-600'}`}>{short ? '−' : '+'}{d.difference.replace('-', '')}<span className="ml-1 text-sm font-normal text-slate-500">{d.unit}</span></p>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-slate-500">Where this comes from</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">{d.evidence.map((e) => <li key={e}>{readable(e)}</li>)}</ul>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
