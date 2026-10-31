import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import LiveDot from '../components/LiveDot'
import ProofSheet from '../components/ProofSheet'
import ReceiptStrip from '../components/ReceiptStrip'
import Stamp from '../components/Stamp'
import { answerSession, approveSession, createSession, getResult, getSession, joinSession, lanIp, resetSession, updateCount, uploadSession, API } from '../services/session'
import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'

const eventTypes = ['delivery_received', 'reading', 'extracted', 'matching', 'question', 'answered', 'count_updated', 'verdict', 'signed', 'claim_drafted', 'claim_approved', 'phone_connected', 'failed', 'reset']

function useLiveSession(isDock: boolean) {
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<Reconciliation | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async (id: string) => {
    try {
      const next = await getSession(id)
      setSession(next)
      if (next.reconciliation_id) setResult(await getResult(next.reconciliation_id))
      else setResult(null)
    } catch (cause) { setError((cause as Error).message) }
  }, [])
  useEffect(() => {
    const paired = new URLSearchParams(location.search).get('s')
    const saved = localStorage.getItem('dockproof.session')
    const id = isDock ? paired : saved
    if (id) {
      if (isDock) void joinSession(id).then(() => refresh(id)).catch(cause => setError((cause as Error).message))
      else void getSession(id).then(() => refresh(id)).catch(() => createSession().then(next => {
        localStorage.setItem('dockproof.session', next.id)
        setSession(next)
      }).catch(cause => setError((cause as Error).message)))
    } else if (!isDock) {
      void createSession().then(next => { localStorage.setItem('dockproof.session', next.id); setSession(next) }).catch(cause => setError((cause as Error).message))
    }
  }, [isDock, refresh])
  useEffect(() => {
    if (!session?.id) return
    const source = new EventSource(`${API}/api/session/${session.id}/events?after=${session.events.length - 1}`)
    for (const type of eventTypes) source.addEventListener(type, () => void refresh(session.id))
    source.onerror = () => setError('Live connection interrupted. Reconnecting…')
    source.onopen = () => setError('')
    return () => source.close()
  }, [session?.id, session?.events.length, refresh])
  return { session, result, error, setError, refresh }
}

function PairCard({ session }: { session: Session }) {
  const [qr, setQr] = useState('')
  const [url, setUrl] = useState('')
  useEffect(() => {
    void lanIp(session.id).then(({ ip }) => {
      const target = `http://${ip}:${location.port || '5173'}/dock?s=${session.id}`
      setUrl(target)
      return QRCode.toDataURL(target, { margin: 1, width: 208, color: { dark: '#0B0D12', light: '#FFFFFF' } })
    }).then(setQr).catch(() => setQr(''))
  }, [session.id])
  const connected = session.events.some(event => event.type === 'phone_connected')
  return <section className="pair-card">
    <div className="section-label">01 / PAIR A PHONE</div>
    <h2>Scan to be the dock.</h2>
    <p>Count what arrived and answer questions from your phone.</p>
    {qr ? <img className="qr-code" src={qr} alt={`QR code for ${url}`} /> : <a href={`/dock?s=${session.id}`}>Open dock on this device</a>}
    <LiveDot label={connected ? 'Phone connected' : 'Waiting for phone'} active={connected} />
    <small className="pair-url">{url}</small>
  </section>
}

