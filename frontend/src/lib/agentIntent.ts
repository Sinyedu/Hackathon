import type { LocalFile } from '../services/session'

export type Intent = 'walkthrough' | 'brief' | 'findings' | 'recover' | 'export' | 'approve' | 'files' | 'import' | 'ask'

// Commands are matched locally so actions never depend on the model's wording.
// Anything that is not a command goes to the local model as a question.
const RULES: [Intent, RegExp][] = [
  ['walkthrough', /\b(walk me through|walkthrough|explain (the |this )?(screen|page|result)|what am i (looking at|seeing)|show me around|give me a tour)\b/i],
  ['approve', /\b(approve|sign (it )?off|accept the claim)\b/i],
  ['export', /\b(export|download|save (the )?(brief|briefing|report|summary))\b/i],
  ['import', /\b(import|load|bring in|open (the )?(purchase|delivery|po|dn|both))\b/i],
  ['files', /\b(my files|(open|show|list|check)\b.*\b(files|folder|documents)|what files)\b/i],
  ['recover', /\b(replace|replacement|recover|alternative|other supplier|reorder|re-order)\b/i],
  ['brief', /\b(summary|summari[sz]e|status|what'?s happening|what is happening|brief|update me|catch me up)\b/i],
  ['findings', /\b(missing|short|shortage|discrepanc\w*|problem|wrong)\b/i],
]

/** Drops a spoken wake phrase like "hey agent," so it does not get in the way of the command. */
export const stripWake = (text: string) => text.replace(/^\s*(hey|hi|ok|okay)[\s,]+(agent|dock ?proof)[\s,.!:]*/i, '').trim()

export function intentOf(text: string): Intent {
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? 'ask'
}

const words = (text: string) => text.toLowerCase().replace(/\.[a-z0-9]+$/, '').split(/[^a-z0-9]+/).filter((w) => w.length > 1)
const KIND_WORDS = { purchase_order: /\b(purchase|order|po)\b/i, delivery_note: /\b(delivery|note|dn)\b/i } as const

/** Files the request names: "both" takes one of each kind; otherwise the best name or kind match. */
export function pickFiles(text: string, files: LocalFile[]): LocalFile[] | 'ambiguous' {
  if (/\b(both|all|everything|the pair)\b/i.test(text)) {
    return (['purchase_order', 'delivery_note'] as const).flatMap((kind) => files.filter((f) => f.kind === kind).slice(0, 1))
  }
  const said = new Set(words(text))
  const scored = files.map((file) => ({
    file,
    score: words(file.name).filter((w) => said.has(w)).length * 2 + (file.kind && KIND_WORDS[file.kind].test(text) ? 1 : 0),
  })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  if (!scored.length) return []
  if (scored.length > 1 && scored[0].score === scored[1].score) return 'ambiguous'
  return [scored[0].file]
}

/** One plain sentence per live session event, spoken while the agent is open. */
export const EVENT_LINES: Record<string, string> = {
  printed_to_dock: 'A new delivery was printed to the dock.',
  delivery_received: 'Documents received. Reading them now.',
  reading: 'Reading the documents.',
  extracted: 'I have pulled the lines out of the scans.',
  matching: 'Matching products between the order and the delivery note.',
  question: 'I need you to confirm a product match.',
  answered: 'Thanks. Updating the comparison.',
  claim_drafted: 'A draft claim is ready for your review.',
  claim_approved: 'The claim is approved and saved.',
  phone_connected: 'The dock phone is connected.',
  failed: 'I could not read one of the documents. Please check the scan.',
  reset: 'The session was reset.',
}
