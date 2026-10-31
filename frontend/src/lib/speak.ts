/** Read text aloud with the browser's built-in voices (no model, nothing sent anywhere). */
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export interface SpeakHooks {
  onStart?: () => void
  onEnd?: () => void
  /** Fires on each spoken word, with the character offset into the text. */
  onWord?: (charIndex: number) => void
}

export function speak(text: string, hooks: SpeakHooks = {}): void {
  if (!canSpeak) {
    hooks.onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.04
  // Some systems (notably Linux without a speech engine installed) never fire onend; don't hang on that.
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(watchdog)
    hooks.onEnd?.()
  }
  const watchdog = window.setTimeout(() => { window.speechSynthesis.cancel(); finish() }, 4000 + text.length * 90)
  utterance.onstart = () => hooks.onStart?.()
  utterance.onend = finish
  utterance.onerror = finish
  utterance.onboundary = (event) => {
    if (event.name === 'word') hooks.onWord?.(event.charIndex)
  }
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (canSpeak) window.speechSynthesis.cancel()
}
