import { ArrowUp, Maximize2, Mic, Paperclip, PanelRight, SkipForward, Square, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAgent } from '../../hooks/useAgent'
import { KIND_LABEL } from '../../lib/fileKind'
import { canSpeak } from '../../lib/speak'
import type { Brief } from '../../lib/brief'
import type { Session } from '../../services/session'
import type { Reconciliation } from '../../types/reconciliation'
import AgentBrief from './AgentBrief'
import ParticleOrb from './ParticleOrb'

const STATE = { idle: 'Ready', listening: 'Listening…', thinking: 'Working…', speaking: 'Speaking' } as const
const PROMPTS = ['Catch me up', 'Walk me through it', 'What is missing?']

interface Props {
  session: Session | null; result: Reconciliation | null; brief: Brief; wake: string | null
  refresh: (id: string) => Promise<void>; onClose: () => void
}

export default function AgentMode({ session, result, brief, wake, refresh, onClose }: Props) {
  const agent = useAgent({ open: true, wake, session, result, brief, refresh })
  const [text, setText] = useState('')
  const [details, setDetails] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const { mic, caption, phase } = agent
  const docked = agent.dock

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    document.body.classList.toggle('agent-docked', docked)
    return () => document.body.classList.remove('agent-docked')
  }, [docked])

  const send = (value: string) => {
    setText('')
    void agent.handle(value)
  }
  const spoken = caption.text.slice(0, caption.at)
  const upcoming = caption.text.slice(caption.at)
  const caps = <><span>{spoken}</span><span className="agent__caption-next">{upcoming}</span></>

  if (docked) {
    return (
      <div className="agent-dock" role="region" aria-label="DockProof agent" aria-live="polite">
        <ParticleOrb className="agent-dock__orb" phase={phase} level={mic.level} pulse={agent.pulse} dots={140} />
        <p className="agent-dock__text">{caps}</p>
        <div className="agent-dock__actions">
          {agent.touring && <button className="icon-btn" onClick={agent.skipTour} aria-label="Stop the tour" title="Stop the tour"><SkipForward size={18} aria-hidden /></button>}
          <button className="icon-btn" onClick={() => agent.setDock(false)} aria-label="Open the full agent" title="Ask something"><Maximize2 size={18} aria-hidden /></button>
          <button className="icon-btn" onClick={onClose} aria-label="Close agent"><X size={20} aria-hidden /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="agent" role="dialog" aria-modal="true" aria-label="DockProof agent">
      <header className="agent__bar">
        <span className="agent__name">DockProof agent</span>
        <div className="agent__bar-actions">
          <button className="icon-btn" onClick={() => setDetails(!details)} aria-pressed={details} aria-label="Details" title="Briefing and conversation"><PanelRight size={18} aria-hidden /></button>
          {canSpeak && (
            <button className="icon-btn" onClick={agent.toggleMute} aria-pressed={agent.muted} aria-label={agent.muted ? 'Turn voice on' : 'Mute voice'}>
              {agent.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close agent"><X size={20} aria-hidden /></button>
        </div>
      </header>

      <div className={`agent__stage${details ? '' : ' agent__stage--solo'}`}>
        <div className="agent__voice">
          <ParticleOrb className="agent__orb" phase={phase} level={mic.level} pulse={agent.pulse} />
          <p className={`agent__state agent__state--${phase}`} role="status">{STATE[phase]}</p>
          <p className="agent__caption" aria-live="polite">{caps}</p>

          {agent.confirming && (
            <div className="agent__confirm">
              <p>Approve the draft claim? It is saved as approved. Nothing is sent to the supplier.</p>
              <div>
                <button className="btn btn--primary" disabled={agent.busy} onClick={() => void agent.confirmApproval()}>Confirm approval</button>
                <button className="btn btn--quiet" onClick={() => agent.setConfirming(false)}>Not yet</button>
              </div>
            </div>
          )}

          {agent.unsorted.map((file) => (
            <div className="agent__confirm" key={file.name}>
              <p>{file.name}: which document is this?</p>
              <div>
                {(['purchase_order', 'delivery_note'] as const).map((kind) => (
                  <button key={kind} className="btn btn--quiet" onClick={() => void agent.assign(file, kind)} disabled={agent.busy}>{KIND_LABEL[kind]}</button>
                ))}
              </div>
            </div>
          ))}

          <form className="agent__composer" onSubmit={(event) => { event.preventDefault(); send(text) }}>
            <input ref={picker} type="file" multiple hidden accept="image/*,.pdf"
              onChange={(event) => { void agent.chooseFiles([...(event.target.files ?? [])]); event.target.value = '' }} />
            <button type="button" className={`icon-btn${agent.choosing ? ' agent-spot' : ''}`} onClick={() => picker.current?.click()} disabled={agent.busy}
              aria-label="Choose files" title="Choose your purchase order and delivery note"><Paperclip size={18} aria-hidden /></button>
            <input type="text" value={text} onChange={(event) => setText(event.target.value)} maxLength={500} aria-label="Message to the agent"
              placeholder={mic.recording ? 'Listening… tap the square to send' : 'Say “Hey agent”, or type here'} />
            <button type="button" className={`icon-btn${mic.recording ? ' icon-btn--live' : ''}`} onClick={mic.recording ? mic.stop : () => void mic.start()}
              disabled={!mic.supported || (agent.busy && !mic.recording)} aria-label={mic.recording ? 'Stop and send' : 'Talk to the agent'}
              title={mic.supported ? undefined : 'The microphone needs HTTPS or localhost'}>
              {mic.recording ? <Square size={18} aria-hidden /> : <Mic size={18} aria-hidden />}
            </button>
            <button type="submit" className="icon-btn icon-btn--accent" disabled={!text.trim() || agent.busy} aria-label="Send"><ArrowUp size={18} aria-hidden /></button>
          </form>
          {mic.error && <p className="agent__error" role="alert">{mic.error}</p>}
          <div className="agent__prompts">
            {PROMPTS.map((prompt) => <button key={prompt} onClick={() => send(prompt)} disabled={agent.busy}>{prompt}</button>)}
          </div>
        </div>

        {details && <AgentBrief brief={brief} log={agent.log} reconciliationId={result?.id ?? null} onExport={agent.exportBrief} />}
      </div>
    </div>
  )
}
