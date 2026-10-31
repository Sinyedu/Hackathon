import { describe, expect, it } from 'vitest'
import { buildRows, isBad, summarise, type CompareRow } from './compare'
import { wordsOf } from './compare'
import { makeReconciliation } from '../test/fixtures'

describe('wordsOf', () => {
  it('lowercases, splits on punctuation and stems plurals', () => {
    expect(wordsOf('Tomatoes, case 5 kg')).toEqual(['tomato', 'case', '5', 'kg'])
  })
  it('keeps unicode letters', () => expect(wordsOf('Æbler 1kg')).toEqual(['æbler', '1kg']))
})

describe('buildRows', () => {
  it('pairs matched lines and reports the backend shortage without recomputing it', () => {
    const [row] = buildRows(makeReconciliation())
    expect(row.status).toBe('short')
    expect(row.note).toBe('Short 6 case')
    expect(row.po?.id).toBe('l1')
    expect(row.dn?.id).toBe('l2')
    expect(row.shared.has('case')).toBe(true)
  })

  it('shows an over-delivery as extra', () => {
    const rec = makeReconciliation()
    rec.discrepancies[0].difference = '+3'
    expect(buildRows(rec)[0]).toMatchObject({ status: 'over', note: '3 case extra' })
  })

  it('is ok when there is no discrepancy for the product', () => {
    expect(buildRows(makeReconciliation({ discrepancies: [] }))[0]).toMatchObject({ status: 'ok', note: 'Matches' })
  })

  it('never silently reconciles an unmatched line: it needs review', () => {
    const rec = makeReconciliation()
    rec.matches[1] = { ...rec.matches[1], catalog_item_id: null, status: 'needs_review' }
    expect(buildRows(rec).every((r) => r.status === 'review')).toBe(true)
  })

  it('flags a purchase-order line missing from the delivery note once everything is matched', () => {
    const rec = makeReconciliation({ discrepancies: [] })
    rec.line_items.push({ ...rec.line_items[0], id: 'l3', description: 'Onions 10 kg', quantity: '5' })
    rec.matches.push({ source_line_id: 'l3', target_line_id: null, catalog_item_id: 'onion', method: 'exact', score: 1, status: 'matched' })
    expect(buildRows(rec).find((r) => r.key === 'l3')).toMatchObject({ status: 'missing', note: 'Not on the delivery note', dn: null })
  })

  it('flags a delivery-note line that was never ordered', () => {
    const rec = makeReconciliation({ discrepancies: [] })
    rec.line_items.push({ ...rec.line_items[1], id: 'l4', description: 'Leeks', quantity: '2' })
    rec.matches.push({ source_line_id: 'l4', target_line_id: null, catalog_item_id: 'leek', method: 'exact', score: 1, status: 'matched' })
    expect(buildRows(rec).find((r) => r.key === 'l4')).toMatchObject({ status: 'extra', note: 'Not on the purchase order' })
  })
})

describe('summarise / isBad', () => {
  const row = (status: CompareRow['status']): CompareRow => ({ key: status, po: null, dn: null, status, note: '', shared: new Set() })

  it('counts ok, bad and review separately', () => {
    expect(summarise([row('ok'), row('short'), row('missing'), row('review')])).toEqual({ ok: 1, bad: 2, review: 1 })
  })
  it('review is not bad', () => {
    expect(isBad('review')).toBe(false)
    expect(isBad('ok')).toBe(false)
    expect(isBad('over')).toBe(true)
  })
})
