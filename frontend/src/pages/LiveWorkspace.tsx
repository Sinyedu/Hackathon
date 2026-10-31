import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, FileText, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import LiveDot from '../components/LiveDot'
import ChaosDock from '../components/ChaosDock'
import Verdict, { Questions } from '../components/Verdict'
import AgentMode from '../components/agent/AgentMode'
import { useWakeWord } from '../hooks/useWakeWord'
import ParticleOrb from '../components/agent/ParticleOrb'
import { buildBrief } from '../lib/brief'
import { createSession, getResult, getSession, joinSession, lanIp, resetSession, uploadSession, API } from '../services/session'
import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'

const eventTypes = ['printed_to_dock', 'delivery_received', 'reading', 'extracted', 'matching', 'question', 'answered', 'count_updated', 'verdict', 'signed', 'claim_drafted', 'claim_approved', 'phone_connected', 'failed', 'reset']

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
      return QRCode.toDataURL(target, { margin: 0, width: 240, color: { dark: '#0B0D12', light: '#FFFFFF' } })
    }).then(setQr).catch(() => setQr(''))
  }, [session.id])
  const connected = session.events.some(event => event.type === 'phone_connected')
  return <section className="pair">
    {qr ? <img className="pair__qr" src={qr} alt={`QR code for ${url}`} /> : <Smartphone size={40} aria-hidden />}
    <div>
      <h2>Scan from the dock</h2>
      <p>Point a phone at the code to scan delivery notes and count boxes.</p>
      <LiveDot label={connected ? 'Phone connected' : 'Waiting for a phone'} active={connected} />
      {!qr && <a className="link-btn" href={`/dock?s=${session.id}`}>Open the dock view here</a>}
    </div>
  </section>
}

function FilePick({ label, hint, file, capture, onPick }: { label: string; hint: string; file: File | null; capture?: boolean; onPick: (file: File) => void }) {
  return <label className={file ? 'pick pick--done' : 'pick'}>
    <span className="pick__icon">{file ? <Check size={20} aria-hidden /> : <FileText size={20} aria-hidden />}</span>
    <span className="pick__text"><strong>{label}</strong><small>{file ? file.name : hint}</small></span>
    <input type="file" accept="image/*,.pdf,application/pdf" capture={capture ? 'environment' : undefined}
      onChange={event => { const picked = event.target.files?.[0]; if (picked) onPick(picked); event.currentTarget.value = '' }} />
  </label>
}

