import { ExternalLink } from 'lucide-react'
import type { Offer } from '../../hooks/useAgent'

/** The agent's replacement suggestion with a real, followable link. Nothing is ordered from here. */
export default function OfferCard({ offer }: { offer: Offer }) {
  return (
    <section className="offer">
      <h2>{offer.supplier}</h2>
      <p>{offer.summary}</p>
      <a className="btn btn--primary" href={offer.url} target="_blank" rel="noreferrer">
        <ExternalLink size={16} aria-hidden /> {offer.isSearch ? 'Find this product online' : 'Open supplier page'}
      </a>
      <small>A suggestion only. Nothing is ordered or sent.</small>
    </section>
  )
}
