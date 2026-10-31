import { ExternalLink, X } from 'lucide-react'
import { documentFileUrl } from '../services/api'
import type { AgentCard } from '../types/assistant'

/** Highlight quantities and prices; pack sizes like "5 kg" are part of the product name, so they stay plain. */
function Highlight({ text }: { text: string }) {
  return <>{text.split(/(\d+(?:[.,]\d+)?(?!\d|\s?(?:kg|g|l|L)\b))/).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
}

interface Props {
  card: AgentCard
  reconciliationId: string
  explanation: { text: string; grounded: boolean } | undefined
  busy: boolean
  onClose: () => void
}

export default function CardDetail({ card, reconciliationId, explanation, busy, onClose }: Props) {
  const url = card.document_id ? documentFileUrl(reconciliationId, card.document_id) : null
  return (
    <div className="agent-sheet-back" onClick={onClose}>
      <section className="agent-sheet" role="dialog" aria-label={card.title} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="float-right rounded-full p-2 hover:bg-slate-100"><X className="size-5" aria-hidden /></button>
        <small className="section-label">{card.kind.toUpperCase()}</small>
        <h2>{card.title}</h2>
        <p className="text-slate-600">{card.subtitle}</p>
        {url && (
          <>
            <img src={url} alt={`Scan: ${card.title}`} />
            <a href={url} target="_blank" rel="noreferrer" className="proof-link inline-flex items-center gap-1">Open original scan <ExternalLink className="size-3.5" aria-hidden /></a>
          </>
        )}
        <div className="agent-sum" aria-live="polite">
          {explanation ? <Highlight text={explanation.text} /> : busy ? 'The agent is reading this…' : 'Ask the agent about this card.'}
        </div>
        {explanation && !explanation.grounded && <p className="text-xs text-amber-700">The AI's wording was rejected because it did not match the scan data, so this summary comes straight from the stored results.</p>}
        <p className="section-label">KEY POINTS</p>
        <ul className="agent-facts">{card.facts.map((f) => <li key={f}><Highlight text={f} /></li>)}</ul>
        <p className="text-xs text-slate-500">Key points come straight from the scan results; the summary is written by the local AI from the same data.</p>
      </section>
    </div>
  )
}
