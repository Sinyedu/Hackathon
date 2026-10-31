import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENT_LINES, intentOf, pickFiles, stripWake } from '../lib/agentIntent'
import { briefToMarkdown, type Brief } from '../lib/brief'
import { errorMessage } from '../lib/errors'
import { canSpeak, speak, stopSpeaking } from '../lib/speak'
import { askQuestion, findRecovery, transcribeAudio } from '../services/api'
import { approveSession, importFile, listFiles, type LocalFile, type Session } from '../services/session'
import type { Document, Reconciliation } from '../types/reconciliation'
import type { OrbPhase } from '../components/agent/ParticleOrb'
import { useRecorder } from './useRecorder'

export interface AgentLine { id: number; who: 'you' | 'agent'; text: string; sources?: Document[]; model?: boolean; error?: boolean }

interface Args { open: boolean; session: Session | null; result: Reconciliation | null; brief: Brief; refresh: (id: string) => Promise<void> }

export function useAgent({ open, session, result, brief, refresh }: Args) {
  const [log, setLog] = useState<AgentLine[]>([])
  const [caption, setCaption] = useState({ text: '', at: 0 })
  const [speaking, setSpeaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(!canSpeak)
  const [confirming, setConfirming] = useState(false)
  const [files, setFiles] = useState<LocalFile[] | null>(null)
  const pulse = useRef(0)
  const nextId = useRef(1)
  const seen = useRef(0)
  const awaitingVerdict = useRef(false)
  const greeted = useRef(false)

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

  const openFiles = async (sessionId: string) => {
    const listing = await listFiles(sessionId)
    setFiles(listing.files)
    if (!listing.files.length) say(`Your files folder, ${listing.folder}, is empty. Put a scan or PDF there and ask me again.`)
    else say(`I see ${listing.files.length} file${listing.files.length === 1 ? '' : 's'} in ${listing.folder}: ${listing.files.map((f) => f.name).join(', ')}. Tell me which to import, or say import both.`)
    return listing.files
  }

  const importNamed = async (sessionId: string, text: string) => {
    const picked = pickFiles(text, files ?? await listFiles(sessionId).then((l) => { setFiles(l.files); return l.files }))
    if (picked === 'ambiguous') return say('More than one file fits that. Say the file name, or tap it below.')
    if (!picked.length) return say('I could not find that file. Say open my files to hear what is there.')
    for (const file of picked) {
      if (!file.kind) return say(`I cannot tell if ${file.name} is the purchase order or the delivery note. Rename it with order or delivery in the name.`)
      add({ who: 'agent', text: `Importing ${file.name} as the ${file.kind.replace('_', ' ')}.` })
      await importFile(sessionId, file.name, file.kind)
    }
  }

  const importOne = (file: LocalFile) => session && void run(() => importNamed(session.id, file.name))

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try { await action() } catch (e) { say(`I could not do that: ${errorMessage(e)}`, { error: true }) } finally { setBusy(false) }
  }

  const handle = async (raw: string) => {
    const text = stripWake(raw)
    if (!text || busy) return
    add({ who: 'you', text: raw.trim() })
    const intent = intentOf(text)
    if (intent === 'brief') return say(brief.spoken)
    if (intent === 'export') { exportBrief(); return say('I downloaded the briefing as a Markdown file.') }
    if ((intent === 'files' || intent === 'import') && session) return run(() => intent === 'files' ? openFiles(session.id) : importNamed(session.id, text))
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
      say(brief.spoken)
    }
  }, [open, result, brief.spoken, say])

  const phase: OrbPhase = mic.recording ? 'listening' : busy ? 'thinking' : speaking ? 'speaking' : 'idle'
  const toggleMute = () => { if (!muted) { stopSpeaking(); setSpeaking(false) } setMuted(!muted) }
  return { log, caption, phase, pulse, mic, muted, toggleMute, busy, confirming, setConfirming, confirmApproval, handle, exportBrief, files, importOne }
}
