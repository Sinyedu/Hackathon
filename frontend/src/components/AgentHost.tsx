import { Mic } from 'lucide-react'
import { useEffect, useState } from 'react'
import '../agent.css'
import { useAgent } from '../hooks/useAgent'
import { useHandsFree } from '../hooks/useHandsFree'
import AgentStage from './AgentStage'

const KEY = 'dockproof.handsfree'
const micAvailable = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

function loadPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off' // on unless the user turned it off
  } catch {
    return true
  }
}

/**
 * Owns the agent for a result screen. Hands-free listening is on by default: saying "Hey agent"
 * opens the stage and then listens until you have been silent for 3 seconds.
 */
export default function AgentHost({ reconciliationId }: { reconciliationId: string }) {
  const [open, setOpen] = useState(false)
  const [handsFree, setHandsFree] = useState(loadPref)
  const agent = useAgent(reconciliationId, () => setOpen(true))
  const busy = agent.stage === 'thinking' || agent.stage === 'transcribing' || agent.stage === 'speaking'
  const hands = useHandsFree(handsFree && micAvailable, busy, (audio) => void agent.hear(audio, true))

  useEffect(() => {
    try {
      localStorage.setItem(KEY, handsFree ? 'on' : 'off')
    } catch {
      /* preference just isn't remembered */
    }
  }, [handsFree])

  return (
    <>
      <button className="agent-fab" onClick={() => setOpen(true)} aria-label="Open the agent">
        <Mic className="mr-2 inline size-4" aria-hidden />
        {handsFree && micAvailable ? 'Say “Hey agent”' : 'Ask agent'}
        {hands.capturing && <span className="agent-fab-dot" aria-label="listening" />}
      </button>
      {open && (
        <AgentStage reconciliationId={reconciliationId} agent={agent} handsFree={handsFree && micAvailable}
          capturing={hands.capturing} micError={hands.error} onHandsFree={setHandsFree}
          onClose={() => { agent.close(); setOpen(false) }} />
      )}
    </>
  )
}
