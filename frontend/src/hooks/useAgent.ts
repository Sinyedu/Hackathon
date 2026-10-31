import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { EVENT_LINES, intentOf, kindSaid, sectionFor, sheetTabFor, stripWake } from '../lib/agentIntent'
import { buildRows, summarise } from '../lib/compare'
import { briefToMarkdown, type Brief } from '../lib/brief'
import { errorMessage } from '../lib/errors'
import { canSpeak, speak, speakQueued, stopSpeaking } from '../lib/speak'
import { askStream, findRecovery, transcribeAudio, type Turn } from '../services/api'
import { approveSession, resolveLine, type LocalFile, type Session } from '../services/session'
import type { Document, Reconciliation } from '../types/reconciliation'
import type { OrbPhase } from '../components/agent/ParticleOrb'
import { parseWake } from '../lib/wake'
import { buildWalkthrough } from '../lib/walkthrough'
import { useAgentFiles, type PickMode } from './useAgentFiles'
import { useHandsFree, type ListenState } from './useHandsFree'
import { useRecorder } from './useRecorder'
import { useWalkthrough } from './useWalkthrough'

export interface AgentLine { id: number; who: 'you' | 'agent'; text: string; sources?: Document[]; model?: boolean; error?: boolean }

interface Args {
  inputs: Record<PickMode, RefObject<HTMLInputElement | null>>
  session: Session | null
  result: Reconciliation | null
  brief: Brief
  refresh: (id: string) => Promise<void>
  onGenerate: () => void
  onShow: (tab: 'compare' | 'purchase_order' | 'delivery_note') => void
  /** The agent page is on screen; the first greeting waits for it. */
  active: boolean
  /** "Hey agent" heard on any page: bring the agent forward. */
  onWake: () => void
  /** The header's Hey agent switch. */
  listening: boolean
}

/** A suggested replacement the user can follow; shown as a card with a real link. */
export interface Offer { supplier: string; summary: string; url: string; isSearch: boolean }

