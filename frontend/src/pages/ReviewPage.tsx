import { Loader2, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import ClaimPanel from '../components/ClaimPanel'
import DiscrepancyList from '../components/DiscrepancyList'
import DocumentPanel from '../components/DocumentPanel'
import StatusBadge from '../components/StatusBadge'
import { useCorrections } from '../hooks/useCorrections'
import { useReconciliation } from '../hooks/useReconciliation'
import { errorMessage } from '../lib/errors'
import { approveReconciliation, submitCorrections } from '../services/api'
import type { Reconciliation } from '../types/reconciliation'

function Review({ initial, catalog }: { initial: Reconciliation; catalog: Parameters<typeof DocumentPanel>[0]['catalog'] }) {
  const [rec, setRec] = useState(initial)
  const corrections = useCorrections(rec)
  const [busy, setBusy] = useState<'save' | 'approve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locked = rec.status === 'approved' || busy !== null

  const run = async (kind: 'save' | 'approve', action: () => Promise<Reconciliation>) => {
    setBusy(kind)
    setError(null)
    try {
      setRec(await action())
      if (kind === 'save') corrections.reset()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const save = () => {
    const payload = corrections.payload()
    if (payload) void run('save', () => submitCorrections(rec.id, payload))
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Reconciliation <span className="font-mono text-base text-slate-500">{rec.id}</span></h1>
        <StatusBadge status={rec.status} />
      </div>
      {rec.warnings.length > 0 && (
        <ul className="list-disc space-y-1 rounded-xl bg-amber-50 p-4 pl-8 text-sm text-amber-900">
          {rec.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {rec.discrepancies.length > 0 && <DiscrepancyList reconciliationId={rec.id} discrepancies={rec.discrepancies} />}
      <ClaimPanel rec={rec} dirty={corrections.dirty} busy={busy === 'approve'} error={busy ? null : error}
        onApprove={() => void run('approve', () => approveReconciliation(rec.id))} />

      <h2 className="text-lg font-semibold text-slate-900">Check what was read from your scans</h2>
      <p className="-mt-3 text-sm text-slate-600">Scanning can misread digits. Fix any value or product, then save.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {rec.documents.filter((d) => d.status !== 'not_reconciled').map((doc) => (
          <DocumentPanel key={doc.id} rec={rec} doc={doc} catalog={catalog} corrections={corrections} disabled={locked} />
        ))}
      </div>
      {!locked && (corrections.dirty || error) && (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-slate-50/95 py-3">
          {error && busy === null && <p role="alert" className="mr-auto text-sm text-red-700">{error}</p>}
          <button onClick={corrections.reset} disabled={!corrections.dirty}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-slate-700 disabled:opacity-40"><RotateCcw className="size-4" aria-hidden />Discard</button>
          <button onClick={save} disabled={!corrections.dirty || corrections.invalid.size > 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:bg-slate-300">
            {busy === 'save' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}Save corrections
          </button>
        </div>
      )}
    </main>
  )
}

export default function ReviewPage({ id, onNewScan }: { id: string; onNewScan: () => void }) {
  const { rec, catalog, error } = useReconciliation(id)
  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center">
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>
        <button onClick={onNewScan} className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white">Start a new scan</button>
      </main>
    )
  }
  if (!rec) return <p className="flex items-center justify-center gap-2 py-10 text-slate-600"><Loader2 className="size-5 animate-spin" aria-hidden />Loading…</p>
  return <Review initial={rec} catalog={catalog} />
}
