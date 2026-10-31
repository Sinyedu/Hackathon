import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { briefToMarkdown, type Brief } from '../../lib/brief'
import ScanLinks from '../ScanLinks'
import type { AgentLine } from '../../hooks/useAgent'

const TONE_LABEL = { waiting: 'Waiting', problem: 'Discrepancy', review: 'Needs review', ok: 'All good', approved: 'Approved' } as const

interface Props { brief: Brief; log: AgentLine[]; reconciliationId: string | null; onExport: () => void }

export default function AgentBrief({ brief, log, reconciliationId, onExport }: Props) {
  const [view, setView] = useState<'brief' | 'talk'>('brief')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(briefToMarkdown(brief, reconciliationId))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

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
          {brief.sections.length === 0 && <p className="agent-brief__empty">The briefing fills in by itself once both documents are read.</p>}
          {brief.sections.map((section) => (
            <div className="brief-section" key={section.title}>
              <h3>{section.title}</h3>
              <dl>
                {section.rows.map((row, index) => (
                  <div className={row.alert ? 'brief-row brief-row--alert' : 'brief-row'} key={`${row.label}-${index}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}{row.note && <small>{row.note}</small>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="agent-brief__export">
            <button className="btn btn--quiet" onClick={onExport} disabled={!brief.sections.length}><Download size={16} aria-hidden /> Download .md</button>
            <button className="btn btn--quiet" onClick={() => void copy()} disabled={!brief.sections.length}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? 'Copied' : 'Copy'}</button>
          </div>
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
