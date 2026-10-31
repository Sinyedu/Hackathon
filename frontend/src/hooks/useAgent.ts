import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { EVENT_LINES, intentOf, kindSaid, sectionFor, stripWake } from '../lib/agentIntent'
import { briefToMarkdown, type Brief } from '../lib/brief'
import { errorMessage } from '../lib/errors'
import { canSpeak, speak, stopSpeaking } from '../lib/speak'
import { askQuestion, findRecovery, transcribeAudio } from '../services/api'
import { approveSession, type LocalFile, type Session } from '../services/session'
import type { Document, Reconciliation } from '../types/reconciliation'
import type { OrbPhase } from '../components/agent/ParticleOrb'
import { parseWake } from '../lib/wake'
import { useAgentFiles, type PickMode } from './useAgentFiles'
import { useHandsFree } from './useHandsFree'
import { useRecorder } from './useRecorder'

export interface AgentLine { id: number; who: 'you' | 'agent'; text: string; sources?: Document[]; model?: boolean; error?: boolean }

interface Args {
  inputs: Record<PickMode, RefObject<HTMLInputElement | null>>
  session: Session | null
  result: Reconciliation | null
  brief: Brief
  refresh: (id: string) => Promise<void>
  onGenerate: () => void
}

export function useAgent({ inputs, session, result, brief, refresh, onGenerate }: Args) {
  const [log, setLog] = useState<AgentLine[]>([])
  const [caption, setCaption] = useState({ text: '', at: 0 })
  const [speaking, setSpeaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(!canSpeak)
  const [confirming, setConfirming] = useState(false)
  // Which briefing window the agent just talked about; the panel opens it.
  const [focus, setFocus] = useState<{ title: string; at: number } | null>(null)
  const pulse = useRef(0)
  const nextId = useRef(1)
  const seen = useRef(0)
  const awaitingVerdict = useRef(false)

  const add = (line: Omit<AgentLine, 'id'>) => setLog((current) => [...current.slice(-30), { ...line, id: nextId.current++ }])

  const say = useCallback((text: string, extra: Partial<AgentLine> = {}) => {
    setLog((current) => [...current.slice(-30), { id: nextId.current++, who: 'agent', text, ...extra }])
    setCaption({ text, at: 0 })
    if (muted) return
    speak(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => { setSpeaking(false); setCaption((c) => ({ ...c, at: c.text.length })) },
      onWord: (at) => { pulse.current = 1; setCaption((c) => ({ ...c, at })) },
    })
  }, [muted])

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

  const docs = useAgentFiles({ session, inputs, say, note: (text) => add({ who: 'agent', text }) })
  const importOne = (file: LocalFile) => void run(() => docs.importNamed(file.name))
  const assignKind = (kind: 'purchase_order' | 'delivery_note') => void run(() => docs.assignPending(kind))
  const uploadPicked = (picked: File[]) => void run(() => docs.uploadPicked(picked))

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
    const answeredKind = docs.pending && kindSaid(text)
    if (answeredKind) return run(() => docs.assignPending(answeredKind))
    const intent = intentOf(text)
    if (intent === 'brief') return say(brief.spoken)
    if (intent === 'export') { exportBrief(); return say('I downloaded the briefing as a Markdown file.') }
    if (intent === 'files') return run(() => docs.attach(text))
    if (intent === 'generate') { onGenerate(); return say('Opening test deliveries. Print one and I will read it as soon as it lands.') }
    if (intent === 'elaborate') return elaborate(text)
    if (intent === 'import') return run(() => docs.importNamed(text))
    if (!result) return say('I have nothing to look at yet. Add the documents first.')
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
  const hands = useHandsFree(mic.supported, busy || speaking || mic.recording, hearHandsFree)

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
    if (!session || greeted.current) return
    greeted.current = true
    seen.current = session.events.length
    say(brief.spoken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])
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
    else if (latest === 'delivery_received' && waitingFor) say(`Got it. Now I need the ${waitingFor.replace('_', ' ')}.`)
    else if (EVENT_LINES[latest]) say(EVENT_LINES[latest])
  }, [session, say])

  useEffect(() => {
    if (awaitingVerdict.current && result) {
      awaitingVerdict.current = false
      say(brief.spoken)
    }
  }, [result, brief.spoken, say])

  const phase: OrbPhase = mic.recording || hands.capturing ? 'listening' : busy ? 'thinking' : speaking ? 'speaking' : 'idle'
  const toggleMute = () => { if (!muted) { stopSpeaking(); setSpeaking(false) } setMuted(!muted) }
  return { log, caption, phase, pulse, mic: { ...mic, error: mic.error ?? hands.error }, muted, toggleMute, busy, confirming, setConfirming, confirmApproval, handle, exportBrief, docs, importOne, assignKind, uploadPicked, focus }
}
