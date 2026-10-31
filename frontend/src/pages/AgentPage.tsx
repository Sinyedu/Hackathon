import { ArrowUp, Camera, FileText, Mic, Square, Upload as UploadIcon, Volume2, VolumeX } from 'lucide-react'
import { useState, type RefObject } from 'react'
import AgentBrief from '../components/agent/AgentBrief'
import OfferCard from '../components/agent/OfferCard'
import ParticleOrb from '../components/agent/ParticleOrb'
import ReviewLines from '../components/agent/ReviewLines'
import { PairCard } from '../components/StartPanels'
import { Questions } from '../components/Verdict'
import type { useAgent } from '../hooks/useAgent'
import { isTouch } from '../lib/device'
import { canSpeak } from '../lib/speak'
import type { Brief } from '../lib/brief'
import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'

const STATUS = {
  idle: 'Ready',
  listening: 'Listening to you… I answer after 3 seconds of silence',
  thinking: 'Thinking…',
  speaking: 'Speaking. I am not listening right now',
} as const
const PROMPTS = ['Catch me up', 'What is missing?', 'Elaborate', 'Find a replacement', 'Export the briefing']

interface Props {
  agent: ReturnType<typeof useAgent>
  fileInput: RefObject<HTMLInputElement | null>
  cameraInput: RefObject<HTMLInputElement | null>
  session: Session | null
  result: Reconciliation | null
  brief: Brief
  refresh: (id: string) => Promise<void>
  onError: (message: string) => void
  isDock: boolean
}

export default function AgentPage({ agent, fileInput, cameraInput, session, result, brief, refresh, onError, isDock }: Props) {
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const { mic, caption, phase, docs } = agent

  const send = (value: string) => {
    setText('')
    void agent.handle(value)
  }
  const drop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) agent.uploadPicked(Array.from(event.dataTransfer.files))
  }

  return (
    <div className={`agent-page${dragging ? ' agent-page--drop' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }} onDrop={drop}>
      <div className="agent__voice">
        <div className="agent__meta">
          <span className={`agent__status agent__status--${phase}`}><i aria-hidden /> {phase === 'idle' && agent.listenState === 'listening' ? 'Waiting. Say “Hey agent”' : STATUS[phase]}</span>
          {canSpeak && (
            <button className="icon-btn" onClick={agent.toggleMute} aria-pressed={agent.muted} aria-label={agent.muted ? 'Turn voice on' : 'Mute voice'}>
              {agent.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
            </button>
          )}
        </div>
        <ParticleOrb className="agent__orb" phase={phase} level={mic.level} pulse={agent.pulse} />
        <p className="agent__caption" aria-live="polite">
          <span>{caption.text.slice(0, caption.at)}</span><span className="agent__caption-next">{caption.text.slice(caption.at)}</span>
        </p>

        {session && result && <Questions session={session} result={result} refresh={refresh} onError={onError} />}
        {result && <ReviewLines result={result} busy={agent.busy} onResolve={agent.resolve} />}
        {agent.offer && <OfferCard offer={agent.offer} />}
        {docs.pending && (
          <div className="agent__confirm">
            <p>Which document is <b>{docs.pending.file.name}</b>?</p>
            <div>
              <button className="btn btn--primary" disabled={agent.busy} onClick={() => agent.assignKind('purchase_order')}>Purchase order</button>
              <button className="btn btn--primary" disabled={agent.busy} onClick={() => agent.assignKind('delivery_note')}>Delivery note</button>
            </div>
          </div>
        )}
        {agent.confirming && (
          <div className="agent__confirm">
            <p>Approve the draft claim? It is saved as approved. Nothing is sent to the supplier.</p>
            <div>
              <button className="btn btn--primary" disabled={agent.busy} onClick={() => void agent.confirmApproval()}>Confirm approval</button>
              <button className="btn btn--quiet" onClick={() => agent.setConfirming(false)}>Not yet</button>
            </div>
          </div>
        )}

        {!docs.pending && (docs.pick || !result) && (
          <div className="capture">
            {isTouch ? <>
              <button className="capture__main" disabled={!session} onClick={() => cameraInput.current?.click()}><Camera size={22} aria-hidden /> Scan a document</button>
              <button className="link-btn" disabled={!session} onClick={() => fileInput.current?.click()}>Attach a file instead</button>
            </> : <>
              <button className="capture__main" disabled={!session} onClick={() => fileInput.current?.click()}><UploadIcon size={22} aria-hidden /> Upload documents</button>
              <small>or drop them anywhere on this screen</small>
            </>}
          </div>
        )}

        <div className="agent__controls">
          <button className={`mic-btn${mic.recording ? ' mic-btn--live' : ''}`}
            onClick={mic.recording ? mic.stop : () => void mic.start()}
            disabled={!mic.supported || (agent.busy && !mic.recording)}
            aria-label={mic.recording ? 'Stop and send' : 'Talk to the agent'}
            title={mic.supported ? undefined : 'The microphone needs HTTPS or localhost'}>
            {mic.recording ? <Square size={22} aria-hidden /> : <Mic size={24} aria-hidden />}
          </button>
          <form className="agent__type" onSubmit={(event) => { event.preventDefault(); send(text) }}>
            <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500}
              placeholder={mic.recording ? 'Listening… tap the square to send' : 'Try “attach file”'} aria-label="Message to the agent" />
            <button type="submit" className="icon-btn icon-btn--accent" disabled={!text.trim() || agent.busy} aria-label="Send"><ArrowUp size={18} aria-hidden /></button>
          </form>
        </div>
        {agent.heard && phase !== 'listening' && <p className="agent__heard">I heard: “{agent.heard}”</p>}
        {mic.error && <p className="agent__error" role="alert">{mic.error}</p>}
        {docs.serverFiles && docs.serverFiles.length > 0 && (
          <div className="agent__files" aria-label="Files folder">
            {docs.serverFiles.map((file) => (
              <button key={file.name} onClick={() => agent.importOne(file)} disabled={agent.busy || !file.kind}
                title={file.kind ? `Import as ${file.kind.replace('_', ' ')}` : 'Rename with order or delivery in the name to import'}>
                <FileText size={15} aria-hidden /> <span>{file.name}</span>{file.kind && <small>{file.kind === 'purchase_order' ? 'Order' : 'Delivery'}</small>}
              </button>
            ))}
          </div>
        )}
        {result && <div className="agent__prompts">
          {PROMPTS.map((prompt) => <button key={prompt} onClick={() => send(prompt)} disabled={agent.busy}>{prompt}</button>)}
        </div>}
      </div>

      <AgentBrief brief={brief} log={agent.log} reconciliationId={result?.id ?? null} onExport={agent.exportBrief} focus={agent.focus}>
        {session && !isDock && !isTouch && <>
          <p className="agent-brief__hint">Or scan from a phone:</p>
          <PairCard session={session} />
        </>}
      </AgentBrief>
    </div>
  )
}
