/** Read text aloud with the browser's built-in voices (no model, nothing sent anywhere). */
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export function speak(text: string): void {
  if (!canSpeak) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export function stopSpeaking(): void {
  if (canSpeak) window.speechSynthesis.cancel()
}
