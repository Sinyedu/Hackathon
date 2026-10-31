import { useMemo, useState } from 'react'
import { isValidQuantity, normalizeQuantity } from '../lib/quantity'
import type { Corrections, LineItem, Reconciliation } from '../types/reconciliation'

type Field = 'description' | 'quantity' | 'unit'
type Edits = Record<string, Partial<Record<Field, string>>>
/** string = catalog id, null = "not in the catalog" */
type Choices = Record<string, string | null>

export function useCorrections(rec: Reconciliation) {
  const [edits, setEdits] = useState<Edits>({})
  const [choices, setChoices] = useState<Choices>({})
  const lines = useMemo(() => new Map(rec.line_items.map((l) => [l.id, l])), [rec])

  const setField = (line: LineItem, field: Field, value: string) =>
    setEdits((prev) => {
      const next = { ...prev, [line.id]: { ...prev[line.id] } }
      if (value === line[field]) delete next[line.id][field]
      else next[line.id][field] = value
      if (Object.keys(next[line.id]).length === 0) delete next[line.id]
      return next
    })

  const setChoice = (lineId: string, value: string | null | undefined) =>
    setChoices((prev) => {
      const next = { ...prev }
      if (value === undefined) delete next[lineId]
      else next[lineId] = value
      return next
    })

  const invalid = new Set<string>()
  for (const [id, e] of Object.entries(edits)) {
    if (e.quantity !== undefined && !isValidQuantity(e.quantity)) invalid.add(id)
    if (e.description !== undefined && e.description.trim() === '') invalid.add(id)
  }

  const payload = (): Corrections | null => {
    const lineEdits = Object.entries(edits).map(([line_id, e]) => ({
      line_id,
      ...(e.description !== undefined && { description: e.description }),
      ...(e.quantity !== undefined && { quantity: normalizeQuantity(e.quantity) }),
      ...(e.unit !== undefined && { unit: e.unit }),
    }))
    const matches = Object.entries(choices)
      .filter(([id]) => lines.has(id))
      .map(([line_id, catalog_item_id]) => ({ line_id, catalog_item_id }))
    return lineEdits.length || matches.length ? { lines: lineEdits, matches } : null
  }

  const reset = () => {
    setEdits({})
    setChoices({})
  }

  return { edits, choices, setField, setChoice, invalid, payload, reset, dirty: payload() !== null }
}
