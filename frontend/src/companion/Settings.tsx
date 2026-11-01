import { useState } from 'react'
import { desktop, type Preferences } from './desktop'

export default function Settings({ preferences, onSaved }: { preferences: Preferences; onSaved: (preferences: Preferences) => void }) {
  const [form, setForm] = useState(preferences)
  const [key, setKey] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const task = async (run: () => Promise<string>) => { setBusy(true); try { setNote(await run()) } catch (error) { setNote((error as Error).message) } finally { setBusy(false) } }
  return <div className="companion-settings">
    <label>Brain<select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as Preferences['provider'], model: event.target.value === 'ollama' ? 'qwen3:1.7b' : 'gpt-4o-mini' })}><option value="ollama">Local · Ollama</option><option value="compatible">Cloud · my API key</option></select></label>
    <label>Model<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label>
    {form.provider === 'compatible' && <>
      <p>Only the bounded website-drafting feature uses this provider. Desktop commands run through Kiwi’s fixed local action list.</p>
      <label>API base URL<input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} /></label>
      <label>Personal key {preferences.hasKey ? '(saved securely)' : ''}<input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Enter a new key" /></label>
    </>}
    <label className="companion-check"><input type="checkbox" checked={form.wake} onChange={(event) => setForm({ ...form, wake: event.target.checked })} /> Listen for “Hey Kiwi”</label>
    <p>Say “Hey Kiwi”, then your request. Kiwi listens and acts, but never speaks back. Windows shows live words; the local decoder checks the completed command. English voice input.</p>
    <div className="companion-settings__buttons">
      <button disabled={busy} onClick={() => void task(async () => { const saved = await desktop.save({ ...form, apiKey: key }); setKey(''); onSaved(saved); return 'Settings saved.' })}>Save</button>
      <button disabled={busy} onClick={() => void task(async () => (await desktop.health()).message)}>Test connection</button>
      <button disabled={busy} onClick={() => void task(desktop.downloadSpeech)}>{busy ? 'Working…' : 'Download speech model'}</button>
      {preferences.hasKey && <button disabled={busy} onClick={() => void task(async () => { onSaved(await desktop.save({ forgetKey: true })); return 'Key removed.' })}>Forget key</button>}
    </div>
    {note && <p role="status">{note}</p>}
    <small>Stop: Ctrl+Shift+. · Talk: Ctrl+Shift+Space<br />Quit and show controls are in the Windows tray menu.</small>
  </div>
}
