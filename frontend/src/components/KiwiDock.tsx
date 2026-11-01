import { Bot, ChevronDown, FileText, Gauge, KeyRound, Settings2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import KiwiMascot from './KiwiMascot'
import { getAiSettings, getApiKey, saveAiSettings, type AiSettings } from '../services/aiSettings'
import type { OrbPhase } from './agent/ParticleOrb'

interface Props {
  phase: OrbPhase
  onOpenAgent: () => void
  onShowDocuments: () => void
  hasDocuments: boolean
}

export default function KiwiDock({ phase, onOpenAgent, onShowDocuments, hasDocuments }: Props) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<AiSettings>(() => getAiSettings())
  const [apiKey, setApiKey] = useState(() => getApiKey())
  const [saved, setSaved] = useState(false)

  const isPersonal = settings.provider === 'openai'
  const save = () => {
    saveAiSettings(settings, apiKey)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }
  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))

  return (
    <div className="kiwi-dock-shell">
      {open && (
        <section className="kiwi-dashboard" aria-label="Kiwi dashboard">
          <header className="kiwi-dashboard__header">
            <div className="kiwi-dashboard__title"><KiwiMascot phase={phase} /><div><strong>Kiwi control room</strong><small>Local-first assistant</small></div></div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close Kiwi dashboard"><X size={18} /></button>
          </header>
          <div className="kiwi-dashboard__body">
            <div className="kiwi-status-card"><span className={`kiwi-status-dot kiwi-status-dot--${phase}`} /><div><strong>{phase === 'idle' ? 'Ready when you are' : phase === 'thinking' ? 'Working on it' : phase === 'speaking' ? 'Talking through it' : 'Listening'}</strong><small>{isPersonal ? 'Using your personal API key' : `Ollama · ${settings.ollamaModel}`}</small></div></div>
            <div className="kiwi-dashboard__section">
              <div className="kiwi-dashboard__section-title"><Settings2 size={15} /> AI connection</div>
              <div className="kiwi-provider-toggle" role="group" aria-label="AI provider">
                <button className={!isPersonal ? 'selected' : ''} onClick={() => update('provider', 'ollama')}><Bot size={15} /> Local Ollama</button>
                <button className={isPersonal ? 'selected' : ''} onClick={() => update('provider', 'openai')}><KeyRound size={15} /> Personal key</button>
              </div>
              {!isPersonal ? <>
                <label className="kiwi-field">Model<input value={settings.ollamaModel} onChange={(event) => update('ollamaModel', event.target.value)} placeholder="qwen3:1.7b" /></label>
                <label className="kiwi-field">Ollama URL<input value={settings.ollamaUrl} onChange={(event) => update('ollamaUrl', event.target.value)} placeholder="http://localhost:11434" /></label>
              </> : <>
                <label className="kiwi-field">API key <span className="kiwi-field__hint">session only</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" /></label>
                <label className="kiwi-field">Model<input value={settings.openaiModel} onChange={(event) => update('openaiModel', event.target.value)} placeholder="gpt-4o-mini" /></label>
                <label className="kiwi-field">Compatible API URL<input value={settings.openaiUrl} onChange={(event) => update('openaiUrl', event.target.value)} placeholder="https://api.openai.com/v1" /></label>
              </>}
              <button className="btn btn--primary btn--small kiwi-save" onClick={save} disabled={isPersonal && !apiKey.trim()}>{saved ? 'Saved' : 'Save connection'}</button>
              <p className="kiwi-dashboard__note">Ollama is free after install and keeps prompts on this computer. ChatGPT and API billing are separate; eligible plans may have API credits, otherwise a personal key can incur provider charges.</p>
            </div>
          </div>
        </section>
      )}
      <div className="kiwi-dockbar" aria-label="Kiwi dock">
        <button className="kiwi-dock-item kiwi-dock-item--workspace" onClick={onOpenAgent} title="Open Kiwi assistant"><KiwiMascot phase={phase} /><span>Kiwi</span></button>
        <span className="kiwi-dock-divider" aria-hidden />
        <button className="kiwi-dock-item" onClick={onOpenAgent} title="Open assistant workspace"><Gauge size={18} /><span>Workspace</span></button>
        {hasDocuments && <button className="kiwi-dock-item" onClick={onShowDocuments} title="View scanned documents"><FileText size={18} /><span>Documents</span></button>}
        <button className={`kiwi-dock-item${open ? ' active' : ''}`} onClick={() => setOpen((current) => !current)} title="Open Kiwi settings"><Settings2 size={18} /><span>Configure</span></button>
        <span className="kiwi-dock-mode"><Sparkles size={14} /> {isPersonal ? 'Key' : 'Local'}</span>
        <button className="kiwi-dock-collapse" onClick={() => setOpen((current) => !current)} aria-label={open ? 'Close Kiwi dashboard' : 'Open Kiwi dashboard'}>{open ? <ChevronDown size={18} /> : <ChevronDown size={18} className="kiwi-chevron-up" />}</button>
      </div>
    </div>
  )
}
