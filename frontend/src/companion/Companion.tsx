import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, Settings2, Square, Volume2, VolumeX, X } from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { useHandsFree } from '../hooks/useHandsFree'
import { parseWake } from '../lib/wake'
import { speak, stopSpeaking } from '../lib/speak'
import { desktop, type Preferences, type Turn } from './desktop'
import { blipReply, stopBlips } from './blips'
import LivingKiwi from './LivingKiwi'
import Settings from './Settings'
import './companion.css'

const initial: Preferences = { provider: 'ollama', model: 'qwen3:1.7b', baseUrl: 'https://api.openai.com/v1', muted: false, wake: false, voice: 'natural', hasKey: false }
export default function Companion() {
  const [expanded, setExpanded] = useState(false), [settingsOpen, setSettingsOpen] = useState(false)
  const [preferences, setPreferences] = useState(initial), [text, setText] = useState(''), [phase, setPhase] = useState('idle')
  const [messages, setMessages] = useState<Turn[]>([]), [reply, setReply] = useState(''), [note, setNote] = useState('Click me. Let’s make something happen.')
  const [paused, setPaused] = useState(false)
  const current = useRef(''), accumulated = useRef(''), prefs = useRef(preferences), history = useRef(messages), speechEpoch = useRef(0)
  const ignoreRecording = useRef(false)
  prefs.current = preferences; history.current = messages
  const expand = (value: boolean) => { desktop.expand(value); setExpanded(value) }
  const silence = () => { speechEpoch.current++; stopSpeaking(); stopBlips(); setPhase('idle') }
  const stop = () => { current.current = ''; silence(); desktop.stop() }
  const say = (value: string) => {
    if (prefs.current.muted) return setPhase('idle')
    const epoch = ++speechEpoch.current
    setPhase('speaking')
    const done = () => { if (speechEpoch.current === epoch) setPhase('idle') }
    if (prefs.current.voice === 'blips') blipReply(value, done)
    else speak(value, { onEnd: done })
  }
  const send = async (value: string) => {
    if (!value.trim()) return
    if (/^(?:(?:hey )?kiwi[ ,]*)?(?:stop|cancel|be quiet)[.!]?$/i.test(value.trim())) { stop(); return }
    silence(); setText(''); setReply(''); accumulated.current = ''
    const id = crypto.randomUUID(); current.current = id
    const prior = history.current.slice(-8)
    setMessages((items) => [...items.slice(-19), { role: 'user', content: value }]); setPhase('thinking'); setNote('On it…')
    try { await desktop.send({ id, text: value, history: prior }) } catch (error) { setNote((error as Error).message); setPhase('idle') }
  }
  const heard = async (audio: Blob, wake: boolean) => {
    if (ignoreRecording.current) return
    const epoch = speechEpoch.current
    setPhase('thinking'); setNote('Listening to the recording…')
    try {
      const value = await desktop.transcribe(new Uint8Array(await audio.arrayBuffer()))
      if (epoch !== speechEpoch.current) return
      const command = wake ? parseWake(value) : value
      if (command === null) { setNote('Say “Hey Kiwi” followed by your request.'); setPhase('idle'); return }
      if (!command.trim()) { setNote('Yes? Say “Hey Kiwi” and your request together.'); setPhase('idle'); return }
      setNote(`Heard: ${value}`); await send(command)
    } catch (error) { setNote((error as Error).message); setPhase('idle') }
  }
  const mic = useRecorder((audio) => { void heard(audio, false) })
  const hands = useHandsFree(preferences.wake && !paused, phase === 'thinking' || phase === 'speaking' || mic.recording, (audio) => { void heard(audio, true) }, 750)
  const micRef = useRef(mic); micRef.current = mic
  useEffect(() => {
    document.documentElement.dataset.companion = 'true'
    void desktop.settings().then(setPreferences)
    void desktop.health().then((health) => setNote(health.ok ? 'Ready. Click me or use Ctrl+Shift+Space.' : health.message))
    const off = desktop.onEvent((event) => {
      if (event.type === 'expand') setExpanded(!!event.expanded)
      else if (event.type === 'settings' && event.settings) setPreferences(event.settings)
      else if (event.type === 'pause') { ignoreRecording.current = true; setPaused(true); micRef.current.stop(); silence() }
      else if (event.type === 'mic') { ignoreRecording.current = false; setPaused(false); if (micRef.current.recording) micRef.current.stop(); else { stop(); void micRef.current.start() } }
      else if (event.type === 'stop') silence()
      else if (event.id === current.current) {
        if (event.type === 'delta') { accumulated.current += event.text ?? ''; setReply(accumulated.current); setPhase('thinking') }
        else if (event.type === 'done') {
          const value = accumulated.current; setNote(''); setMessages((items) => [...items.slice(-19), { role: 'assistant', content: value }]); setReply(''); say(value)
        } else if (event.type === 'error') { setNote(event.message ?? 'Something went wrong.'); setPhase('idle') }
        else if (event.type === 'cancelled') { setNote('Stopped.'); setPhase('idle') }
      }
    })
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { ignoreRecording.current = true; stop(); micRef.current.stop() } }
    window.addEventListener('keydown', key)
    return () => { off(); stopSpeaking(); stopBlips(); window.removeEventListener('keydown', key); delete document.documentElement.dataset.companion }
    // Subscriptions use refs so voice and stream handlers survive panel changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const activePhase = mic.recording || hands.capturing ? 'listening' : phase
  return <main className={`companion ${expanded ? 'companion--expanded' : ''}`}>
    {expanded && <section className="companion-panel" aria-label="Kiwi assistant">
      <header><div><strong>kiwi<span>●</span></strong><small>{preferences.provider === 'ollama' ? 'LOCAL · on your computer' : 'CLOUD · your provider'}</small></div><div>
        <button onClick={() => { setSettingsOpen(!settingsOpen); setPaused(false) }} aria-label="Settings"><Settings2 size={17} /></button>
        <button onClick={() => expand(false)} aria-label="Collapse to mascot"><X size={17} /></button>
      </div></header>
      {settingsOpen ? <Settings preferences={preferences} onSaved={setPreferences} /> : <>
        <div className="companion-conversation" role="log" aria-live="polite">
          {!messages.length && <div className="companion-welcome"><span>Little sprout.<br />Big plans.</span><p>Your corner of the desktop just got a little more alive.</p><div>{['What can you do?', 'Open GitHub', 'Set a 5 minute timer'].map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt} ↗</button>)}</div></div>}
          {messages.map((message, index) => <p key={index} className={`companion-message companion-message--${message.role}`}>{message.content}</p>)}
          {reply && <p className="companion-message companion-message--assistant">{reply}<i className="companion-caret" /></p>}
          {note && <p className="companion-note" role="status">{note}</p>}
          {(mic.error || hands.state === 'denied') && <p role="alert">{mic.error || 'Microphone access is blocked in Windows privacy settings.'}</p>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void send(text) }}>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask your little companion…" maxLength={2000} aria-label="Message Kiwi" />
          <button type="submit" disabled={!text.trim()} aria-label="Send"><ArrowUp size={18} /></button>
        </form>
        <footer><button className={mic.recording ? 'is-live' : ''} onClick={() => { ignoreRecording.current = false; setPaused(false); if (mic.recording) mic.stop(); else { stop(); void mic.start() } }} aria-label={mic.recording ? 'Finish recording' : 'Talk to Kiwi'}>{mic.recording ? <Square size={15} /> : <Mic size={15} />}{mic.recording ? 'Send recording' : 'Talk to Kiwi'}</button>
          <button onClick={() => { silence(); void desktop.save({ muted: !preferences.muted }).then(setPreferences) }} aria-label={preferences.muted ? 'Unmute' : 'Mute'}>{preferences.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button onClick={stop}>Stop</button>
        </footer>
      </>}
    </section>}
    <div className="companion-pet"><span className={`companion-pet__status companion-pet__status--${activePhase}`}>{activePhase === 'idle' ? (preferences.wake && !paused ? 'Hey Kiwi' : 'Say hello') : activePhase}</span><LivingKiwi phase={activePhase} onClick={() => { expand(!expanded); setPaused(false) }} /></div>
  </main>
}
