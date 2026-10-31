import { describe, expect, it } from 'vitest'
import { intentOf, kindSaid, pickFiles, stripWake } from './agentIntent'
import { buildBrief, claimValue } from './brief'
import { buildRows, summarise, wordsOf } from './compare'
import { errorMessage } from './errors'
import { guessKind } from './fileKind'
import { isValidQuantity, normalizeQuantity } from './quantity'
import { buildWalkthrough } from './walkthrough'
import { makeReconciliation } from '../test/fixtures'
import type { CountVerdict, Session, LocalFile } from '../services/session'

const session = (verdict: CountVerdict[] = []) => ({ id: 's', events: [], verdict }) as unknown as Session
const verdict = (over: Partial<CountVerdict> = {}): CountVerdict => ({
  catalog_item_id: 't', description: 'T', unit: 'case', line_ids: [], ordered: '24', noted: '18', counted: null,
  received: '18', shortage: '6', note_overstated: '0', over_delivery: '0', claim_cents: 100, ...over,
})

describe('quantity edge cases', () => {
  it.each(['٣', '１２', '1 000', '१', '+5', '5-', '--', '5.5.5', '\n', '€5'])('rejects non-ASCII or malformed %j', (text) => {
    expect(isValidQuantity(text)).toBe(false)
  })
  it('accepts leading zeros and a leading decimal digit', () => {
    expect(isValidQuantity('00')).toBe(true)
    expect(isValidQuantity('0,5')).toBe(true)
  })
  it('only swaps the first comma, so a bad value stays visibly invalid', () => {
    expect(normalizeQuantity('2,5,1')).toBe('2.5,1')
    expect(isValidQuantity('2,5,1')).toBe(false)
  })
})

describe('errorMessage edge cases', () => {
  it.each([null, undefined, 42, {}])('gives a generic message for %j', (value) => expect(errorMessage(value)).toBe('Something went wrong'))
  it('treats a TypeError subclass of failed fetch as a network problem', () => {
    class NetworkError extends TypeError {}
    expect(errorMessage(new NetworkError('x'))).toMatch(/backend/)
  })
})

describe('guessKind edge cases', () => {
  it.each([['', null], ['.pdf', null], ['   ', null], ['PURCHASE ORDER.PNG', 'purchase_order'], ['Delivery.Note.pdf', 'delivery_note']])(
    '%j -> %s', (name, kind) => expect(guessKind(name)).toBe(kind),
  )
  it('prefers purchase order when a name contains both words (documented tie-break)', () => {
    expect(guessKind('delivery_order.pdf')).toBe('purchase_order')
  })
  it('does not treat "po"/"dn" inside a word as a document code', () => {
    expect(guessKind('podium.png')).toBeNull()
    expect(guessKind('sundn.png')).toBeNull()
  })
})

describe('intent edge cases and priorities', () => {
  it.each(['', '   ', '???'])('falls back to a question for %j', (text) => expect(intentOf(text)).toBe('ask'))
  it('approve outranks export when both are said, so no export happens by accident', () => {
    expect(intentOf('approve the claim and export it')).toBe('approve')
  })
  it('"explain the screen" is a walkthrough, not an elaboration', () => expect(intentOf('explain the screen')).toBe('walkthrough'))
  it('a wake phrase alone leaves an empty command', () => expect(stripWake('hey agent')).toBe(''))
  it('only strips a wake phrase at the start', () => expect(stripWake('tell hey agent hello')).toBe('tell hey agent hello'))
  it('kind resolution: purchase wins when both are mentioned', () => {
    expect(kindSaid('delivery note for the purchase order')).toBe('purchase_order')
  })
  const files: LocalFile[] = [{ name: 'a.pdf', size: 1, kind: 'purchase_order' }, { name: 'b.pdf', size: 1, kind: null }]
  it('"both" with no files returns nothing and with one kind returns just that', () => {
    expect(pickFiles('both', [])).toEqual([])
    expect(pickFiles('both', files)).toEqual([files[0]])
  })
  it('an empty request selects nothing', () => expect(pickFiles('', files)).toEqual([]))
})

