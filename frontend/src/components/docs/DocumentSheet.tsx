import { Download, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRows, summarise } from '../../lib/compare'
import type { Reconciliation } from '../../types/reconciliation'
import ProofSheet from '../ProofSheet'
import DocumentCompare from './DocumentCompare'
import OriginalView from './OriginalView'

export type SheetTab = 'compare' | 'purchase_order' | 'delivery_note'
const TABS: [SheetTab, string][] = [['compare', 'Side by side'], ['purchase_order', 'Purchase order'], ['delivery_note', 'Delivery note']]

interface Props { result: Reconciliation; tab: SheetTab; onTab: (tab: SheetTab) => void; onClose: () => void; onExport: () => void }

/** Full-screen document view the agent opens: comparison, then the untouched originals. */
export default function DocumentSheet({ result, tab, onTab, onClose, onExport }: Props) {
  const [proof, setProof] = useState<string | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const summary = useMemo(() => summarise(buildRows(result)), [result])

  useEffect(() => {
    sheet.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !proof && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, proof])

  const proofLine = result.line_items.find((line) => line.id === proof)
  return (
    <div className="sheet" ref={sheet} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Documents">
      <header className="sheet__bar">
        <div className="sheet__summary">
          <h2>Documents</h2>
          {summary.bad > 0 && <span className="tone-chip tone-chip--problem">{summary.bad} {summary.bad === 1 ? 'problem' : 'problems'}</span>}
          {summary.review > 0 && <span className="tone-chip tone-chip--review">{summary.review} to check</span>}
          <span className="tone-chip tone-chip--ok">{summary.ok} matched</span>
        </div>
        <button className="icon-btn" onClick={onExport} aria-label="Download the briefing"><Download size={18} aria-hidden /></button>
        <button className="icon-btn" onClick={onClose} aria-label="Close documents"><X size={20} aria-hidden /></button>
      </header>
      <div className="agent-brief__tabs sheet__tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>{label}</button>)}
      </div>
      <div className="sheet__body">
        {tab === 'compare'
          ? <DocumentCompare result={result} onProof={setProof} />
          : <OriginalView reconciliationId={result.id} document={result.documents.find((d) => d.kind === tab)} />}
      </div>
      {proofLine && <ProofSheet result={result} line={proofLine} onClose={() => setProof(null)} />}
    </div>
  )
}
