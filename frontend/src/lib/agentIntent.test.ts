import { describe, expect, it } from 'vitest'
import { intentOf, kindSaid, pickFiles, sectionFor, sheetTabFor, stripWake, wantsCamera } from './agentIntent'
import type { LocalFile } from '../services/session'

describe('intentOf', () => {
  it.each([
    ['walk me through it', 'walkthrough'],
    ['approve the claim', 'approve'],
    ['export the brief', 'export'],
    ['make a test delivery', 'generate'],
    ['show me the purchase order', 'show'],
    ['upload my files', 'files'],
    ['find a replacement supplier', 'recover'],
    ['give me a summary', 'brief'],
    ['what is missing?', 'findings'],
    ['how much does a tomato weigh', 'ask'],
  ])('%j -> %s', (text, intent) => expect(intentOf(text)).toBe(intent))

  it('matches commands locally and case-insensitively, so approval never depends on model wording', () => {
    expect(intentOf('Please APPROVE this')).toBe('approve')
  })
})

describe('stripWake', () => {
  it.each([
    ['hey agent, what is missing', 'what is missing'],
    ['Okay DockProof: approve', 'approve'],
    ['hi dock proof show me', 'show me'],
    ['what is missing', 'what is missing'],
  ])('%j -> %j', (input, output) => expect(stripWake(input)).toBe(output))
})

describe('kindSaid / sheetTabFor / wantsCamera / sectionFor', () => {
  it('reads which document the user means', () => {
    expect(kindSaid('it is the purchase order')).toBe('purchase_order')
    expect(kindSaid('the delivery note')).toBe('delivery_note')
    expect(kindSaid('no idea')).toBeNull()
  })
  it('picks the first sheet tab', () => {
    expect(sheetTabFor('show the PO')).toBe('purchase_order')
    expect(sheetTabFor('show the delivery note')).toBe('delivery_note')
    expect(sheetTabFor('show them side by side')).toBe('compare')
  })
  it('detects camera requests', () => {
    expect(wantsCamera('take a photo')).toBe(true)
    expect(wantsCamera('open the files')).toBe(false)
  })
  it('maps requests to briefing windows', () => {
    expect(sectionFor('show the evidence')).toBe('Evidence from the scans')
    expect(sectionFor('open the claim')).toBe('Claim')
    expect(sectionFor('hello')).toBeNull()
  })
})

describe('pickFiles', () => {
  const files: LocalFile[] = [
    { name: 'purchase_order.pdf', size: 1, kind: 'purchase_order' },
    { name: 'purchase_order_old.pdf', size: 1, kind: 'purchase_order' },
    { name: 'delivery_note.pdf', size: 1, kind: 'delivery_note' },
  ]
  const names = (result: ReturnType<typeof pickFiles>) => (result === 'ambiguous' ? result : result.map((f) => f.name))

  it('"both" takes one file of each kind', () => {
    expect(names(pickFiles('open both', files))).toEqual(['purchase_order.pdf', 'delivery_note.pdf'])
  })
  it('picks the best name match', () => {
    expect(names(pickFiles('open purchase_order_old', files))).toEqual(['purchase_order_old.pdf'])
  })
  it('returns nothing when no file matches', () => expect(pickFiles('open the invoice', files)).toEqual([]))
  it('asks instead of guessing when two files tie', () => expect(pickFiles('open the purchase order', files)).toBe('ambiguous'))
})