describe('wordsOf edge cases', () => {
  it('returns nothing for empty or symbol-only text', () => {
    expect(wordsOf('')).toEqual([])
    expect(wordsOf('--- ,,, !!!')).toEqual([])
  })
  it('does not strip the "s" from short words', () => expect(wordsOf('gas')).toEqual(['gas']))
})

describe('buildRows edge cases', () => {
  it('returns no rows for an empty reconciliation', () => {
    const rows = buildRows(makeReconciliation({ line_items: [], matches: [], discrepancies: [] }))
    expect(rows).toEqual([])
    expect(summarise(rows)).toEqual({ ok: 0, bad: 0, review: 0 })
  })
  it('ignores lines whose document is unknown rather than guessing their side', () => {
    const rec = makeReconciliation()
    rec.line_items[0].source_document_id = 'ghost'
    expect(buildRows(rec).every((r) => r.po === null)).toBe(true)
  })
  it('pairs duplicate products one-to-one without reusing a delivery line', () => {
    const rec = makeReconciliation({ discrepancies: [] })
    rec.line_items.push({ ...rec.line_items[0], id: 'l5' }, { ...rec.line_items[1], id: 'l6' })
    for (const id of ['l5', 'l6']) rec.matches.push({ source_line_id: id, target_line_id: null, catalog_item_id: 'tomato', method: 'exact', score: 1, status: 'matched' })
    const rows = buildRows(rec)
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((r) => r.dn?.id)).size).toBe(2)
  })
  it('a matched line with no catalog id is still treated as unresolved', () => {
    const rec = makeReconciliation()
    rec.matches[0] = { ...rec.matches[0], catalog_item_id: null }
    expect(buildRows(rec).some((r) => r.status === 'review')).toBe(true)
  })
  it('a line with no match record at all needs review', () => {
    const rec = makeReconciliation({ matches: [] })
    expect(buildRows(rec).every((r) => r.status === 'review')).toBe(true)
  })
  it('does not pair a product with a delivery line of a different product', () => {
    const rec = makeReconciliation({ discrepancies: [] })
    rec.matches[1] = { ...rec.matches[1], catalog_item_id: 'leek' }
    expect(buildRows(rec).map((r) => r.status).sort()).toEqual(['extra', 'missing'])
  })
})

