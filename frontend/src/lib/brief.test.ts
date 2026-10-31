import { describe, expect, it } from 'vitest'
import { briefToMarkdown, buildBrief, claimValue } from './brief'
import { makeReconciliation } from '../test/fixtures'
import type { CountVerdict, Session } from '../services/session'

const verdict = (over: Partial<CountVerdict> = {}): CountVerdict => ({
  catalog_item_id: 'tomato', description: 'Tomatoes', unit: 'case', line_ids: ['l1'], ordered: '24', noted: '18',
  counted: null, received: '18', shortage: '6', note_overstated: '0', over_delivery: '0', claim_cents: 1080, ...over,
})
const session = (rows: CountVerdict[] = [verdict()], events: Session['events'] = []): Session => ({
  id: 's', events, aliases: {}, rejected: [], counts: {}, verdict: rows, reconciliation_id: 'rec-1',
  claim_fingerprint: null, deliveries: [], generated: [], delivery_id: null,
})
const claim = (status: 'draft' | 'approved') => ({
  id: 'c1', status, discrepancies: [], created_at: '2026-01-01T10:00:00Z', approved_at: status === 'approved' ? '2026-01-01T11:00:00Z' : null,
})

describe('buildBrief', () => {
  it('waits when there is no result, and says when it is reading', () => {
    expect(buildBrief(null, null)).toMatchObject({ tone: 'waiting', headline: 'Waiting for documents', sections: [] })
    expect(buildBrief(session([], [{ id: 1, type: 'reading', data: {} }]), null).headline).toBe('Reading your documents')
  })

  it('headlines the shortage with the backend quantity', () => {
    const brief = buildBrief(session(), makeReconciliation({ claim: claim('draft') }))
    expect(brief.tone).toBe('problem')
    expect(brief.headline).toBe('Short 6 case: Tomatoes, case 5 kg')
    expect(brief.spoken).toContain('short 6 case')
    expect(brief.sections.map((s) => s.title)).toEqual(['Findings', 'Claim', 'Evidence from the scans', 'Documents', 'Next step'])
  })

  it('shows evidence with the document role instead of its id', () => {
    const rec = makeReconciliation()
    rec.discrepancies[0].evidence = ['po: Tomatoes, case 5 kg 24', 'dn: Tomato Box 5KG 18'].map((s) => s.replace('po:', 'x purchase_order:').replace('dn:', 'x delivery_note:'))
    const evidence = buildBrief(session(), rec).sections.find((s) => s.title.startsWith('Evidence'))!
    expect(evidence.rows.map((r) => r.value)).toEqual(['Purchase order: Tomatoes, case 5 kg 24', 'Delivery note: Tomato Box 5KG 18'])
  })

  it('is draft until approved, and never claims it was sent', () => {
    const draft = buildBrief(session(), makeReconciliation({ claim: claim('draft') }))
    const rows = draft.sections.find((s) => s.title === 'Claim')!.rows
    expect(rows.find((r) => r.label === 'Status')?.value).toBe('Draft, waiting for you')
    expect(rows.find((r) => r.label === 'Sent to supplier')?.value).toMatch(/^No/)
    const done = buildBrief(session(), makeReconciliation({ claim: claim('approved') }))
    expect(done).toMatchObject({ tone: 'approved', headline: 'Claim approved and saved' })
  })

  it('reports everything matching when there are no discrepancies', () => {
    const brief = buildBrief(session([]), makeReconciliation({ discrepancies: [] }))
    expect(brief).toMatchObject({ tone: 'ok', headline: 'Everything matches' })
    expect(brief.spoken).toContain('Every quantity matches.')
  })

  it('lists lines needing review and asks for confirmation first', () => {
    const rec = makeReconciliation({ status: 'needs_review', discrepancies: [], warnings: ['Low OCR confidence'] })
    rec.matches[1] = { ...rec.matches[1], catalog_item_id: null, status: 'unmatched' }
    const brief = buildBrief(session([]), rec)
    expect(brief.tone).toBe('review')
    expect(brief.sections.find((s) => s.title === 'Needs review')!.rows).toEqual([
      { label: 'Tomato Box 5KG', value: 'No match' },
      { label: 'Note', value: 'Low OCR confidence' },
    ])
    expect(brief.sections.at(-1)!.rows[0].value).toMatch(/Confirm the lines/)
  })
})

describe('claimValue', () => {
  it('sums cents into euros', () => {
    expect(claimValue(session([verdict({ claim_cents: 1080 }), verdict({ claim_cents: 250 })]))).toBe('€13.30')
  })
  it('is null when there is nothing to claim', () => {
    expect(claimValue(session([verdict({ shortage: '0', claim_cents: 0 })]))).toBeNull()
  })
  it('is null when any price is unknown (never a guessed total)', () => {
    expect(claimValue(session([verdict(), verdict({ claim_cents: null })]))).toBeNull()
  })
})

describe('briefToMarkdown', () => {
  it('renders sections, the reconciliation id and the OCR disclaimer', () => {
    const md = briefToMarkdown(buildBrief(session(), makeReconciliation()), 'rec-1')
    expect(md).toContain('# DockProof briefing: Short 6 case')
    expect(md).toContain('Reconciliation rec-1')
    expect(md).toContain('- **Tomatoes, case 5 kg:** Short 6 case (Ordered 24 · Delivered 18)')
    expect(md).toMatch(/not by the AI model/)
  })
})
