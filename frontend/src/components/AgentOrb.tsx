import type { Stage } from '../hooks/useAgent'

const LABELS: Record<Stage, string> = {
  idle: 'Ready',
  listening: 'Listening',
  transcribing: 'Transcribing',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

export default function AgentOrb({ stage }: { stage: Stage }) {
  return (
    <>
      <div className={`agent-orb agent-orb--${stage}`} role="img" aria-label={`Agent: ${LABELS[stage]}`} />
      <p className="agent-status" role="status">{LABELS[stage]}</p>
    </>
  )
}
