import { describe, expect, it } from 'vitest'
import { buildBrief } from './brief'
import { buildWalkthrough } from './walkthrough'
import { makeReconciliation } from '../test/fixtures'
import type { Session } from '../services/session'

const session = { id: 's', events: [], verdict: [] } as unknown as Session
const stepsFor = (rec = makeReconciliation()) => buildWalkthrough(rec, buildBrief(session, rec))

describe('buildWalkthrough', () => {
  it('states line counts from the data and starts with the headline', () => {
    const [first] = stepsFor()
    expect(first.text).toContain('1 line from the purchase order and 1 line from the delivery note')
    expect(first.text).toContain('Short 6 case')
    expect(first.terms).toEqual(['6', 'case'])
  })

  it('explains findings with the exact quantities and mentions plain arithmetic', () => {
    const findings = stepsFor().find((s) => s.focus === 'Findings')!
    expect(findings.text).toContain('ordered 24 case, delivered 18 case')
    expect(findings.text).toMatch(/plain arithmetic/)
  })

  it('adds a review step only when lines are unresolved', () => {
    expect(stepsFor().some((s) => s.selector.includes('review-line'))).toBe(false)
    const rec = makeReconciliation({ status: 'needs_review' })
    rec.matches[1] = { ...rec.matches[1], catalog_item_id: null, status: 'needs_review' }
    expect(stepsFor(rec).some((s) => s.selector.includes('review-line'))).toBe(true)
  })

  it('says a claim is only a draft until approved', () => {
    const rec = makeReconciliation({ claim: { id: 'c', status: 'draft', discrepancies: [], created_at: '2026-01-01T00:00:00Z', approved_at: null } })
    expect(stepsFor(rec).find((s) => s.focus === 'Claim')!.text).toMatch(/stays a draft until you approve/)
  })

  it('offers recovery only after a shortage', () => {
    expect(stepsFor().at(-1)!.text).toMatch(/find a replacement/)
    expect(stepsFor(makeReconciliation({ discrepancies: [] })).at(-1)!.text).toMatch(/That is everything/)
  })
})
