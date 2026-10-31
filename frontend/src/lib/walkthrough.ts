import type { Reconciliation } from '../types/reconciliation'

export interface Step { text: string; selector: string; terms: string[] }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const clean = (value: string) => value.replace(/[:]/g, ',')

/**
 * What the agent says after a delivery has been analysed, and what it points at while saying it.
 * Built from the stored results only (no model), so it cannot say anything the data does not show.
 */
export function buildWalkthrough(result: Reconciliation, isDock = false): Step[] {
  const doc = (kind: string) => result.documents.find((d) => d.kind === kind)
  const count = (kind: string) => result.line_items.filter((l) => l.source_document_id === doc(kind)?.id).length
  const shortages = result.discrepancies.filter((d) => d.difference.startsWith('-'))
  const flagged = new Set(result.discrepancies.map((d) => d.catalog_item_id))
  const matchOf = new Map(result.matches.map((m) => [m.source_line_id, m.catalog_item_id]))
  const offLines = result.line_items.filter((l) => flagged.has(matchOf.get(l.id) ?? ''))
  const open = result.matches.filter((m) => m.status === 'needs_review' && m.catalog_item_id)
  const steps: Step[] = []

  const first = shortages[0]
  steps.push({
    selector: '.verdict__head h1, .verdict__head p',
    terms: first ? [first.difference.slice(1), first.unit] : [],
    text: first
      ? `Here is the result. You are ${shortages.length === 1 ? `${first.difference.slice(1)} ${first.unit} short on ${clean(first.description)}` : `short on ${plural(shortages.length, 'line')}`}. This headline is the main finding, and everything below explains it.`
      : result.status === 'needs_review' ? 'Here is the result. A few lines need your eyes before I can be sure.' : 'Here is the result. Everything checks out against the order.',
  })
  steps.push({
    selector: '.source-columns', terms: [],
    text: `These two columns are what I read from your scans. Ordered comes from the purchase order, ${plural(count('purchase_order'), 'line')}. Delivered comes from the delivery note, ${plural(count('delivery_note'), 'line')}. Tap any line to see it on the scan.`,
  })
  if (offLines.length) {
    steps.push({
      selector: '.source-line--off', terms: offLines.flatMap((l) => [l.description, `${l.quantity} ${l.unit}`]),
      text: `The highlighted rows are why the headline says what it does. ${result.discrepancies.map((d) => `${clean(d.description)}: ordered ${d.ordered_quantity} ${d.unit}, delivered ${d.delivered_quantity} ${d.unit}`).join('. ')}.`,
    })
  }
  if (open.length) {
    const lines = open[0] && result.line_items.find((l) => l.id === open[0].source_line_id)
    steps.push({
      selector: '.question', terms: lines ? [lines.description] : [],
      text: `I am not sure about ${plural(open.length, 'product')}, so I ask instead of guessing. The same item is written differently on the two documents. Please confirm whether they match, so I can finish the comparison.`,
    })
  }
  if (result.claim) {
    steps.push({
      selector: '.verdict__head .btn--primary', terms: [],
      text: 'A draft claim is ready. It lists the mismatch and the quantities. Nothing is sent to the supplier; only you can approve it.',
    })
  }
  if (shortages.length && !isDock) {
    steps.push({
      selector: '.recovery-anchor', terms: [],
      text: 'To fix the shortage, Find Recovery Options searches the supplier catalog for a replacement and ranks the choices. It only suggests; nothing is ordered.',
    })
  }
  if (result.warnings.length) {
    steps.push({
      selector: '.notes', terms: [],
      text: `I also left ${plural(result.warnings.length, 'note')} from reading the scans, for example lines that were hard to read. They are worth a look.`,
    })
  }
  return steps
}
