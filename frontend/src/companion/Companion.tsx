import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, Settings2, Square, X } from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { desktop, type Preferences, type Turn } from './desktop'
import LivingKiwi from './LivingKiwi'
import { useWakeVoice } from './useWakeVoice'
import Settings from './Settings'
import './companion.css'

const initial: Preferences = { provider: 'ollama', model: 'qwen3:1.7b', baseUrl: 'https://api.openai.com/v1', muted: false, wake: true, voice: 'natural', hasKey: false }
export default function Companion() {
  const [expanded, setExpanded] = useState(false), [settingsOpen, setSettingsOpen] = useState(false)
  const [preferences, setPreferences] = useState(initial), [text, setText] = useState(''), [phase, setPhase] = useState('idle')
  const [messages, setMessages] = useState<Turn[]>([]), [reply, setReply] = useState(''), [note, setNote] = useState('Say “Hey Kiwi” to give a command.')
  const [paused, setPaused] = useState(false)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const current = useRef(''), accumulated = useRef(''), history = useRef(messages), speechEpoch = useRef(0)
  const ignoreRecording = useRef(false)
  history.current = messages
  const expand = (value: boolean) => { desktop.expand(value); setExpanded(value) }
  const silence = () => { speechEpoch.current++; setPhase('idle') }
  const stop = () => { current.current = ''; silence(); desktop.stop() }
  const send = async (value: string) => {
    if (!value.trim()) return
    if (/^(?:(?:hey )?kiwi[ ,]*)?(?:stop|cancel|be quiet)[.!]?$/i.test(value.trim())) { stop(); return }
    silence(); setText(''); setReply(''); accumulated.current = ''
    const id = crypto.randomUUID(); current.current = id
    const prior = history.current.slice(-8)
    setMessages((items) => [...items.slice(-19), { role: 'user', content: value }]); setPhase('thinking'); setNote('On it…')
    try { await desktop.send({ id, text: value, history: prior }) } catch (error) { setNote((error as Error).message); setPhase('idle') }
  }
  const heard = async (audio: Blob) => {
    if (ignoreRecording.current) return
    const epoch = speechEpoch.current
    setPhase('thinking'); setNote('Listening to the recording…')
    try {
      const value = await desktop.transcribe(new Uint8Array(await audio.arrayBuffer()))
      if (epoch !== speechEpoch.current) return
      if (!value.trim()) { setNote('I didn’t catch that. Try again.'); setPhase('idle'); return }
      setNote(`Heard: ${value}`); await send(value)
    } catch (error) { setNote((error as Error).message); setPhase('idle') }
  }
  const mic = useRecorder((audio) => { void heard(audio) })
  const wake = useWakeVoice(preferencesReady && preferences.wake && !paused && !mic.recording, phase === 'thinking' || phase === 'speaking', (value) => { void send(value) }, stop)
  const captionVisible = !!wake.caption
  useEffect(() => { if (!expanded) desktop.caption(captionVisible) }, [expanded, captionVisible])
  const micRef = useRef(mic); micRef.current = mic
  useEffect(() => {
    document.documentElement.dataset.companion = 'true'
    void desktop.settings().then((saved) => { setPreferences(saved); setPreferencesReady(true) })
    void desktop.health().then((health) => setNote(health.ok ? 'Ready. Say “Hey Kiwi” to give a command.' : 'Ready for desktop commands. Local model features are unavailable until Ollama is ready.'))
    const off = desktop.onEvent((event) => {
      if (event.type === 'expand') setExpanded(!!event.expanded)
      else if (event.type === 'settings' && event.settings) setPreferences(event.settings)
      else if (event.type === 'pause') { ignoreRecording.current = true; setPaused(true); micRef.current.stop(); silence() }
      else if (event.type === 'mic') { ignoreRecording.current = false; setPaused(false); if (micRef.current.recording) micRef.current.stop(); else { stop(); void micRef.current.start() } }
      else if (event.type === 'stop') silence()
      else if (event.id === current.current) {
        if (event.type === 'delta') { accumulated.current += event.text ?? ''; setReply(accumulated.current); setPhase('thinking') }
        else if (event.type === 'done') {
          const value = accumulated.current; setNote(''); setMessages((items) => [...items.slice(-19), { role: 'assistant', content: value }]); setReply(''); setPhase('idle')
        } else if (event.type === 'error') { setNote(event.message ?? 'Something went wrong.'); setPhase('idle') }
        else if (event.type === 'cancelled') { setNote('Stopped.'); setPhase('idle') }
      }
    })
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { ignoreRecording.current = true; stop(); micRef.current.stop() } }
    window.addEventListener('keydown', key)
    return () => { off(); window.removeEventListener('keydown', key); delete document.documentElement.dataset.companion }
    // Subscriptions use refs so voice and stream handlers survive panel changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const activePhase = mic.recording || wake.listening ? 'listening' : wake.processing ? 'thinking' : phase
  const wakeLabel = paused || !preferences.wake ? 'Mic paused' : wake.error ? 'Mic unavailable' : wake.status === 'starting' ? 'Starting mic…' : wake.status === 'off' ? 'Mic off' : 'Hey Kiwi · mic on'
  return <main className={`companion ${expanded ? 'companion--expanded' : ''}`}>
    {expanded && <section className="companion-panel" aria-label="Kiwi assistant">
      <header><div><strong>kiwi<span>●</span></strong><small>{preferences.provider === 'ollama' ? 'LOCAL · on your computer' : 'CLOUD · your provider'}</small></div><div>
        <button onClick={() => { setSettingsOpen(!settingsOpen); setPaused(false) }} aria-label="Settings"><Settings2 size={17} /></button>
        <button onClick={() => expand(false)} aria-label="Collapse to mascot"><X size={17} /></button>
      </div></header>
      {settingsOpen ? <Settings preferences={preferences} onSaved={setPreferences} /> : <>
        <div className="companion-conversation" role="log" aria-live="polite">
          {!messages.length && <div className="companion-welcome"><span>Tell Kiwi what to do.</span><p>Kiwi listens for commands and shows the result here. It does not speak replies.</p><div>{['What can you do?', 'Open GitHub', 'Open a new tab in Firefox'].map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt} ↗</button>)}</div></div>}
          {messages.map((message, index) => <p key={index} className={`companion-message companion-message--${message.role}`}>{message.content}</p>)}
          {reply && <p className="companion-message companion-message--assistant">{reply}<i className="companion-caret" /></p>}
          {note && <p className="companion-note" role="status">{note}</p>}
          {(mic.error || wake.error) && <p role="alert">{mic.error || wake.error}</p>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void send(text) }}>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a command for Kiwi…" maxLength={2000} aria-label="Command Kiwi" />
          <button type="submit" disabled={!text.trim()} aria-label="Send"><ArrowUp size={18} /></button>
        </form>
        <footer><button className={mic.recording ? 'is-live' : ''} onClick={() => { ignoreRecording.current = false; setPaused(false); if (mic.recording) mic.stop(); else { stop(); void mic.start() } }} aria-label={mic.recording ? 'Finish recording' : 'Record command'}>{mic.recording ? <Square size={15} /> : <Mic size={15} />}{mic.recording ? 'Send recording' : 'Record command'}</button>
          <button onClick={stop}>Stop</button>
        </footer>
      </>}
    </section>}
    <div className="companion-pet"><span className={`companion-pet__status companion-pet__status--${activePhase}`}>{activePhase === 'idle' ? wakeLabel : activePhase}</span><LivingKiwi phase={activePhase} level={wake.level} onClick={() => { expand(!expanded); setPaused(false) }} /></div>
    {wake.caption && <div className="companion-live-caption" role="status" aria-live="polite"><span>{wake.listening ? 'LISTENING' : 'HEARD'}</span><p>{wake.caption}</p></div>}
  </main>
}
