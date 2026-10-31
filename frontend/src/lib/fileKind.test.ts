import { describe, expect, it } from 'vitest'
import { guessKind } from './fileKind'
import { guessKind as guessKindAgent } from './agentIntent'

const CASES: [string, 'purchase_order' | 'delivery_note' | null][] = [
  ['purchase_order.png', 'purchase_order'],
  ['PO-1234.pdf', 'purchase_order'],
  ['my po.jpg', 'purchase_order'],
  ['delivery_note.pdf', 'delivery_note'],
  ['DN_17.png', 'delivery_note'],
  ['packing-slip.jpg', 'delivery_note'],
  ['IMG_0101.jpg', null],
  ['photo.png', null],
  ['position.png', null], // "po" inside a word is not a purchase order
]

describe('guessKind', () => {
  it.each(CASES)('%s -> %s', (name, kind) => {
    expect(guessKind(name)).toBe(kind)
    expect(guessKindAgent(name)).toBe(kind) // both copies must follow the backend rule
  })
})
