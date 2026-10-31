import { Mic, Radio, Square, Volume2, VolumeX, X } from 'lucide-react'
import { useState } from 'react'
import '../agent.css'
import type { useAgent } from '../hooks/useAgent'
import { useRecorder } from '../hooks/useRecorder'
import { canSpeak, stopSpeaking } from '../lib/speak'
import AgentCards from './AgentCards'
import AgentOrb from './AgentOrb'
import CardDetail from './CardDetail'

/** Full-screen agent: orb + "Speak with agent" + floating cards. Voice stays on the local backend (Whisper + Qwen). */
interface Props {
  reconciliationId: string
  agent: ReturnType<typeof useAgent>
  handsFree: boolean
  capturing: boolean
  micError: string | null
  onHandsFree: (on: boolean) => void
  onClose: () => void
}

export default function AgentStage({ reconciliationId, agent, handsFree, capturing, micError, onHandsFree, onClose }: Props) {
  const [text, setText] = useState('')
  const busy = agent.stage === 'thinking' || agent.stage === 'transcribing'
  const mic = useRecorder((audio) => void agent.hear(audio, false))
  const stage = mic.recording || capturing ? 'listening' : agent.stage
  const open = agent.cards.find((c) => c.id === agent.openId)
  const problem = mic.error ?? micError ?? agent.error

  const leave = () => { agent.close(); onClose() }
  const speakNow = () => { if (mic.recording) return mic.stop(); stopSpeaking(); agent.setStage('listening'); void mic.start() }
  const send = (e: React.FormEvent) => { e.preventDefault(); if (text.trim() && !busy) { void agent.ask(text.trim()); setText('') } }

  return (
    <div className="agent-stage" role="dialog" aria-label="Agent">
      <button className="agent-close" onClick={leave} aria-label="Close agent"><X className="mx-auto size-5" aria-hidden /></button>
      <AgentOrb stage={stage} />
      <div className="agent-say">
        {agent.heard && <p className="agent-heard">“{agent.heard}”</p>}
        {agent.awaiting && <p>Go ahead, I'm listening…</p>}
        {!agent.heard && !agent.awaiting && !agent.reply && <p>{handsFree ? 'Say “Hey agent” and ask, or tap a card.' : 'Ask me about this delivery, or tap a card below.'}</p>}
        {agent.reply && !agent.openId && <p>{agent.reply}</p>}
      </div>
      <div className="agent-controls">
        <button className={`agent-speak ${mic.recording ? 'agent-speak--on' : ''}`} onClick={speakNow} disabled={!mic.supported || (busy && !mic.recording)}
          title={mic.supported ? undefined : 'The microphone needs HTTPS or localhost. You can type instead.'}>
          {mic.recording ? <><Square className="mr-2 inline size-4" aria-hidden />Stop</> : <><Mic className="mr-2 inline size-4" aria-hidden />Speak with agent</>}
        </button>
        <button className="agent-toggle" aria-pressed={handsFree} disabled={!mic.supported} onClick={() => onHandsFree(!handsFree)}>
          <Radio className="size-4" aria-hidden />{handsFree ? 'Hands-free on' : 'Hands-free off'}
        </button>
        {canSpeak && (
          <button className="agent-toggle" aria-pressed={agent.aloud} aria-label="Read answers aloud" onClick={() => { if (agent.aloud) stopSpeaking(); agent.setAloud(!agent.aloud) }}>
            {agent.aloud ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}Voice
          </button>
        )}
      </div>
      <form className="agent-type" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a question" aria-label="Question" maxLength={500} />
      </form>
      {problem && <p role="alert" className="agent-error">{problem}</p>}
      <AgentCards cards={agent.cards} openId={agent.openId} onOpen={agent.open} />
      {open && <CardDetail card={open} reconciliationId={reconciliationId} explanation={agent.explanations[open.id]} busy={busy} onClose={() => agent.setOpenId(null)} />}
    </div>
  )
}
