import { ArrowUp, FileText, Mic, Square, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAgent } from '../../hooks/useAgent'
import { canSpeak } from '../../lib/speak'
import type { Brief } from '../../lib/brief'
import type { Session } from '../../services/session'
import type { Reconciliation } from '../../types/reconciliation'
import AgentBrief from './AgentBrief'
import ParticleOrb from './ParticleOrb'

const STATUS = { idle: 'Ready', listening: 'Listening', thinking: 'Working', speaking: 'Speaking' } as const
const PROMPTS = ['Catch me up', 'Open my files', 'What is missing?', 'Find a replacement', 'Export the briefing']

interface Props { session: Session | null; result: Reconciliation | null; brief: Brief; refresh: (id: string) => Promise<void>; onClose: () => void }

export default function AgentMode({ session, result, brief, refresh, onClose }: Props) {
  const agent = useAgent({ open: true, session, result, brief, refresh })
  const [text, setText] = useState('')
  const micButton = useRef<HTMLButtonElement>(null)
  const { mic, caption, phase } = agent

  useEffect(() => {
    micButton.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = (value: string) => {
    setText('')
    void agent.handle(value)
  }
  const spoken = caption.text.slice(0, caption.at)
  const upcoming = caption.text.slice(caption.at)

  return (
    <div className="agent" role="dialog" aria-modal="true" aria-label="DockProof agent">
      <header className="agent__bar">
        <span className="agent__name">DockProof agent</span>
        <span className={`agent__status agent__status--${phase}`}><i aria-hidden /> {STATUS[phase]}</span>
        <div className="agent__bar-actions">
          {canSpeak && (
            <button className="icon-btn" onClick={agent.toggleMute} aria-pressed={agent.muted} aria-label={agent.muted ? 'Turn voice on' : 'Mute voice'}>
              {agent.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close agent"><X size={20} aria-hidden /></button>
        </div>
      </header>

      <div className="agent__stage">
        <div className="agent__voice">
          <ParticleOrb className="agent__orb" phase={phase} level={mic.level} pulse={agent.pulse} />
          <p className="agent__caption" aria-live="polite">
            <span>{spoken}</span><span className="agent__caption-next">{upcoming}</span>
          </p>

          {agent.confirming && (
            <div className="agent__confirm">
              <p>Approve the draft claim? It is saved as approved. Nothing is sent to the supplier.</p>
              <div>
                <button className="btn btn--primary" disabled={agent.busy} onClick={() => void agent.confirmApproval()}>Confirm approval</button>
                <button className="btn btn--quiet" onClick={() => agent.setConfirming(false)}>Not yet</button>
              </div>
            </div>
          )}

          <div className="agent__controls">
            <button ref={micButton} className={`mic-btn${mic.recording ? ' mic-btn--live' : ''}`}
              onClick={mic.recording ? mic.stop : () => void mic.start()}
              disabled={!mic.supported || (agent.busy && !mic.recording)}
              aria-label={mic.recording ? 'Stop and send' : 'Talk to the agent'}
              title={mic.supported ? undefined : 'The microphone needs HTTPS or localhost'}>
              {mic.recording ? <Square size={22} aria-hidden /> : <Mic size={24} aria-hidden />}
            </button>
            <form className="agent__type" onSubmit={(event) => { event.preventDefault(); send(text) }}>
              <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500}
                placeholder={mic.recording ? 'Listening… tap the square to send' : 'Try “import both files”'} aria-label="Message to the agent" />
              <button type="submit" className="icon-btn icon-btn--accent" disabled={!text.trim() || agent.busy} aria-label="Send"><ArrowUp size={18} aria-hidden /></button>
            </form>
          </div>
          {mic.error && <p className="agent__error" role="alert">{mic.error}</p>}
          {agent.files && agent.files.length > 0 && (
            <div className="agent__files" aria-label="Your files">
              {agent.files.map((file) => (
                <button key={file.name} onClick={() => agent.importOne(file)} disabled={agent.busy || !file.kind}
                  title={file.kind ? `Import as ${file.kind.replace('_', ' ')}` : 'Rename with order or delivery in the name to import'}>
                  <FileText size={15} aria-hidden /> <span>{file.name}</span>{file.kind && <small>{file.kind === 'purchase_order' ? 'Order' : 'Delivery'}</small>}
                </button>
              ))}
            </div>
          )}
          <div className="agent__prompts">
            {PROMPTS.map((prompt) => <button key={prompt} onClick={() => send(prompt)} disabled={agent.busy}>{prompt}</button>)}
          </div>
        </div>

        <AgentBrief brief={brief} log={agent.log} reconciliationId={result?.id ?? null} onExport={agent.exportBrief} />
      </div>
    </div>
  )
}
