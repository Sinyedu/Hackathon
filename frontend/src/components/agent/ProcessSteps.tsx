import { Check, LoaderCircle } from 'lucide-react'
import type { Session } from '../../services/session'

type State = 'done' | 'active' | 'pending'

/** What the agent is doing right now, taken from the session's real events (nothing is simulated). */
function stepsFor(events: Session['events']): { label: string; state: State }[] | null {
  const last = events.at(-1)?.type
  if (last !== 'reading' && last !== 'extracted' && !(last === 'delivery_received' && events.at(-1)?.data.delivery_id)) return null
  const stage = last === 'extracted' ? 2 : last === 'reading' ? 1 : 0
  const state = (index: number): State => (index < stage ? 'done' : index === stage ? 'active' : 'pending')
  return [
    { label: 'Documents received', state: stage === 0 ? 'active' : 'done' },
    { label: 'Reading the lines and matching products', state: state(1) },
    { label: 'Checking quantities and preparing the briefing', state: state(2) },
  ]
}

export default function ProcessSteps({ events }: { events: Session['events'] }) {
  const steps = stepsFor(events)
  if (!steps) return null
  return (
    <ol className="steps" aria-label="Progress">
      {steps.map((step) => (
        <li key={step.label} className={`steps__item steps__item--${step.state}`}>
          <span className="steps__mark">{step.state === 'done' ? <Check size={14} aria-hidden /> : step.state === 'active' ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : null}</span>
          {step.label}
        </li>
      ))}
    </ol>
  )
}
