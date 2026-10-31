import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'

// The agent's briefing is assembled from validated backend data only: no model wording,
// no new arithmetic. Quantities are copied as the backend returned them.

export type BriefTone = 'waiting' | 'problem' | 'review' | 'ok' | 'approved'
export interface BriefRow { label: string; value: string; note?: string; alert?: boolean }
export interface BriefSection { title: string; rows: BriefRow[] }
export interface Brief { tone: BriefTone; headline: string; spoken: string; sections: BriefSection[] }

const KIND = { purchase_order: 'Purchase order', delivery_note: 'Delivery note', invoice: 'Invoice' } as const
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const magnitude = (difference: string) => difference.replace(/^[-+]/, '')

export function claimValue(session: Session): string | null {
  const rows = session.verdict.filter((row) => Number(row.shortage) > 0 || Number(row.note_overstated) > 0)
  if (!rows.length || rows.some((row) => row.claim_cents === null)) return null
  return `€${(rows.reduce((sum, row) => sum + (row.claim_cents ?? 0), 0) / 100).toFixed(2)}`
}

export function buildBrief(session: Session | null, result: Reconciliation | null): Brief {
  if (!session || !result) {
    const reading = session?.events.at(-1)?.type === 'reading'
    return {
      tone: 'waiting',
      headline: reading ? 'Reading your documents' : 'Waiting for documents',
      spoken: reading
        ? 'I am reading your documents now. I will tell you what I find.'
        : 'I am ready. Add a purchase order and a delivery note, or scan them from the dock phone, and I will check them for you.',
      sections: [],
    }
  }

  const shortages = result.discrepancies.filter((d) => d.difference.startsWith('-'))
  const extras = result.discrepancies.filter((d) => !d.difference.startsWith('-'))
  const reviewLines = result.matches.filter((m) => m.status !== 'matched')
  const approved = result.claim?.status === 'approved'
  const tone: BriefTone = approved ? 'approved' : shortages.length || extras.length ? 'problem' : result.status === 'needs_review' ? 'review' : 'ok'
  const first = shortages[0]
  const headline = approved
    ? 'Claim approved and saved'
    : first
      ? `Short ${magnitude(first.difference)} ${first.unit}: ${first.description}`
      : extras.length ? `${plural(extras.length, 'item')} over-delivered`
        : result.status === 'needs_review' ? 'A few lines need your eyes' : 'Everything matches'

  const findings: BriefRow[] = result.discrepancies.map((d) => ({
    label: d.description,
    value: d.difference.startsWith('-') ? `Short ${magnitude(d.difference)} ${d.unit}` : `+${magnitude(d.difference)} ${d.unit} extra`,
    note: `Ordered ${d.ordered_quantity} · Delivered ${d.delivered_quantity}`,
    alert: true,
  }))
  const lineById = new Map(result.line_items.map((line) => [line.id, line]))
  const review: BriefRow[] = [
    ...reviewLines.map((m) => ({ label: lineById.get(m.source_line_id)?.description ?? 'Unreadable line', value: m.status === 'unmatched' ? 'No match' : 'Check match' })),
    ...result.warnings.map((w) => ({ label: 'Note', value: w })),
  ]
  const evidence: BriefRow[] = result.discrepancies.flatMap((d) => d.evidence.map((source) => ({ label: d.description, value: source })))
  const value = claimValue(session)
  const claim: BriefRow[] = result.claim
    ? [
        { label: 'Status', value: approved ? 'Approved' : 'Draft, waiting for you' },
        { label: 'Claim value', value: value ?? 'Price unknown' },
        { label: 'Created', value: new Date(result.claim.created_at).toLocaleString() },
        ...(result.claim.approved_at ? [{ label: 'Approved', value: new Date(result.claim.approved_at).toLocaleString() }] : []),
        { label: 'Sent to supplier', value: 'No. Nothing leaves this machine.' },
      ]
    : []

  const next = approved
    ? 'Done. Export the briefing for your records.'
    : reviewLines.length && result.status !== 'ready'
      ? 'Confirm the lines that need review, then approve the claim.'
      : result.claim ? 'Review the draft claim and approve it if it looks right.'
        : 'Nothing to claim. You can file this delivery.'

  const spoken = [
    `I compared ${plural(result.line_items.length, 'line')} across ${plural(result.documents.length, 'document')}.`,
    approved ? 'The claim is approved and saved.'
      : findings.length ? findings.map((f) => `${f.label}: ${f.value.toLowerCase()}, ${f.note?.replace(' · ', ', ').toLowerCase()}.`).join(' ')
        : 'Every quantity matches.',
    reviewLines.length && !approved ? `${plural(reviewLines.length, 'line')} still need${reviewLines.length === 1 ? 's' : ''} your review.` : '',
    next,
  ].filter(Boolean).join(' ')

  return {
    tone, headline, spoken,
    sections: [
      { title: 'Findings', rows: findings.length ? findings : [{ label: 'Quantities', value: 'All match' }] },
      { title: 'Needs review', rows: review },
      { title: 'Claim', rows: claim },
      { title: 'Evidence from the scans', rows: evidence },
      { title: 'Documents', rows: result.documents.map((doc) => ({ label: KIND[doc.kind], value: doc.filename })) },
      { title: 'Next step', rows: [{ label: 'Next', value: next }] },
    ].filter((section) => section.rows.length > 0),
  }
}

export function briefToMarkdown(brief: Brief, reconciliationId: string | null): string {
  const lines = [`# DockProof briefing: ${brief.headline}`, '', `Generated ${new Date().toLocaleString()}${reconciliationId ? ` · Reconciliation ${reconciliationId}` : ''}`, '']
  for (const section of brief.sections) {
    lines.push(`## ${section.title}`, '')
    for (const row of section.rows) lines.push(`- **${row.label}:** ${row.value}${row.note ? ` (${row.note})` : ''}`)
    lines.push('')
  }
  lines.push('_Quantities are read from the scans by OCR and calculated by DockProof, not by the AI model._')
  return lines.join('\n')
}
