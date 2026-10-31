import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { parseWake } from '../lib/wake'
import { transcribeAudio } from '../services/api'
import { useHandsFree } from './useHandsFree'

const WAKE_SILENCE_MS = 1200 // short: a bare "Hey agent" should open the agent quickly

/**
 * Site-wide "Hey agent". Listens locally; only audio that starts with the wake phrase has any effect,
 * everything else is discarded. onWake gets the rest of the sentence ('' for a bare "Hey agent").
 * `heard` is the last thing that was NOT the wake phrase, so a mishearing is visible, not silent.
 */
export function useWakeWord(enabled: boolean, onWake: (command: string) => void) {
  const [error, setError] = useState<string | null>(null)
  const [heard, setHeard] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const hands = useHandsFree(enabled, false, (audio) => {
    transcribeAudio(audio)
      .then((text) => {
        setError(null)
        const command = parseWake(text)
        if (command !== null) return onWake(command)
        if (text.trim()) {
          setHeard(text.trim())
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setHeard(null), 6000)
        }
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, WAKE_SILENCE_MS)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { state: hands.state, capturing: hands.capturing, heard, error }
}