describe('buildBrief edge cases', () => {
  it('headlines an over-delivery and pluralises', () => {
    const one = makeReconciliation()
    one.discrepancies[0].difference = '+3'
    expect(buildBrief(session(), one)).toMatchObject({ tone: 'problem', headline: '1 item over-delivered' })
    one.discrepancies.push({ ...one.discrepancies[0], catalog_item_id: 'x', description: 'Leeks' })
    expect(buildBrief(session(), one).headline).toBe('2 items over-delivered')
  })
  it('describes an over-delivery finding as extra', () => {
    const rec = makeReconciliation()
    rec.discrepancies[0].difference = '+3'
    const finding = buildBrief(session(), rec).sections.find((s) => s.title === 'Findings')!.rows[0]
    expect(finding.value).toBe('+3 case extra')
  })
  it('uses singular wording for one open review line', () => {
    const rec = makeReconciliation({ status: 'needs_review', discrepancies: [] })
    rec.matches[1] = { ...rec.matches[1], catalog_item_id: null, status: 'needs_review' }
    const brief = buildBrief(session(), rec)
    expect(brief.headline).toBe('A few lines need your eyes')
    expect(brief.spoken).toContain('1 line still needs your review.')
    expect(brief.sections.find((s) => s.title === 'Needs review')!.rows[0].value).toBe('Check match')
  })
  it('falls back to a placeholder for a review line that is not in the extracted lines', () => {
    const rec = makeReconciliation({ status: 'needs_review', discrepancies: [] })
    rec.matches.push({ source_line_id: 'gone', target_line_id: null, catalog_item_id: null, method: 'fuzzy', score: 0.1, status: 'unmatched' })
    const rows = buildBrief(session(), rec).sections.find((s) => s.title === 'Needs review')!.rows
    expect(rows.some((r) => r.label === 'Unreadable line')).toBe(true)
  })
  it('does not mention open review lines once the claim is approved', () => {
    const rec = makeReconciliation({ status: 'needs_review', claim: { id: 'c', status: 'approved', discrepancies: [], created_at: '2026-01-01T00:00:00Z', approved_at: '2026-01-01T01:00:00Z' } })
    rec.matches[1] = { ...rec.matches[1], catalog_item_id: null, status: 'needs_review' }
    expect(buildBrief(session(), rec).spoken).not.toContain('still need')
  })
  it('shows "Price unknown" when a price is missing, never a guessed value', () => {
    const rec = makeReconciliation({ claim: { id: 'c', status: 'draft', discrepancies: [], created_at: '2026-01-01T00:00:00Z', approved_at: null } })
    const rows = buildBrief(session([verdict({ claim_cents: null })]), rec).sections.find((s) => s.title === 'Claim')!.rows
    expect(rows.find((r) => r.label === 'Claim value')?.value).toBe('Price unknown')
  })
  it('shows an approval time only for approved claims', () => {
    const base = { id: 'c', discrepancies: [], created_at: '2026-01-01T00:00:00Z' }
    const labels = (claim: NonNullable<ReturnType<typeof makeReconciliation>['claim']>) =>
      buildBrief(session(), makeReconciliation({ claim })).sections.find((s) => s.title === 'Claim')!.rows.map((r) => r.label)
    expect(labels({ ...base, status: 'draft', approved_at: null })).not.toContain('Approved')
    expect(labels({ ...base, status: 'approved', approved_at: '2026-01-01T01:00:00Z' })).toContain('Approved')
  })
  it('copes with a result that has no lines or documents', () => {
    const brief = buildBrief(session(), makeReconciliation({ line_items: [], matches: [], discrepancies: [], documents: [] }))
    expect(brief.spoken).toContain('I compared 0 lines across 0 documents.')
    expect(brief.sections.some((s) => s.title === 'Documents')).toBe(false)
  })
})

describe('claimValue edge cases', () => {
  it('counts an over-stated delivery note as claimable', () => {
    expect(claimValue(session([verdict({ shortage: '0', note_overstated: '2', claim_cents: 500 })]))).toBe('€5.00')
  })
  it('is null for no verdict rows at all', () => expect(claimValue(session([]))).toBeNull())
  it('ignores an unpriced row that has nothing to claim', () => {
    expect(claimValue(session([verdict(), verdict({ shortage: '0', claim_cents: null })]))).toBe('€1.00')
  })
  it('keeps two decimals', () => expect(claimValue(session([verdict({ claim_cents: 5 })]))).toBe('€0.05'))
})

describe('buildWalkthrough edge cases', () => {
  const stepsFor = (rec = makeReconciliation()) => buildWalkthrough(rec, buildBrief(session(), rec))
  it('is just an intro and a closing step when everything matches', () => {
    const steps = stepsFor(makeReconciliation({ discrepancies: [] }))
    expect(steps).toHaveLength(2)
    expect(steps[0].terms).toEqual([])
    expect(steps.some((s) => s.focus === 'Findings')).toBe(false)
  })
  it('does not name a product for a review line it cannot find', () => {
    const rec = makeReconciliation({ status: 'needs_review', discrepancies: [] })
    rec.matches.push({ source_line_id: 'gone', target_line_id: null, catalog_item_id: null, method: 'fuzzy', score: 0, status: 'unmatched' })
    const review = stepsFor(rec).find((s) => s.selector.includes('review-line'))!
    expect(review.terms).toEqual([])
    expect(review.text).toMatch(/1 line could not be matched/)
  })
  it('pluralises line counts', () => {
    const rec = makeReconciliation()
    rec.line_items.push({ ...rec.line_items[0], id: 'extra' })
    expect(stepsFor(rec)[0].text).toContain('2 lines from the purchase order')
  })
})
