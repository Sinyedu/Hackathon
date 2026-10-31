import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import type { CatalogItem, LineItem, Match } from '../types/reconciliation'

const NONE = '__none__'
const INPUT = 'w-full rounded-md border px-2 py-1.5 text-sm'

interface Props {
  line: LineItem
  match: Match | undefined
  catalog: CatalogItem[]
  edit: Partial<Record<'description' | 'quantity' | 'unit', string>> | undefined
  choice: string | null | undefined
  invalid: boolean
  disabled: boolean
  onField: (field: 'description' | 'quantity' | 'unit', value: string) => void
  onChoice: (value: string | null | undefined) => void
}

function MatchBadge({ match }: { match: Match | undefined }) {
  if (match?.status === 'matched') {
    return <span className="flex items-center gap-1 text-xs text-emerald-700"><CircleCheck className="size-4" aria-hidden />Matched ({match.method})</span>
  }
  if (match?.status === 'needs_review') {
    return <span className="flex items-center gap-1 text-xs text-amber-700"><CircleHelp className="size-4" aria-hidden />Needs review</span>
  }
  return <span className="flex items-center gap-1 text-xs text-red-700"><CircleX className="size-4" aria-hidden />No product</span>
}

export default function LineRow({ line, match, catalog, edit, choice, invalid, disabled, onField, onChoice }: Props) {
  const current = match?.catalog_item_id ?? ''
  const selected = choice === undefined ? current : choice === null ? NONE : choice
  const change = (value: string) =>
    onChoice(value === NONE ? null : value === '' || value === current ? undefined : value)

  return (
    <li className={`rounded-lg border p-3 ${invalid ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-slate-500" title={line.source_text}>Scanned: {line.source_text}</p>
        {(line.corrected || edit) && <span className="rounded bg-indigo-100 px-1.5 text-xs text-indigo-700">edited</span>}
      </div>
      <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
        <input aria-label="Description" className={INPUT} value={edit?.description ?? line.description}
          disabled={disabled} onChange={(e) => onField('description', e.target.value)} />
        <input aria-label="Quantity" inputMode="decimal" className={INPUT} value={edit?.quantity ?? line.quantity}
          disabled={disabled} onChange={(e) => onField('quantity', e.target.value)} />
        <input aria-label="Unit" className={INPUT} value={edit?.unit ?? line.unit}
          disabled={disabled} onChange={(e) => onField('unit', e.target.value)} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <MatchBadge match={match} />
        <select aria-label="Product" value={selected} disabled={disabled} onChange={(e) => change(e.target.value)}
          className="max-w-[60%] rounded-md border px-2 py-1.5 text-sm">
          <option value="">Choose product…</option>
          {catalog.map((c) => <option key={c.id} value={c.id}>{c.description}</option>)}
          <option value={NONE}>Not in catalog</option>
        </select>
      </div>
    </li>
  )
}
