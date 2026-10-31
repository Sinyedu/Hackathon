import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENT_LINES, intentOf, stripWake } from '../lib/agentIntent'
import { guessKind, KIND_LABEL, type DocKind } from '../lib/fileKind'
import { briefToMarkdown, type Brief } from '../lib/brief'
import { buildWalkthrough } from '../lib/walkthrough'
import { errorMessage } from '../lib/errors'
import { canSpeak, speak, stopSpeaking } from '../lib/speak'
import { askQuestion, findRecovery, transcribeAudio } from '../services/api'
import { approveSession, uploadSession, type Session } from '../services/session'
import type { Document, Reconciliation } from '../types/reconciliation'
import type { OrbPhase } from '../components/agent/ParticleOrb'
import { parseWake } from '../lib/wake'
import { useHandsFree, type ListenState } from './useHandsFree'
import { useRecorder } from './useRecorder'
import { useWalkthrough } from './useWalkthrough'

export interface AgentLine { id: number; who: 'you' | 'agent'; text: string; sources?: Document[]; model?: boolean; error?: boolean }

interface Args { open: boolean; wake: string | null; session: Session | null; result: Reconciliation | null; brief: Brief; refresh: (id: string) => Promise<void> }

export function useAgent({ open, wake, session, result, brief, refresh }: Args) {
  const [log, setLog] = useState<AgentLine[]>([])
  const [caption, setCaption] = useState({ text: '', at: 0 })
  const [speaking, setSpeaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(!canSpeak)
  const [confirming, setConfirming] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [unsorted, setUnsorted] = useState<File[]>([])
  const [armed, setArmed] = useState(false)
  const pulse = useRef(0)
  const nextId = useRef(1)
  const seen = useRef(0)
  const awaitingVerdict = useRef(false)
  const greeted = useRef(false)

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

  // After an analysis the agent tours the result: the panel docks to the bottom so the page stays visible.
  const [dock, setDock] = useState(false)
  const walk = useWalkthrough(useCallback((text: string, done: () => void) => say(text, {}, done), [say]))
  const tour = (rec: Reconciliation) => { setDock(true); void walk.run(buildWalkthrough(rec, window.location.pathname === '/dock')) }

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
    say(`${best.supplier_name} can cover it: ${best.packages_needed} times ${best.pack_size} ${best.pack_unit} for ${best.total_cost} ${best.currency}, ${lead}. It is a suggestion only; nothing is ordered. The other options are under the shortage on the page.`)
  }

  // Files come from the browser's own picker, so the user chooses where they are stored.
  const sendFile = async (file: File, kind: DocKind) => {
    if (!session) return
    await uploadSession(session.id, { [kind]: file })
    await refresh(session.id)
    add({ who: 'agent', text: `Added ${file.name} as the ${KIND_LABEL[kind]}.` })
  }

  const chooseFiles = (picked: File[]) => run(async () => {
    const unknown: File[] = []
    for (const file of picked.slice(0, 2)) {
      const kind = guessKind(file.name)
      if (kind) await sendFile(file, kind)
      else unknown.push(file)
    }
    setUnsorted(unknown)
    setChoosing(unknown.length > 0)
    if (unknown.length) say(`I cannot tell what ${unknown[0].name} is. Is it the purchase order or the delivery note?`)
  })

  const assign = (file: File, kind: DocKind) => run(async () => {
    await sendFile(file, kind)
    setUnsorted((rest) => rest.filter((f) => f !== file))
    setChoosing(false)
  })

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try { await action() } catch (e) { say(`I could not do that: ${errorMessage(e)}`, { error: true }) } finally { setBusy(false) }
  }

  const handle = async (raw: string) => {
    const text = stripWake(raw)
    if (!text || busy) return
    add({ who: 'you', text: raw.trim() })
    setArmed(false)
    walk.stop()
    const intent = intentOf(text)
    if (intent === 'brief') return say(brief.spoken)
    if (intent === 'export') { exportBrief(); return say('I downloaded the briefing as a Markdown file.') }
    if (intent === 'files' || intent === 'import') {
      setChoosing(true)
      return say('Tap the paperclip, then pick your purchase order and delivery note from wherever you keep them. I start reading as soon as they are in.')
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
      const answer = await askQuestion(result.id, text)
      say(answer.answer, { sources: answer.sources, model: true })
    })
  }

  const mic = useRecorder((audio) => {
    setBusy(true)
    transcribeAudio(audio)
      .then((heard) => { setBusy(false); return heard ? handle(heard) : say('I did not catch that. Try again.') })
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
        const rest = parseWake(heard)
        if (rest === null) return Date.now() < followUpUntil.current ? handle(heard) : undefined
        if (rest) return handle(rest)
        followUpUntil.current = Date.now() + 10_000 // bare "Hey agent": the next utterance is the request
      })
      .catch((e: unknown) => { setBusy(false); say(`I could not hear that: ${errorMessage(e)}`, { error: true }) })
  }
  const arm = () => {
    followUpUntil.current = Date.now() + 15_000 // opened by voice: the next thing said is the request
    setArmed(true)
    window.setTimeout(() => setArmed(false), 15_000)
  }
  const hands = useHandsFree(open && mic.supported, busy || speaking || mic.recording, hearHandsFree)

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

  // Greet with the current state on open; go quiet on close.
  useEffect(() => {
    if (!open) { stopSpeaking(); greeted.current = false; return }
    if (greeted.current) return
    greeted.current = true
    seen.current = session?.events.length ?? 0
    if (wake !== null) return wake ? void handle(wake) : arm() // woken by voice: listen, do not read the briefing
    say(brief.spoken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Narrate live session events while open.
  useEffect(() => {
    if (!open || !session) return
    const fresh = session.events.slice(seen.current)
    seen.current = session.events.length
    const latest = fresh.at(-1)?.type
    if (!latest) return
    const waitingFor = fresh.at(-1)?.data.waiting_for
    if (latest === 'verdict') awaitingVerdict.current = true
    else if (latest === 'delivery_received' && waitingFor) say(`Got it. Now I need the ${waitingFor.replace('_', ' ')}.`)
    else if (EVENT_LINES[latest]) say(EVENT_LINES[latest])
  }, [open, session, say])

  useEffect(() => {
    if (open && awaitingVerdict.current && result) {
      awaitingVerdict.current = false
      tour(result)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, result])

  useEffect(() => { if (!open) walk.stop() }, [open, walk.stop]) // eslint-disable-line react-hooks/exhaustive-deps

  const phase: OrbPhase = mic.recording || hands.capturing || armed ? 'listening' : busy ? 'thinking' : speaking ? 'speaking' : 'idle'
  const toggleMute = () => { if (!muted) { stopSpeaking(); setSpeaking(false) } setMuted(!muted) }
  return { log, caption, phase, pulse, mic: { ...mic, error: mic.error ?? micNote(hands.state) }, muted, toggleMute, busy, confirming, setConfirming, confirmApproval, handle, exportBrief, dock, setDock, touring: walk.active, skipTour: walk.stop, choosing, unsorted, chooseFiles, assign }
}

function micNote(state: ListenState): string | null {
  if (state === 'denied') return 'The microphone is blocked. Allow it in the browser address bar, or type instead.'
  if (state === 'unsupported') return 'Hands-free needs HTTPS or localhost. You can still type.'
  return null
}
