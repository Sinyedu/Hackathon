import { Check, CircleHelp, TriangleAlert } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { buildRows, isBad, wordsOf, type CompareRow, type RowStatus } from '../../lib/compare'
import type { LineItem, Reconciliation } from '../../types/reconciliation'

const ICON = { ok: Check, review: CircleHelp, short: TriangleAlert, over: TriangleAlert, missing: TriangleAlert, extra: TriangleAlert } as const
const TITLES = { purchase_order: 'Purchase order', delivery_note: 'Delivery note' } as const

/** Words that appear in both descriptions are marked, so a reader sees *why* two lines were paired. */
function Marked({ text, shared }: { text: string; shared: Set<string> }) {
  const parts = text.split(/([\p{L}\p{N}]+)/u)
  return <>{parts.map((part, index) => (index % 2 === 1 && shared.has(wordsOf(part)[0]) ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>))}</>
}

function Cell({ line, row, side, onProof }: { line: LineItem | null; row: CompareRow; side: 'po' | 'dn'; onProof: (id: string) => void }) {
  if (!line) {
    return <div className={`ccell ccell--${side} ccell--empty`} data-tag={side === 'po' ? 'Ordered' : 'Delivered'}><span>{row.status === 'review' ? 'Not paired yet' : side === 'po' ? 'Not ordered' : 'Not delivered'}</span></div>
  }
  const wrong = side === 'dn' && (row.status === 'short' || row.status === 'over')
  return (
    <button className={`ccell ccell--${side}`} data-tag={side === 'po' ? 'Ordered' : 'Delivered'} onClick={() => onProof(line.id)} aria-label={`Show ${line.description} on the original`}>
      <span className="ccell__name"><Marked text={line.description} shared={row.shared} /></span>
      <b className={wrong ? 'ccell__qty ccell__qty--wrong' : 'ccell__qty'}>{line.quantity} <small>{line.unit}</small></b>
    </button>
  )
}

const LABEL: Record<RowStatus, string> = { ok: 'Matches', review: 'Check', short: 'Problem', over: 'Problem', missing: 'Problem', extra: 'Problem' }

/** The two documents side by side. Pairs are joined by a line; problems and unchecked lines are marked. */
export default function DocumentCompare({ result, onProof }: { result: Reconciliation; onProof: (lineId: string) => void }) {
  const rows = useMemo(() => buildRows(result), [result])
  const names = (kind: keyof typeof TITLES) => result.documents.find((d) => d.kind === kind)?.filename ?? 'Waiting for document'
  return (
    <div className="compare">
      <div className="compare__legend" aria-hidden="true">
        <span><mark>word</mark> matched in both</span><span className="lg lg--ok">Matches</span><span className="lg lg--bad">Problem</span><span className="lg lg--review">Check</span>
      </div>
      <div className="compare__grid">
        <header className="chead chead--po"><h3>{TITLES.purchase_order}</h3><span>{names('purchase_order')}</span></header>
        <span className="chead__gap" aria-hidden />
        <header className="chead chead--dn"><h3>{TITLES.delivery_note}</h3><span>{names('delivery_note')}</span></header>
        {rows.map((row) => {
          const Icon = ICON[row.status]
          return (
            <div className={`crow crow--${isBad(row.status) ? 'bad' : row.status}`} role="group" aria-label={`${row.po?.description ?? row.dn?.description}: ${row.note}`} key={row.key}>
              <Cell line={row.po} row={row} side="po" onProof={onProof} />
              <div className="clink">
                <span className="clink__dot" title={row.note}><Icon size={15} aria-hidden /></span>
                <small>{LABEL[row.status]}</small>
              </div>
              <Cell line={row.dn} row={row} side="dn" onProof={onProof} />
              <p className="crow__note">{row.note}</p>
            </div>
          )
        })}
        {!rows.length && <p className="compare__empty">Nothing read yet. Add the documents and the lines appear here.</p>}
      </div>
    </div>
  )
}
