import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { speak, stopSpeaking } from '../lib/speak'
import { parseWake } from '../lib/wake'
import { askQuestion, getCards, transcribeAudio } from '../services/api'
import type { AgentCard } from '../types/assistant'

export type Stage = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'
const FOLLOW_UP_MS = 10_000

/** State machine for the agent stage: cards, the open card, per-card explanations and the voice loop. */
export function useAgent(reconciliationId: string, onWake?: () => void) {
  const [cards, setCards] = useState<AgentCard[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, { text: string; grounded: boolean }>>({})
  const [awaiting, setAwaiting] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [aloud, setAloud] = useState(true)
  const awaitingUntil = useRef(0)
  const openRef = useRef<string | null>(null)
  useEffect(() => {
    openRef.current = openId
  }, [openId])

  useEffect(() => {
    let live = true
    getCards(reconciliationId).then((c) => live && setCards(c), (e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [reconciliationId])

  const ask = useCallback(async (question: string, focus: string | null = openRef.current) => {
    setError(null)
    setHeard(question)
    setReply(null)
    setAwaiting(false)
    setStage('thinking')
    try {
      const res = await askQuestion(reconciliationId, question, focus)
      setReply(res.answer)
      if (!res.focus) setOpenId(null) // not about a card: the answer is shown under the orb instead
      else {
        setOpenId(res.focus)
        setExplanations((m) => ({ ...m, [res.focus as string]: { text: res.answer, grounded: res.grounded } }))
      }
      if (aloud) {
        setStage('speaking')
        speak(res.answer, () => setStage('idle'))
      } else setStage('idle')
    } catch (e) {
      setError(errorMessage(e))
      setStage('idle')
    }
  }, [reconciliationId, aloud])

  const open = (card: AgentCard) => {
    stopSpeaking()
    setOpenId(card.id)
    if (!explanations[card.id]) void ask(`Explain "${card.title}" in simple words and point out what matters.`, card.id)
  }

  /** wake=true: hands-free audio that only counts after "Hey agent". */
  const hear = async (audio: Blob, wake: boolean) => {
    setStage('transcribing')
    try {
      const text = (await transcribeAudio(audio)).trim()
      if (!text) return setStage('idle')
      if (!wake) return void ask(text)
      const rest = parseWake(text)
      if (rest !== null) {
        onWake?.()
        if (rest) return void ask(rest)
        awaitingUntil.current = Date.now() + FOLLOW_UP_MS // bare "Hey agent": the next utterance is the question
        setAwaiting(true)
        setHeard(null)
        window.setTimeout(() => setAwaiting(false), FOLLOW_UP_MS)
        return setStage('idle')
      }
      if (Date.now() < awaitingUntil.current) return void ask(text)
      setStage('idle') // not addressed to the agent: ignored, not sent to the model
    } catch (e) {
      setError(errorMessage(e))
      setStage('idle')
    }
  }

  const close = () => stopSpeaking()
  return { cards, openId, setOpenId, explanations, awaiting, heard, reply, error, stage, setStage, aloud, setAloud, ask, open, hear, close }
}
