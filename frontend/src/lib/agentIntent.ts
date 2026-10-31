import type { LocalFile } from '../services/session'

export type Intent = 'brief' | 'findings' | 'elaborate' | 'recover' | 'export' | 'approve' | 'generate' | 'link' | 'show' | 'files' | 'import' | 'ask'

// Commands are matched locally so actions never depend on the model's wording.
// Anything that is not a command goes to the local model as a question.
const RULES: [Intent, RegExp][] = [
  ['approve', /\b(approve|sign (it )?off|accept the claim)\b/i],
  ['export', /\b(export|download|save (the )?(brief|briefing|report|summary))\b/i],
  ['link', /\b(replacement link|(open|follow|show)\b.*\b(link|supplier page)|where (can|do) i (buy|order|get))\b/i],
  ['generate', /\b(test deliver\w*|(generate|print|make|create) (me )?(a |the |some )?(delivery|deliveries|test|files?|documents?))\b/i],
  ['show', /\b((show|view|see|display|pull up)\b.*\b(documents?|receipts?|pdfs?|scans?|originals?|comparison|side by side|purchase order|delivery note)|(open|show) the (comparison|receipts?|pdfs?|originals?)|side by side)\b/i],
  ['files', /\b(attach|upload|my files|take a (photo|picture)|camera|scan (a|the|this|it)|add (a |the |some )?(file|files|document|documents|scan|scans)|choose (a )?files?|(open|list|check)\b.*\b(files|folder)|what files)\b/i],
  ['import', /\b(import|load|bring in|open (the )?(purchase|delivery|po|dn|both))\b/i],
  ['elaborate', /\b(elaborate|more detail|in detail|details? (on|about)|tell me more|explain|expand|walk me through|show me the (findings|evidence|claim|review|documents))\b/i],
  ['recover', /\b(replace|replacement|recover|alternative|other supplier|reorder|re-order)\b/i],
  ['brief', /\b(summary|summari[sz]e|status|what'?s happening|what is happening|brief|update me|catch me up)\b/i],
  ['findings', /\b(missing|short|shortage|discrepanc\w*|problem|wrong)\b/i],
]

/** Drops a spoken wake phrase like "hey agent," so it does not get in the way of the command. */
export const stripWake = (text: string) => text.replace(/^\s*(hey|hi|ok|okay)[\s,]+(agent|dock ?proof)[\s,.!:]*/i, '').trim()

export function intentOf(text: string): Intent {
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? 'ask'
}

export type Kind = 'purchase_order' | 'delivery_note'

/** Same naming rule as the backend's files service. */
export function guessKind(name: string): Kind | null {
  const lowered = name.toLowerCase()
  if (/purchase|order|(^|[^a-z])po([^a-z]|$)/.test(lowered)) return 'purchase_order'
  if (/delivery|dispatch|packing|(^|[^a-z])dn([^a-z]|$)/.test(lowered)) return 'delivery_note'
  return null
}

/** "it's the delivery note" style answers to "which document is this?". */
export function kindSaid(text: string): Kind | null {
  if (/\b(purchase|order|po)\b/i.test(text)) return 'purchase_order'
  if (/\b(delivery|note|dn)\b/i.test(text)) return 'delivery_note'
  return null
}

/** Which original to show first for "show the purchase order" / "show the delivery note". */
export const sheetTabFor = (text: string): 'compare' | 'purchase_order' | 'delivery_note' =>
  /\b(purchase order|po)\b/i.test(text) ? 'purchase_order' : /\b(delivery note|dn)\b/i.test(text) ? 'delivery_note' : 'compare'

export const wantsCamera = (text: string) => /\b(scan|photo|picture|camera)\b/i.test(text)

/** The briefing window a request is about; null when it names none. */
export function sectionFor(text: string): string | null {
  const rules: [RegExp, string][] = [
    [/evidence|source|proof/i, 'Evidence from the scans'],
    [/review|check|match/i, 'Needs review'],
    [/claim/i, 'Claim'],
    [/document|file/i, 'Documents'],
    [/next|what do i do/i, 'Next step'],
    [/finding|missing|short|problem|discrepanc/i, 'Findings'],
  ]
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null
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
  reading: 'Alright boss, I will process it. Reading the documents now.',
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
