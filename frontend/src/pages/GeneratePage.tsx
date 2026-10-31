import { useState } from 'react'
import ChaosDock from '../components/ChaosDock'
import { revealAnswer, type Session } from '../services/session'

interface Props { session: Session; onError: (message: string) => void; onOpenAgent: () => void }

/** Synthetic test deliveries and their hidden answer keys, kept away from the main agent screen. */
export default function GeneratePage({ session, onError, onOpenAgent }: Props) {
  const [revealed, setRevealed] = useState<Awaited<ReturnType<typeof revealAnswer>> | null>(null)
  return <>
    <ChaosDock session={session} onError={onError} />
    <p className="muted">Printed deliveries are read automatically. <button className="link-btn" onClick={onOpenAgent}>Go to the agent</button> to hear what it finds.</p>
    {session.delivery_id && (
      <div className="reveal">
        <button className="btn btn--quiet" onClick={() => void revealAnswer(session.id).then(setRevealed).catch((cause: unknown) => onError((cause as Error).message))}>Reveal the answer key</button>
        {revealed && <ul>{revealed.comparison.map((item, index) => <li key={index} className={item.found ? 'found' : 'missed'}><b>{item.found ? 'Found' : 'Missed'}</b> {item.type} · {item.catalog_item_id} · {item.amount}</li>)}</ul>}
      </div>
    )}
  </>
}