function UploadControl({ session, isDock, onError }: { session: Session; isDock: boolean; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [purchase, setPurchase] = useState<File | null>(null)
  const submit = async (files: { purchase_order?: File; delivery_note?: File }) => {
    setBusy(true)
    onError('')
    try { await uploadSession(session.id, files) } catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  return <section className="upload-control">
    <div className="section-label">02 / DOCUMENTS</div>
    <h2>{isDock ? 'Scan the delivery note.' : 'Give us the documents.'}</h2>
    <p>{busy ? 'Reading and comparing your documents…' : 'We’ll check what arrived against what was ordered.'}</p>
    {!isDock && <label className="file-control">Purchase order
      <input type="file" accept="image/*,.pdf,application/pdf" onChange={event => {
        const file = event.target.files?.[0]
        setPurchase(file || null)
        if (file) void submit({ purchase_order: file })
      }} />
    </label>}
    <label className="file-control">Delivery note
      <input type="file" accept="image/*,.pdf,application/pdf" capture={isDock ? 'environment' : undefined} onChange={event => {
        const note = event.target.files?.[0]
        if (note) void submit({ ...(purchase ? { purchase_order: purchase } : {}), delivery_note: note })
      }} />
    </label>
    {!isDock && purchase && <p className="selected-file">Purchase order selected: {purchase.name}</p>}
    {busy && <LiveDot label="Working with your documents" active />}
  </section>
}

function Questions({ session, result, refresh, onError }: { session: Session; result: Reconciliation; refresh: (id: string) => Promise<void>; onError: (value: string) => void }) {
  const [busy, setBusy] = useState(false)
  const open = result.matches.filter(match => match.status === 'needs_review' && match.catalog_item_id)
  if (!open.length) return null
  const match = open[0]
  const line = result.line_items.find(item => item.id === match.source_line_id)
  const target = result.line_items.find(item => item.id !== match.source_line_id && result.matches.find(m => m.source_line_id === item.id)?.catalog_item_id === match.catalog_item_id)
  const respond = async (yes: boolean) => {
    if (!match.catalog_item_id) return
    setBusy(true)
    try { await answerSession(session.id, match.source_line_id, match.catalog_item_id, yes); await refresh(session.id) }
    catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  return <section className="question-card" aria-live="polite">
    <div className="section-label">YOUR JUDGMENT NEEDED · {open.length} OPEN</div>
    <h2>Same product?</h2>
    <div className="question-pair"><span>{line?.description}</span><i>↔</i><span>{target?.description || match.catalog_item_id}</span></div>
    <div className="button-row"><button className="primary-action" disabled={busy} onClick={() => void respond(true)}>Yes, same product</button><button className="secondary-action" disabled={busy} onClick={() => void respond(false)}>No, different</button></div>
    <small>Answer here or on the paired phone.</small>
  </section>
}

function Result({ session, result, refresh, onError, isDock }: { session: Session; result: Reconciliation; refresh: (id: string) => Promise<void>; onError: (value: string) => void; isDock: boolean }) {
  const [busy, setBusy] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [proof, setProof] = useState<string | null>(null)
  const shortage = result.discrepancies.filter(item => Number(item.difference) < 0)
  const problemCount = shortage.reduce((sum, item) => sum + Math.abs(Number(item.difference)), 0)
  const approved = result.claim?.status === 'approved'
  const claimRows = session.verdict.filter(row => Number(row.shortage) > 0 || Number(row.note_overstated) > 0)
  const claimCents = claimRows.some(row => row.claim_cents === null) ? null : claimRows.reduce((sum, row) => sum + (row.claim_cents || 0), 0)
  const approve = async () => {
    setBusy(true)
    try { await approveSession(session.id); await refresh(session.id) } catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  const count = async (lineId: string, value: string | null) => {
    setBusy(true)
    try { await updateCount(session.id, lineId, value); await refresh(session.id) }
    catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  const proofLine = result.line_items.find(line => line.id === proof)
  return <section className="result-area">
    <div className="section-label">03 / VERDICT · {result.id}</div>
    <div className="verdict-head"><div><h1>{shortage.length ? <><span className="big-number">{problemCount}</span><span> units missing.</span></> : result.status === 'needs_review' ? 'Review needed.' : 'Everything checks out.'}</h1><p>{shortage.length ? `${shortage.length} discrepancy${shortage.length === 1 ? '' : 'ies'} found in the documents.` : result.status === 'needs_review' ? 'Resolve open product or unit questions before approval.' : 'Your delivery matches your purchase order.'}</p></div><Stamp tone={approved ? 'approved' : shortage.length ? 'problem' : 'ok'}>{approved ? 'APPROVED' : shortage.length ? 'SHORT' : result.status === 'needs_review' ? 'REVIEW' : 'ALL GOOD'}</Stamp></div>
    <div className="receipt-grid"><ReceiptStrip title="PURCHASE ORDER" lines={result.line_items.filter(line => result.documents.find(doc => doc.id === line.source_document_id)?.kind === 'purchase_order')} /><ReceiptStrip title="DELIVERY NOTE" lines={result.line_items.filter(line => result.documents.find(doc => doc.id === line.source_document_id)?.kind === 'delivery_note')} angle="right" /></div>
    {isDock && session.verdict.length > 0 && <section className="count-section"><div className="section-label">COUNT THE PALLET / THIRD SOURCE OF TRUTH</div><h2>What is actually here?</h2>{session.verdict.filter(row => row.line_ids.length).map(row => {
      const lineId = row.line_ids[0]
      const current = Number(session.counts[lineId] ?? row.noted)
      return <article className="count-card" key={row.catalog_item_id}><strong>{row.description}</strong><p>Ordered {row.ordered} · Note {row.noted} {row.unit}</p><div className="count-stepper"><button disabled={busy || approved || current <= 0} onClick={() => void count(lineId, String(current - 1))} aria-label={`Count one fewer ${row.description}`}>−</button><span>{current}</span><button disabled={busy || approved} onClick={() => void count(lineId, String(current + 1))} aria-label={`Count one more ${row.description}`}>+</button></div><div className="count-links"><button onClick={() => setProof(lineId)}>View source</button><button disabled={busy || approved} onClick={() => void count(lineId, null)}>Skip count</button></div>{Number(row.shortage) > 0 && <small className="problem-value">Short {row.shortage} {row.unit}</small>}{Number(row.note_overstated) > 0 && <small className="problem-value">Note overstated by {row.note_overstated}</small>}</article>
    })}</section>}
    <div className="evidence-table"><div className="section-label">SOURCE COMPARISON</div>{result.discrepancies.map(item => <details key={item.catalog_item_id}><summary><strong>{item.description}</strong><span className="problem-value">{item.difference} {item.unit}</span></summary><div className="evidence-detail"><span>Ordered {item.ordered_quantity} {item.unit}</span><span>Received {item.delivered_quantity} {item.unit}</span>{item.evidence.map((source, index) => <code key={index}>{source}</code>)}{result.line_items.filter(line => item.evidence.some(source => source.includes(line.id))).map(line => <button key={line.id} className="proof-link" onClick={() => setProof(line.id)}>Proof: {line.id.split('-').at(-1)}</button>)}</div></details>)}</div>
    {result.warnings.length > 0 && <p className="warning-note">{result.warnings.join(' · ')}</p>}
    {result.claim && <div className="claim-actions"><button className="primary-action" onClick={() => setClaimOpen(!claimOpen)}>{claimOpen ? 'Hide claim' : 'Review claim'}</button></div>}
    {claimOpen && result.claim && <section className="claim-paper"><div className="section-label">SUPPLIER CLAIM / {result.claim.status.toUpperCase()}</div><h2>Delivery discrepancy</h2><p>Documented shortage from reconciliation {result.id}.</p>{result.claim.discrepancies.map(item => <p key={item.catalog_item_id}>{item.description}: ordered {item.ordered_quantity} {item.unit}, received {item.delivered_quantity} {item.unit}, difference {item.difference} {item.unit}.</p>)}<p className="claim-amount">{claimCents === null ? 'Price unknown' : `€${(claimCents / 100).toFixed(2)} claim value`}</p><small>SHA-256 {session.claim_fingerprint?.slice(0, 12)}…{session.claim_fingerprint?.slice(-8)} · Created {new Date(result.claim.created_at).toLocaleString()}</small><small>No message has been sent to the supplier.</small>{!approved && <button className="primary-action" disabled={busy || result.status !== 'ready'} onClick={() => void approve()}>{busy ? 'Approving…' : 'Approve claim'}</button>}</section>}
    {isDock && <p className="dock-note">Updates appear on the office screen instantly.</p>}
    {proofLine && <ProofSheet result={result} line={proofLine} onClose={() => setProof(null)} />}
  </section>
}

export default function LiveWorkspace({ isDock = false }: { isDock?: boolean }) {
  const { session, result, error, setError, refresh } = useLiveSession(isDock)
  const latest = session?.events.at(-1)?.type
  return <div className={`live-app ${isDock ? 'live-app--dock' : ''}`}><header className="live-header"><div className="brand-lockup"><span className="brand-mark">D<span>·</span>P</span><b>DockProof</b></div><span className="header-meta">{isDock ? 'THE DOCK' : 'THE OFFICE'} / LOCAL SESSION</span></header>
    <main className="live-main">{error && <div className="error-banner" role="alert">{error}</div>}{!session ? <p>{isDock ? 'Open the QR link from the office screen to pair this phone.' : 'Creating local session…'}</p> : <>
      {!isDock && <div className="home-intro"><div className="section-label">DELIVERY CONTROL / LIVE</div><h1>Today at the dock.</h1><p>Documents arrive. DockProof checks them. You make the final call.</p></div>}
      {!result && <div className="home-grid">{!isDock && <PairCard session={session} />}<UploadControl session={session} isDock={isDock} onError={setError} /></div>}
      {latest === 'reading' && <div className="reading-status"><LiveDot active label="Reading and comparing your documents…" /></div>}
      {result && <><Questions session={session} result={result} refresh={refresh} onError={setError} /><Result session={session} result={result} refresh={refresh} onError={setError} isDock={isDock} /></>}
      {!isDock && <div className="workspace-footer"><LiveDot active label="Watching this session" /><button onClick={() => void resetSession(session.id).then(() => refresh(session.id))}>Reset demo</button></div>}
    </>}</main></div>
}
