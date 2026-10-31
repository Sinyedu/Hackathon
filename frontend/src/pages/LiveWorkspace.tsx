import { FlaskConical, Mic, ScrollText } from 'lucide-react'
import { useMemo } from 'react'
import LiveDot from '../components/LiveDot'
import { useLiveSession } from '../hooks/useLiveSession'
import { usePath } from '../hooks/usePath'
import { buildBrief } from '../lib/brief'
import { resetSession } from '../services/session'
import AgentPage from './AgentPage'
import DetailsPage from './DetailsPage'
import GeneratePage from './GeneratePage'

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

  return <div className={`app${isDock ? ' app--dock' : ''}`}>
    <header className="topbar">
      <a className="wordmark" href={hrefOf('/')} onClick={(event) => { event.preventDefault(); go(hrefOf('/')) }}><span className="wordmark__mark" aria-hidden /> DockProof</a>
      <nav className="tabs" aria-label="Sections">
        {TABS.map(([to, label, Icon]) => <a key={to} href={hrefOf(to)} aria-current={page === to ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go(hrefOf(to)) }}><Icon size={20} aria-hidden />{label}</a>)}
      </nav>
      <div className="topbar__right">
        {session && <LiveDot label="Live" active />}
        {session && <button className="link-btn" onClick={() => void resetSession(session.id).then(() => refresh(session.id))}>Start over</button>}
      </div>
    </header>

    {error && <div className="banner" role="alert">{error}</div>}
    {page === '/' ? <AgentPage session={session} result={result} brief={brief} refresh={refresh} onError={setError} onGenerate={() => go(hrefOf('/generate'))} isDock={isDock} />
      : <main className="main">
        {!session ? <p className="muted">{isDock ? 'Open the QR link from the office screen to pair this phone.' : 'Starting a local session…'}</p>
          : page === '/generate' ? <GeneratePage session={session} onError={setError} onOpenAgent={() => go(hrefOf('/'))} />
            : <DetailsPage session={session} result={result} refresh={refresh} onError={setError} isDock={isDock} />}
      </main>}
  </div>
}
