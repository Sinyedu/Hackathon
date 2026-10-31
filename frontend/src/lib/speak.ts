/** Read text aloud with the browser's built-in voices (no model, nothing sent anywhere). */
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export function speak(text: string, onEnd?: () => void): void {
  if (!canSpeak) return onEnd?.()
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (canSpeak) window.speechSynthesis.cancel()
}
