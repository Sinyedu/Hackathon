import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { claimValue } from '../lib/brief'
import { answerSession, approveSession, updateCount } from '../services/session'
import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'
import ProofSheet from './ProofSheet'
import RecoveryPanel from './RecoveryPanel'
import DocumentCompare from './docs/DocumentCompare'

interface Props { session: Session; result: Reconciliation; refresh: (id: string) => Promise<void>; onError: (value: string) => void; isDock: boolean }

export function Questions({ session, result, refresh, onError }: Omit<Props, 'isDock'>) {
  const [busy, setBusy] = useState(false)
  const open = result.matches.filter((match) => match.status === 'needs_review' && match.catalog_item_id)
  if (!open.length) return null
  const match = open[0]
  const line = result.line_items.find((item) => item.id === match.source_line_id)
  const target = result.line_items.find((item) => item.id !== match.source_line_id && result.matches.find((m) => m.source_line_id === item.id)?.catalog_item_id === match.catalog_item_id)
  const respond = async (yes: boolean) => {
    if (!match.catalog_item_id) return
    setBusy(true)
    try { await answerSession(session.id, match.source_line_id, match.catalog_item_id, yes); await refresh(session.id) }
    catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="question" aria-live="polite">
      <h2>Same product?{open.length > 1 && <span> {open.length} to check</span>}</h2>
      <div className="question__pair"><span>{line?.description}</span><span>{target?.description || match.catalog_item_id}</span></div>
      <div className="question__actions">
        <button className="btn btn--primary" disabled={busy} onClick={() => void respond(true)}>Yes, same product</button>
        <button className="btn btn--quiet" disabled={busy} onClick={() => void respond(false)}>No, different</button>
      </div>
    </section>
  )
}

export default function Verdict({ session, result, refresh, onError, isDock }: Props) {
  const [busy, setBusy] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [proof, setProof] = useState<string | null>(null)
  const shortages = result.discrepancies.filter((item) => item.difference.startsWith('-'))
  const approved = result.claim?.status === 'approved'
  const value = claimValue(session)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try { await action(); await refresh(session.id) } catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  const one = shortages.length === 1 ? shortages[0] : null
  const status = approved ? ['approved', 'Approved'] : shortages.length ? ['problem', 'Short'] : result.status === 'needs_review' ? ['review', 'Needs review'] : ['ok', 'All good']
  const proofLine = result.line_items.find((line) => line.id === proof)

  return (
    <section className="verdict">
      <div className="verdict__head">
        <div>
          <span className={`tone-chip tone-chip--${status[0]}`}>{status[1]}</span>
          <h1>{one ? <><em>{one.difference.slice(1)} {one.unit}</em> short.</> : shortages.length ? <><em>{shortages.length} lines</em> short.</> : result.status === 'needs_review' ? 'A few lines need your eyes.' : 'Everything checks out.'}</h1>
          <p>{one ? `${one.description} · ordered ${one.ordered_quantity}, delivered ${one.delivered_quantity}` : shortages.length ? shortages.map((s) => s.description).join(', ') : result.status === 'needs_review' ? 'Confirm the open lines before approving.' : 'The delivery matches the purchase order.'}</p>
        </div>
        {result.claim && !isDock && <button className="btn btn--primary" onClick={() => setClaimOpen(!claimOpen)}>{claimOpen ? 'Hide claim' : approved ? 'View claim' : 'Review claim'}</button>}
      </div>

      {claimOpen && result.claim && (
        <article className="claim">
          <header><h2>Delivery discrepancy claim</h2><span className={`tone-chip tone-chip--${approved ? 'approved' : 'review'}`}>{approved ? 'Approved' : 'Draft'}</span></header>
          <ul>{result.claim.discrepancies.map((item) => <li key={item.catalog_item_id}><span>{item.description}</span><span>ordered {item.ordered_quantity} · received {item.delivered_quantity} · <b>{item.difference} {item.unit}</b></span></li>)}</ul>
          <p className="claim__value">{value ?? 'Price unknown'}</p>
          <small>Fingerprint {session.claim_fingerprint?.slice(0, 12)}…{session.claim_fingerprint?.slice(-8)} · created {new Date(result.claim.created_at).toLocaleString()} · nothing has been sent to the supplier.</small>
          {!approved && <button className="btn btn--primary" disabled={busy || result.status !== 'ready'} onClick={() => void run(() => approveSession(session.id))}>{busy ? 'Approving…' : 'Approve claim'}</button>}
          {!approved && result.status !== 'ready' && <small>Resolve the lines that need review first.</small>}
        </article>
      )}

      <div className="verdict__compare"><DocumentCompare result={result} onProof={setProof} /></div>

      {isDock && session.verdict.some((row) => row.line_ids.length) && (
        <section className="counts">
          <h2>What is actually here?</h2>
          {session.verdict.filter((row) => row.line_ids.length).map((row) => {
            const lineId = row.line_ids[0]
            const current = Number(session.counts[lineId] ?? row.noted)
            return (
              <article className="count" key={row.catalog_item_id}>
                <div><strong>{row.description}</strong><small>Ordered {row.ordered} · note says {row.noted} {row.unit}</small></div>
                <div className="count__stepper">
                  <button disabled={busy || approved || current <= 0} onClick={() => void run(() => updateCount(session.id, lineId, String(current - 1)))} aria-label={`One fewer ${row.description}`}>−</button>
                  <span>{current}</span>
                  <button disabled={busy || approved} onClick={() => void run(() => updateCount(session.id, lineId, String(current + 1)))} aria-label={`One more ${row.description}`}>+</button>
                </div>
                <div className="count__links">
                  <button onClick={() => setProof(lineId)}>View scan</button>
                  <button disabled={busy || approved} onClick={() => void run(() => updateCount(session.id, lineId, null))}>Skip</button>
                  {Number(row.shortage) > 0 && <b>Short {row.shortage} {row.unit}</b>}
                  {Number(row.note_overstated) > 0 && <b>Note overstated by {row.note_overstated}</b>}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {result.discrepancies.map((item) => (
        <details className="finding" key={item.catalog_item_id} open={!isDock && shortages.length === 1}>
          <summary><span>{item.description}</span><b>{item.difference} {item.unit}</b><ChevronDown size={18} aria-hidden /></summary>
          <div className="finding__evidence">{item.evidence.map((source, index) => <code key={index}>{source}</code>)}</div>
          {item.difference.startsWith('-') && !isDock && <RecoveryPanel reconciliationId={result.id} itemId={item.catalog_item_id} title="Replace the shortage" documents={result.documents} />}
        </details>
      ))}

      {result.warnings.length > 0 && (
        <details className="notes">
          <summary>{result.warnings.length} {result.warnings.length === 1 ? 'note' : 'notes'} from reading the scans</summary>
          <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details>
      )}

      {proofLine && <ProofSheet result={result} line={proofLine} onClose={() => setProof(null)} />}
    </section>
  )
}
