import { FlaskConical, Mic, ScrollText } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import LiveDot from '../components/LiveDot'
import DocumentSheet, { type SheetTab } from '../components/docs/DocumentSheet'
import { useAgent } from '../hooks/useAgent'
import { useLiveSession } from '../hooks/useLiveSession'
import { usePath } from '../hooks/usePath'
import { buildBrief } from '../lib/brief'
import { resetSession } from '../services/session'
import AgentPage from './AgentPage'
import DetailsPage from './DetailsPage'
import GeneratePage from './GeneratePage'

const WAKE_LABEL = { off: 'Hey agent: off', starting: 'Hey agent: starting…', listening: 'Say “Hey agent”', suspended: 'Hey agent: click the page once', denied: 'Hey agent: mic blocked', unsupported: 'Hey agent: needs HTTPS' } as const

const TABS = [['/', 'Agent', Mic], ['/details', 'Details', ScrollText], ['/generate', 'Test deliveries', FlaskConical]] as const

export default function LiveWorkspace() {
  const [path, go] = usePath()
  // A paired phone opens /dock?s=<session>; it gets the same screens under that prefix.
  const isDock = path.startsWith('/dock')
  const base = isDock ? '/dock' : ''
  const sub = path.slice(base.length) || '/'
  const page = TABS.some(([href]) => href === sub) ? sub : '/'
  const hrefOf = (to: string) => (to === '/' ? base || '/' : base + to)
  const { session, result, error, setError, refresh } = useLiveSession(isDock)
  const brief = useMemo(() => buildBrief(session, result), [session, result])
  const [sheet, setSheet] = useState<SheetTab | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [listenOn, setListenOn] = useState(() => localStorage.getItem('dockproof.wake') !== 'off')
  const toggleListen = () => {
    const next = !listenOn
    setListenOn(next)
    try { localStorage.setItem('dockproof.wake', next ? 'on' : 'off') } catch { /* preference not remembered */ }
  }
  // The agent lives here, above the pages, so it keeps listening (and can be woken) on every screen.
  const agent = useAgent({
    inputs: { file: fileInput, camera: cameraInput }, session, result, brief, refresh,
    listening: listenOn, active: page === '/', onGenerate: () => go(hrefOf('/generate')), onWake: () => go(hrefOf('/')), onShow: setSheet,
  })
  const picked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.currentTarget.value = ''
    if (files.length) agent.uploadPicked(files)
  }

  return <div className={`app${isDock ? ' app--dock' : ''}`}>
    <header className="topbar">
      <a className="wordmark" href={hrefOf('/')} onClick={(event) => { event.preventDefault(); go(hrefOf('/')) }}><span className="wordmark__mark" aria-hidden /> DockProof</a>
      <nav className="tabs" aria-label="Sections">
        {TABS.map(([to, label, Icon]) => <a key={to} href={hrefOf(to)} aria-current={page === to ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go(hrefOf(to)) }}><Icon size={20} aria-hidden />{label}</a>)}
      </nav>
      <div className="topbar__right">
        {session && <LiveDot label="Live" active />}
        <button className="wake-toggle" onClick={toggleListen} aria-pressed={listenOn} title="Say “Hey agent” on any page. Audio is processed on this computer and discarded unless it starts with the wake phrase.">
          <i className={`wake-dot wake-dot--${listenOn ? agent.listenState : 'off'}`} aria-hidden />{WAKE_LABEL[listenOn ? agent.listenState : 'off']}
        </button>
        {session && <button className="link-btn" onClick={() => void resetSession(session.id).then(() => refresh(session.id))}>Start over</button>}
      </div>
    </header>

    {error && <div className="banner" role="alert">{error}</div>}
    <input ref={fileInput} className="visually-hidden" type="file" multiple accept="image/*,.pdf,application/pdf" tabIndex={-1} onChange={picked} />
    <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" tabIndex={-1} onChange={picked} />
    {page === '/' ? <AgentPage agent={agent} fileInput={fileInput} cameraInput={cameraInput} session={session} result={result} brief={brief} refresh={refresh} onError={setError} isDock={isDock} onShowDocuments={() => setSheet('compare')} />
      : <main className="main">
        {!session ? <p className="muted">{isDock ? 'Open the QR link from the office screen to pair this phone.' : 'Starting a local session…'}</p>
          : page === '/generate' ? <GeneratePage session={session} onError={setError} onOpenAgent={() => go(hrefOf('/'))} onPrinted={() => go(hrefOf('/'))} />
            : <DetailsPage session={session} result={result} refresh={refresh} onError={setError} isDock={isDock} />}
      </main>}
    {sheet && result && <DocumentSheet result={result} tab={sheet} onTab={setSheet} onClose={() => setSheet(null)} onExport={agent.exportBrief} />}
  </div>
}
