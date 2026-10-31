import { Loader2, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import AskPanel from '../components/AskPanel'
import ClaimPanel from '../components/ClaimPanel'
import DiscrepancyList from '../components/DiscrepancyList'
import DocumentPanel from '../components/DocumentPanel'
import RecoveryPanel from '../components/RecoveryPanel'
import ResultSummary from '../components/ResultSummary'
import Tabs, { type TabDef } from '../components/Tabs'
import WarningsBanner from '../components/WarningsBanner'
import { useCorrections } from '../hooks/useCorrections'
import { useReconciliation } from '../hooks/useReconciliation'
import { errorMessage } from '../lib/errors'
import { approveReconciliation, submitCorrections } from '../services/api'
import type { CatalogItem, Reconciliation } from '../types/reconciliation'

type Tab = 'result' | 'recovery' | 'scans'

function Review({ initial, catalog }: { initial: Reconciliation; catalog: CatalogItem[] }) {
  const [rec, setRec] = useState(initial)
  const [tab, setTab] = useState<Tab>('result')
  const corrections = useCorrections(rec)
  const [busy, setBusy] = useState<'save' | 'approve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locked = rec.status === 'approved' || busy !== null
  const shortages = rec.discrepancies.filter((d) => d.difference.startsWith('-'))
  const tabs: TabDef<Tab>[] = [
    { id: 'result', label: 'Result' },
    ...(shortages.length > 0 ? [{ id: 'recovery' as const, label: 'Recovery' }] : []),
    { id: 'scans', label: 'Scans', dot: corrections.dirty },
  ]

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
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 pb-28">
      <ResultSummary rec={rec} onRecover={shortages.length > 0 ? () => setTab('recovery') : null} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'result' && (
        <>
          <WarningsBanner warnings={rec.warnings} />
          {rec.discrepancies.length > 0 && <DiscrepancyList discrepancies={rec.discrepancies} />}
          <ClaimPanel rec={rec} dirty={corrections.dirty} busy={busy === 'approve'} error={busy ? null : error}
            onApprove={() => void run('approve', () => approveReconciliation(rec.id))} />
        </>
      )}
      {tab === 'recovery' && shortages.map((d) => (
        <RecoveryPanel key={d.catalog_item_id} reconciliationId={rec.id} itemId={d.catalog_item_id}
          title={`Replace: ${d.description}`} documents={rec.documents.filter((x) => x.status !== 'not_reconciled')} />
      ))}
      {tab === 'scans' && (
        <>
          <p className="text-sm text-slate-600">This is what DockProof read. Scanning can misread digits: tap Edit to fix a value or product, then save.</p>
          {rec.documents.filter((d) => d.status !== 'not_reconciled').map((doc) => (
            <DocumentPanel key={doc.id} rec={rec} doc={doc} catalog={catalog} corrections={corrections} disabled={locked} />
          ))}
        </>
      )}

      {!locked && (corrections.dirty || error) && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
            {error && <p role="alert" className="mr-auto text-sm text-red-700">{error}</p>}
            <button onClick={corrections.reset} disabled={!corrections.dirty}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-slate-700 disabled:opacity-40"><RotateCcw className="size-4" aria-hidden />Discard</button>
            <button onClick={save} disabled={!corrections.dirty || corrections.invalid.size > 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:bg-slate-300">
              {busy === 'save' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}Save corrections
            </button>
          </div>
        </div>
      )}
      <AskPanel reconciliationId={rec.id} />
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
