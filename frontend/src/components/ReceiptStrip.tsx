import type { LineItem } from '../types/reconciliation'

export default function ReceiptStrip({ title, lines, angle = 'left' }: { title: string; lines: LineItem[]; angle?: 'left' | 'right' }) {
  return <section className={`receipt-strip receipt-strip--${angle}`} aria-label={title}>
    <header><span>DOCKPROOF / SOURCE</span><strong>{title}</strong></header>
    <div className="receipt-lines">{lines.length ? lines.map(line => <div className="receipt-line" key={line.id}>
      <span>{line.description}</span><b>{line.quantity} {line.unit}</b>
    </div>) : <p className="receipt-empty">Waiting for document</p>}</div>
    <footer>VERIFIED FROM SOURCE TEXT</footer>
  </section>
}
