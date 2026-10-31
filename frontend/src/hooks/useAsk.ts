import { useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { speak } from '../lib/speak'
import { askQuestion, transcribeAudio } from '../services/api'
import type { ChatMessage } from '../types/assistant'

type Stage = 'idle' | 'transcribing' | 'thinking'

export function useAsk(reconciliationId: string, speakAnswers: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const nextId = useRef(1)

  const ask = async (question: string) => {
    const id = nextId.current++
    const base: ChatMessage = { id, question, answer: null, sources: [], error: null }
    setMessages((m) => [...m, base])
    setStage('thinking')
    try {
      const res = await askQuestion(reconciliationId, question)
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, answer: res.answer, sources: res.sources } : x)))
      if (speakAnswers) speak(res.answer)
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, error: errorMessage(e) } : x)))
    } finally {
      setStage('idle')
    }
  }

  const askByVoice = async (audio: Blob) => {
    setVoiceError(null)
    setStage('transcribing')
    try {
      const text = await transcribeAudio(audio)
      if (!text) {
        setVoiceError('I did not catch that. Please try again.')
        setStage('idle')
        return
      }
      await ask(text)
    } catch (e) {
      setVoiceError(errorMessage(e))
      setStage('idle')
    }
  }

  return { messages, stage, voiceError, ask, askByVoice }
}