function Upload({ session, isDock, onError }: { session: Session; isDock: boolean; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [purchase, setPurchase] = useState<File | null>(null)
  const [note, setNote] = useState<File | null>(null)
  const submit = async (files: { purchase_order?: File; delivery_note?: File }) => {
    setBusy(true)
    onError('')
    try { await uploadSession(session.id, files) } catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  return <section className="upload">
    <h2>{isDock ? 'Scan the delivery note' : 'Add both documents'}</h2>
    <div className="upload__picks">
      {!isDock && <FilePick label="Purchase order" hint="What you ordered · photo or PDF" file={purchase} onPick={file => { setPurchase(file); void submit({ purchase_order: file }) }} />}
      <FilePick label="Delivery note" hint="What arrived · photo or PDF" file={note} capture={isDock}
        onPick={file => { setNote(file); void submit({ ...(purchase ? { purchase_order: purchase } : {}), delivery_note: file }) }} />
    </div>
    {busy && <LiveDot label="Uploading" active />}
  </section>
}

const WAKE_LABEL = { off: 'Hey agent: off', starting: 'Hey agent: starting…', listening: 'Say “Hey agent”', suspended: 'Hey agent: click the page once', denied: 'Hey agent: mic blocked', unsupported: 'Hey agent: needs HTTPS' } as const

export default function LiveWorkspace({ isDock = false }: { isDock?: boolean }) {
  const { session, result, error, setError, refresh } = useLiveSession(isDock)
  // Keyed to the current result so the generator closes itself once its delivery is read.
  const [chaosTarget, setChaosTarget] = useState<string | null>(null)
  const chaosOpen = chaosTarget === (result?.id || 'none')
  const [agentOpen, setAgentOpen] = useState(false)
  const [wake, setWake] = useState<string | null>(null) // null: opened by button; otherwise what followed "Hey agent"
  const [listenOn, setListenOn] = useState(() => localStorage.getItem('dockproof.wake') !== 'off')
  const micOk = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia
  const wakeWord = useWakeWord(listenOn && micOk && !agentOpen && !!session, (command) => { setWake(command); setAgentOpen(true) })
  const wakeKey = !listenOn ? 'off' : agentOpen ? 'listening' : wakeWord.state // while the agent is open it does the listening
  const wakeNote = wakeWord.error ?? (wakeWord.heard ? `Heard “${wakeWord.heard}”` : null)
  const toggleListen = () => {
    const next = !listenOn
    setListenOn(next)
    try { localStorage.setItem('dockproof.wake', next ? 'on' : 'off') } catch { /* preference not remembered */ }
  }
  const closeAgent = () => { setAgentOpen(false); setWake(null) }
  const brief = useMemo(() => buildBrief(session, result), [session, result])
  const reading = session?.events.at(-1)?.type === 'reading'
  return <div className={`app${isDock ? ' app--dock' : ''}`}>
    <header className="topbar">
      <a className="wordmark" href={isDock ? undefined : '/'}><span className="wordmark__mark" aria-hidden /> DockProof{isDock && <small>Dock</small>}</a>
      <div className="topbar__right">
        {session && <LiveDot label="Live" active />}
        {wakeNote && <span className="wake-note" role="status" title={wakeNote}>{wakeNote}</span>}
        {micOk && <button className="wake-toggle" onClick={toggleListen} aria-pressed={listenOn} title="Say “Hey agent” anywhere to open the agent. Audio stays on this computer.">
          <i className={`wake-dot wake-dot--${wakeKey}${wakeWord.capturing ? ' wake-dot--hearing' : ''}`} aria-hidden />{WAKE_LABEL[wakeKey]}
        </button>}
        <button className="agent-btn" onClick={() => { setWake(null); setAgentOpen(true) }} disabled={!session}>
          <ParticleOrb className="agent-btn__orb" phase="idle" dots={90} /> Speak with agent
        </button>
      </div>
    </header>

    <main className="main">
      {error && <div className="banner" role="alert">{error}</div>}
      {!session ? <p className="muted">{isDock ? 'Open the QR link from the office screen to pair this phone.' : 'Starting a local session…'}</p> : <>
        {!result && !isDock && <div className="intro">
          <h1>Today at the dock.</h1>
          <p>DockProof compares what you ordered with what arrived. You make the final call.</p>
        </div>}
        {reading && <div className="reading"><ParticleOrb className="reading__orb" phase="thinking" dots={260} /><p>Reading and comparing your documents…</p></div>}
        {chaosOpen && !isDock && <ChaosDock session={session} onError={setError} />}
        {!result && !chaosOpen && !reading && <div className="start">
          <Upload session={session} isDock={isDock} onError={setError} />
          {!isDock && <PairCard session={session} />}
        </div>}
        {result && <><Questions session={session} result={result} refresh={refresh} onError={setError} /><Verdict key={result.id} session={session} result={result} refresh={refresh} onError={setError} isDock={isDock} /></>}
        {!isDock && <footer className="footer">
          <button className="link-btn" onClick={() => setChaosTarget(chaosOpen ? null : (result?.id || 'none'))}>{chaosOpen ? 'Close test delivery' : 'Generate a test delivery'}</button>
          <button className="link-btn" onClick={() => void resetSession(session.id).then(() => refresh(session.id))}>Start over</button>
        </footer>}
      </>}
    </main>
    {agentOpen && <AgentMode session={session} result={result} brief={brief} wake={wake} refresh={refresh} onClose={closeAgent} />}
  </div>
}
