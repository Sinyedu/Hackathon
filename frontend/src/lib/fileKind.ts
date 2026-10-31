export type DocKind = 'purchase_order' | 'delivery_note'

export const KIND_LABEL: Record<DocKind, string> = { purchase_order: 'purchase order', delivery_note: 'delivery note' }

/** Best guess from the file name only; null means "ask the user". Mirrors backend files.guess_kind. */
export function guessKind(name: string): DocKind | null {
  const lowered = name.toLowerCase()
  if (/purchase|order|(^|[^a-z])po([^a-z]|$)/.test(lowered)) return 'purchase_order'
  if (/delivery|dispatch|packing|(^|[^a-z])dn([^a-z]|$)/.test(lowered)) return 'delivery_note'
  return null
}
