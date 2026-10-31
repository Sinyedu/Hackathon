import { Check, ChevronDown, Copy, Download } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { briefToMarkdown, type Brief } from '../../lib/brief'
import ScanLinks from '../ScanLinks'
import type { AgentLine } from '../../hooks/useAgent'

const TONE_LABEL = { waiting: 'Waiting', problem: 'Discrepancy', review: 'Needs review', ok: 'All good', approved: 'Approved' } as const
const slug = (title: string) => `window-${title.toLowerCase().replace(/\W+/g, '-')}`

interface Props {
  brief: Brief
  log: AgentLine[]
  reconciliationId: string | null
  onExport: () => void
  /** A window the agent is talking about; it opens and scrolls into view. */
  focus: { title: string; at: number } | null
  /** Shown while there is nothing to brief yet. */
  children?: ReactNode
}

export default function AgentBrief({ brief, log, reconciliationId, onExport, focus, children }: Props) {
  const [view, setView] = useState<'brief' | 'talk'>('brief')
  const [open, setOpen] = useState<Set<string>>(() => new Set(['Findings']))
  const [copied, setCopied] = useState(false)

  // Derived during render: when the agent focuses a window, show the briefing tab with it open.
  const [seenFocus, setSeenFocus] = useState(focus)
  if (focus !== seenFocus) {
    setSeenFocus(focus)
    if (focus) {
      setView('brief')
      setOpen((current) => new Set(current).add(focus.title))
    }
  }
  useEffect(() => {
    if (!focus) return
    const frame = requestAnimationFrame(() => document.getElementById(slug(focus.title))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    return () => cancelAnimationFrame(frame)
  }, [focus])

  const copy = async () => {
    await navigator.clipboard.writeText(briefToMarkdown(brief, reconciliationId))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  const toggle = (title: string, isOpen: boolean) => setOpen((current) => {
    if (current.has(title) === isOpen) return current
    const next = new Set(current)
    if (isOpen) next.add(title)
    else next.delete(title)
    return next
  })

  return (
    <section className="agent-brief" aria-label="Briefing">
      <div className="agent-brief__tabs" role="tablist">
        <button role="tab" aria-selected={view === 'brief'} onClick={() => setView('brief')}>Briefing</button>
        <button role="tab" aria-selected={view === 'talk'} onClick={() => setView('talk')}>Conversation{log.length > 0 && <span>{log.length}</span>}</button>
      </div>

      {view === 'brief' ? (
        <div className="agent-brief__body">
          <span className={`tone-chip tone-chip--${brief.tone}`}>{TONE_LABEL[brief.tone]}</span>
          <h2>{brief.headline}</h2>
          {brief.sections.length === 0 && <><p className="agent-brief__empty">Analysis appears here as windows once both documents are read. Say “elaborate” and I will open one.</p>{children}</>}
          {brief.sections.map((section) => (
            <details className="window" id={slug(section.title)} key={section.title} open={open.has(section.title)}
              onToggle={(event) => toggle(section.title, event.currentTarget.open)}>
              <summary><span>{section.title}</span><small>{section.rows.length}</small><ChevronDown size={16} aria-hidden /></summary>
              <dl>
                {section.rows.map((row, index) => (
                  <div className={row.alert ? 'brief-row brief-row--alert' : 'brief-row'} key={`${row.label}-${index}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}{row.note && <small>{row.note}</small>}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
          {brief.sections.length > 0 && <div className="agent-brief__export">
            <button className="btn btn--quiet" onClick={onExport}><Download size={16} aria-hidden /> Download .md</button>
            <button className="btn btn--quiet" onClick={() => void copy()}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? 'Copied' : 'Copy'}</button>
          </div>}
        </div>
      ) : (
        <ol className="agent-log" aria-live="polite">
          {log.length === 0 && <li className="agent-brief__empty">Nothing said yet.</li>}
          {log.map((line) => (
            <li key={line.id} className={`agent-log__line agent-log__line--${line.who}${line.error ? ' agent-log__line--error' : ''}`}>
              <p>{line.text}</p>
              {line.model && <small>Local model answer from the scanned text. Check the scans for anything important.</small>}
              {line.sources && reconciliationId && <ScanLinks reconciliationId={reconciliationId} documents={line.sources} label="Based on" />}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