export function useAgent({ inputs, session, result, brief, refresh, onGenerate, onShow, active, onWake, listening }: Args) {
  const sessionId = session?.id ?? null
  const [log, setLog] = useState<AgentLine[]>([])
  // The conversation survives a reload: it is stored per session and also sent to the model as context.
  const [restored, setRestored] = useState<string | null>(null)
  if (sessionId && restored !== sessionId) {
    setRestored(sessionId)
    const saved = loadLog(sessionId)
    if (saved.length) setLog(saved)
  }
  const [caption, setCaption] = useState({ text: '', at: 0 })
  const [speaking, setSpeaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [heard, setHeard] = useState('')
  const [muted, setMuted] = useState(!canSpeak)
  const [confirming, setConfirming] = useState(false)
  const [offer, setOffer] = useState<Offer | null>(null)
  // Which briefing window the agent just talked about; the panel opens it.
  const [focus, setFocus] = useState<{ title: string; at: number } | null>(null)
  const pulse = useRef(0)
  const nextId = useRef(1)
  useEffect(() => {
    nextId.current = Math.max(nextId.current, ...log.map((l) => l.id + 1))
    if (sessionId && restored === sessionId) saveLog(sessionId, log)
  }, [log, sessionId, restored])
  const seen = useRef(0)
  const awaitingVerdict = useRef(false)

  const add = (line: Omit<AgentLine, 'id'>) => setLog((current) => [...current.slice(-30), { ...line, id: nextId.current++ }])

  const say = useCallback((text: string, extra: Partial<AgentLine> = {}, done?: () => void) => {
    setLog((current) => [...current.slice(-30), { id: nextId.current++, who: 'agent', text, ...extra }])
    setCaption({ text, at: 0 })
    if (muted) return void window.setTimeout(() => done?.(), 1500 + text.length * 45) // keep pace without a voice
    speak(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => { setSpeaking(false); setCaption((c) => ({ ...c, at: c.text.length })); done?.() },
      onWord: (at) => { pulse.current = 1; setCaption((c) => ({ ...c, at })) },
    })
  }, [muted])

  // After an analysis the agent tours the result on this page: it opens each briefing window, outlines it and marks the keywords.
  const walk = useWalkthrough(useCallback((text: string, done: () => void) => say(text, {}, done), [say]))
  const tour = (rec: Reconciliation) => void walk.run(buildWalkthrough(rec, brief), (title) => setFocus({ title, at: Date.now() }))

  const exportBrief = useCallback(() => {
    const blob = new Blob([briefToMarkdown(brief, result?.id ?? null)], { type: 'text/markdown' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `dockproof-briefing-${result?.id ?? 'empty'}.md`
    link.click()
    URL.revokeObjectURL(link.href)
  }, [brief, result?.id])

  const recover = async (rec: Reconciliation) => {
    const shortage = rec.discrepancies.find((d) => d.difference.startsWith('-'))
    if (!shortage) return say('Nothing is short, so there is nothing to replace.')
    const plan = await findRecovery(rec.id, shortage.catalog_item_id, 'cost')
    const best = plan.options.find((o) => o.option_id === plan.recommended_option_id)
    if (!best) return say(`No supplier in the catalog can cover the ${shortage.description} shortage. I did not invent one.`)
    const lead = best.lead_time_days === 0 ? 'same day' : `in ${best.lead_time_days} day${best.lead_time_days === 1 ? '' : 's'}`
    const summary = `${best.packages_needed} × ${best.pack_size} ${best.pack_unit} for ${best.total_cost} ${best.currency}, ${lead}`
    setOffer({ supplier: best.supplier_name, summary, url: best.buy_url, isSearch: best.buy_url_is_search })
    say(`${best.supplier_name} can cover it: ${best.packages_needed} times ${best.pack_size} ${best.pack_unit} for ${best.total_cost} ${best.currency}, ${lead}. Tap the link on screen to open it. It is a suggestion only; nothing is ordered.`)
  }

  const docs = useAgentFiles({ session, inputs, say, note: (text) => add({ who: 'agent', text }) })
  const importOne = (file: LocalFile) => void run(() => docs.importNamed(file.name))
  const assignKind = (kind: 'purchase_order' | 'delivery_note') => void run(() => docs.assignPending(kind))
  const uploadPicked = (picked: File[]) => void run(() => docs.uploadPicked(picked))
  const resolve = (lineId: string, catalogItemId: string | null) => session && void run(async () => {
    await resolveLine(session.id, lineId, catalogItemId)
    await refresh(session.id)
  })
  const openOffer = () => {
    if (!offer) return say('I have no replacement to open yet. Ask me to find a replacement first.')
    if (!window.open(offer.url, '_blank', 'noopener')) say('Your browser blocked the pop-up. Tap the link on screen to open it.')
  }

  const elaborate = (text: string) => {
    const section = brief.sections.find((s) => s.title === sectionFor(text)) ?? brief.sections[0]
    if (!section) return say('There is nothing to go into yet. Add the documents first.')
    setFocus({ title: section.title, at: Date.now() })
    say(`${section.title}. ${section.rows.map((r) => `${r.label}: ${r.value}${r.note ? `, ${r.note}` : ''}.`).join(' ')}`)
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try { await action() } catch (e) { say(`I could not do that: ${errorMessage(e)}`, { error: true }) } finally { setBusy(false) }
  }

  const handle = async (raw: string) => {
    const text = stripWake(raw)
    if (!text || busy) return
    add({ who: 'you', text: raw.trim() })
    walk.stop()
    const answeredKind = docs.pending && kindSaid(text)
    if (answeredKind) return run(() => docs.assignPending(answeredKind))
    const intent = intentOf(text)
    if (intent === 'brief') return say(brief.spoken)
    if (intent === 'export') { exportBrief(); return say('I downloaded the briefing as a Markdown file.') }
    if (intent === 'link') return openOffer()
    if (intent === 'show') {
      if (!result) return run(() => docs.attach('attach files')) // nothing to show yet: offer the picker instead of a dead end
      const { bad, review } = summarise(buildRows(result))
      onShow(sheetTabFor(text))
      return say(`Here are the documents. ${bad ? `${bad} ${bad === 1 ? 'problem is' : 'problems are'} marked in red.` : 'Nothing is wrong.'}${review ? ` ${review} still need${review === 1 ? 's' : ''} your check.` : ''}`)
    }
    if (intent === 'files') return run(() => docs.attach(text))
    if (intent === 'generate') { onGenerate(); return say('Opening test deliveries. Print one and I will read it as soon as it lands.') }
    if (intent === 'elaborate') return elaborate(text)
    if (intent === 'import') {
      if (/[\w-]+\.(pdf|png|jpe?g|webp)\b/i.test(text)) return run(() => docs.importNamed(text))
      if (result) { onShow(sheetTabFor(text)); return say('Here are the documents.') }
      return run(() => docs.attach('attach files'))
    }
    if (!result) return say('I have nothing to look at yet. Add the documents first.')
    if (intent === 'walkthrough') return tour(result)
    if (intent === 'findings') return say(brief.sections[0].rows.map((r) => `${r.label}: ${r.value}${r.note ? `, ${r.note}` : ''}.`).join(' '))
    if (intent === 'approve') {
      if (!result.claim) return say('There is no claim to approve.')
      if (result.claim.status === 'approved') return say('That claim is already approved.')
      if (result.status !== 'ready') return say('Some lines still need review before the claim can be approved.')
      setConfirming(true)
      return say('Tap Confirm approval to sign it off. I will not approve on voice alone.')
    }
    return run(async () => {
      if (intent === 'recover') return recover(result)
      await ask(result.id, text)
    })
  }

  // The model's reply arrives sentence by sentence; each is shown and spoken as soon as it has been checked.
  const ask = async (id: string, text: string) => {
    const history: Turn[] = log.filter((l) => !l.error).slice(-8).map((l) => ({ role: l.who === 'you' ? 'user' : 'assistant', content: l.text.slice(0, 800) }))
    const lineId = nextId.current++
    let shown = ''
    let sources: Document[] = []
    let pending = 0
    let finished = false
    const update = (extra: Partial<AgentLine> = {}) => setLog((current) => {
      const line: AgentLine = { id: lineId, who: 'agent', text: shown, sources, model: true, ...extra }
      return current.some((l) => l.id === lineId) ? current.map((l) => (l.id === lineId ? line : l)) : [...current.slice(-30), line]
    })
    const settle = () => { if (finished && pending === 0) { setSpeaking(false); setCaption((c) => ({ ...c, at: c.text.length })) } }
    const add1 = (sentence: string) => {
      shown = shown ? `${shown} ${sentence}` : sentence
      update()
      setCaption({ text: shown, at: shown.length })
      if (muted) return
      pending++
      speakQueued(sentence, () => { pending--; settle() }, () => setSpeaking(true))
    }
    stopSpeaking()
    await askStream(id, text, history, (event) => {
      if (event.type === 'meta') sources = event.sources
      else if (event.type === 'sentence' || event.type === 'fallback') add1(event.text)
      else if (event.type === 'error') throw new Error(event.detail)
      else if (event.type === 'done') { finished = true; settle() }
    })
    finished = true
    settle()
    if (!shown) say('The assistant gave no answer. Please try again.', { error: true })
  }

  const mic = useRecorder((audio) => {
    setBusy(true)
    transcribeAudio(audio)
      .then((heard) => { setBusy(false); setHeard(heard); return heard ? handle(heard) : say('I did not catch that. Try again.') })
      .catch((e: unknown) => { setBusy(false); say(`I could not hear that: ${errorMessage(e)}`, { error: true }) })
  })

  // Hands-free: while the agent is open it listens for "Hey agent" and treats everything up to 3 seconds of
  // silence as one request. Speech not addressed to the agent is dropped without reaching the model.
  const followUpUntil = useRef(0)
  const hearHandsFree = (audio: Blob) => {
    setBusy(true)
    transcribeAudio(audio)
      .then((heard) => {
        setBusy(false)
        setHeard(heard)
        const rest = parseWake(heard)
        if (rest === null) return Date.now() < followUpUntil.current ? handle(heard) : undefined
        onWake()
        if (rest) return handle(rest)
        say('Yes boss?')
        followUpUntil.current = Date.now() + 10_000 // bare "Hey agent": the next utterance is the request
      })
      .catch((e: unknown) => { setBusy(false); say(`I could not hear that: ${errorMessage(e)}`, { error: true }) })
  }
  const hands = useHandsFree(mic.supported && listening, busy || speaking || mic.recording, hearHandsFree)

  const confirmApproval = async () => {
    if (!session) return
    setBusy(true)
    try {
      await approveSession(session.id)
      await refresh(session.id)
      setConfirming(false)
    } catch (e) {
      say(`Approval failed and nothing was saved: ${errorMessage(e)}`, { error: true })
    } finally {
      setBusy(false)
    }
  }

  // Greet once the session is known; go quiet when the agent page is left.
  const greeted = useRef(false)
  useEffect(() => {
    if (!session || !active || greeted.current) return
    greeted.current = true
    seen.current = session.events.length
    say(brief.spoken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, active])
  useEffect(() => stopSpeaking, [])

  // Narrate live session events while open.
  useEffect(() => {
    if (!session || !greeted.current) return
    const fresh = session.events.slice(seen.current)
    seen.current = session.events.length
    const latest = fresh.at(-1)?.type
    if (!latest) return
    const waitingFor = fresh.at(-1)?.data.waiting_for
    if (latest === 'verdict') awaitingVerdict.current = true
    else if (latest === 'delivery_received' && waitingFor) say(`Alright boss, got it. Now I need the ${waitingFor.replace('_', ' ')}.`)
    else if (EVENT_LINES[latest]) say(EVENT_LINES[latest])
  }, [session, say])

  useEffect(() => {
    if (awaitingVerdict.current && result) {
      awaitingVerdict.current = false
      tour(result)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const phase: OrbPhase = speaking ? 'speaking' : mic.recording || hands.capturing ? 'listening' : busy ? 'thinking' : 'idle'
  const toggleMute = () => { if (!muted) { stopSpeaking(); setSpeaking(false) } setMuted(!muted) }
  return { log, caption, phase, pulse, mic: { ...mic, error: mic.error ?? micNote(hands.state) }, listenState: hands.state, heard, touring: walk.active, skipTour: walk.stop, muted, toggleMute, busy, confirming, setConfirming, confirmApproval, handle, exportBrief, docs, importOne, assignKind, uploadPicked, focus, offer, resolve }
}

function micNote(state: ListenState): string | null {
  if (state === 'denied') return 'The microphone is blocked. Allow it in the browser address bar, or type instead.'
  if (state === 'unsupported') return 'Hands-free needs HTTPS or localhost. You can still type.'
  return null
}

const KEY = (id: string) => `dockproof.chat.${id}`

function loadLog(id: string): AgentLine[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY(id)) ?? '[]')
    return Array.isArray(raw) ? (raw as AgentLine[]).filter((l) => typeof l.text === 'string' && (l.who === 'you' || l.who === 'agent')).slice(-30) : []
  } catch { return [] }
}

function saveLog(id: string, log: AgentLine[]) {
  try { localStorage.setItem(KEY(id), JSON.stringify(log.slice(-30))) } catch { /* history just will not survive a reload */ }
}
