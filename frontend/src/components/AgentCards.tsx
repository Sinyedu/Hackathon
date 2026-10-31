import type { AgentCard } from '../types/assistant'

const KIND = { document: 'Document', discrepancy: 'Problem', recovery: 'Recovery', claim: 'Claim' } as const
const TILTS = [-2.2, 1.6, -1.2, 2.4, -1.8, 1.1]

/** Floating receipt-style cards. Tap or click one to have the agent explain it. */
export default function AgentCards({ cards, openId, onOpen }: { cards: AgentCard[]; openId: string | null; onOpen: (c: AgentCard) => void }) {
  return (
    <div className="agent-cards" role="list" aria-label="Things the agent can explain">
      {cards.map((c, i) => (
        <button key={c.id} role="listitem" onClick={() => onOpen(c)}
          className={`agent-card ${c.kind === 'discrepancy' ? 'agent-card--problem' : ''} ${openId === c.id ? 'agent-card--open' : ''}`}
          style={{ '--i': i, '--tilt': `${TILTS[i % TILTS.length]}deg` } as React.CSSProperties}>
          <small>{KIND[c.kind]}</small>
          <strong>{c.title}</strong>
          <span>{c.facts[0] ?? c.subtitle}</span>
        </button>
      ))}
    </div>
  )
}
