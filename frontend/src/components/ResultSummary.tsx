import { Check, Copy, LifeBuoy } from 'lucide-react'
import { useState } from 'react'
import type { Reconciliation } from '../types/reconciliation'
import ScanLinks from './ScanLinks'
import StatusBadge from './StatusBadge'

function headline(rec: Reconciliation): { title: string; sub: string; tone: string } {
  const shortage = rec.discrepancies.find((d) => d.difference.startsWith('-'))
  const extra = rec.discrepancies.length - (shortage ? 1 : 0)
  if (rec.status === 'approved') return { title: 'Claim approved', sub: 'Saved to the record', tone: 'text-indigo-700' }
  if (shortage) {
    return {
      title: `${shortage.difference.replace('-', '')} ${shortage.unit} short`,
      sub: `${shortage.description}: ordered ${shortage.ordered_quantity}, delivered ${shortage.delivered_quantity}${extra > 0 ? ` (+${extra} more)` : ''}`,
      tone: 'text-red-600',
    }
  }
  if (rec.discrepancies.length > 0) return { title: 'Quantities differ', sub: rec.discrepancies[0].description, tone: 'text-amber-600' }
  if (rec.status === 'needs_review') return { title: 'Needs your review', sub: 'Some lines could not be confirmed', tone: 'text-amber-600' }
  return { title: 'Delivery matches the order', sub: 'No discrepancies found', tone: 'text-emerald-600' }
}

export default function ResultSummary({ rec, onRecover }: { rec: Reconciliation; onRecover: (() => void) | null }) {
  const [copied, setCopied] = useState(false)
  const { title, sub, tone } = headline(rec)
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${tone}`}>{title}</h1>
          <p className="mt-1 text-slate-600">{sub}</p>
        </div>
        <StatusBadge status={rec.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onRecover && (
          <button onClick={onRecover} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
            <LifeBuoy className="size-4" aria-hidden /> Find recovery options
          </button>
        )}
        {canCopy && (
          <button onClick={() => void copy()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? 'Link copied' : 'Copy link'}
          </button>
        )}
      </div>
      <div className="mt-3"><ScanLinks reconciliationId={rec.id} documents={rec.documents} /></div>
    </section>
  )
}
