import type { Brief } from './brief'
import type { Reconciliation } from '../types/reconciliation'

/** focus: the briefing window to open first; selector/terms: what to outline and which words to mark. */
export interface Step { text: string; selector: string; terms: string[]; focus?: string }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const clean = (value: string) => value.replace(/:/g, ',')

/**
 * What the agent says after a delivery has been analysed, and what it points at on the agent page while
 * saying it. Built from the stored results only (no model), so it cannot say anything the data does not show.
 */
export function buildWalkthrough(result: Reconciliation, brief: Brief): Step[] {
  const has = (title: string) => brief.sections.some((s) => s.title === title)
  const count = (kind: string) => result.line_items.filter((l) => l.source_document_id === result.documents.find((d) => d.kind === kind)?.id).length
  const shortages = result.discrepancies.filter((d) => d.difference.startsWith('-'))
  const openReview = result.matches.filter((m) => m.status !== 'matched')
  const steps: Step[] = [{
    selector: '.agent-brief__body h2, .agent-brief__body .tone-chip', terms: shortages[0] ? [shortages[0].difference.slice(1), shortages[0].unit] : [],
    text: `I read ${plural(count('purchase_order'), 'line')} from the purchase order and ${plural(count('delivery_note'), 'line')} from the delivery note. The headline at the top of the briefing is the main result: ${brief.headline}.`,
  }]
  if (result.discrepancies.length && has('Findings')) {
    steps.push({
      focus: 'Findings', selector: '#window-findings', terms: result.discrepancies.flatMap((d) => [`${d.ordered_quantity}`, `${d.delivered_quantity}`, d.description]),
      text: `The Findings window is why the result says that. ${result.discrepancies.map((d) => `${clean(d.description)}: ordered ${d.ordered_quantity} ${d.unit}, delivered ${d.delivered_quantity} ${d.unit}`).join('. ')}. I compare quantities with plain arithmetic, not guesswork.`,
    })
  }
  if (openReview.length) {
    const first = result.line_items.find((l) => l.id === openReview[0].source_line_id)
    steps.push({
      selector: '.review-line, .question, #window-needs-review', terms: first ? [first.description] : [], focus: has('Needs review') ? 'Needs review' : undefined,
      text: `${plural(openReview.length, 'line')} could not be matched with confidence, so I ask you instead of guessing. Pick the right product, and I finish the comparison.`,
    })
  }
  if (result.claim && has('Claim')) {
    steps.push({
      focus: 'Claim', selector: '#window-claim', terms: ['Draft', 'Approved', 'No.'],
      text: 'The Claim window shows the draft claim. Nothing leaves this machine. It stays a draft until you approve it.',
    })
  }
  if (has('Evidence from the scans')) {
    steps.push({
      focus: 'Evidence from the scans', selector: '#window-evidence-from-the-scans', terms: result.discrepancies.flatMap((d) => [`${d.ordered_quantity} ${d.unit}`, `${d.delivered_quantity} ${d.unit}`]),
      text: 'The Evidence window quotes the exact text I read from each scan, so you can check my numbers. The scan links open the originals.',
    })
  }
  steps.push({
    focus: has('Next step') ? 'Next step' : undefined, selector: '#window-next-step', terms: [],
    text: shortages.length ? 'Ask me to find a replacement, and I search the supplier catalog. It only suggests; nothing is ordered.' : 'That is everything. Ask me anything about the delivery.',
  })
  return steps
}
