import type { TextToSpeechPort } from '@kiwi/core';

const BEAK_INTERVAL_MS = 180;

function browserVoices(): number {
  return window.speechSynthesis.getVoices().length;
}

/** Uses the browser's voices when there are any, otherwise the operating system's own speech command. */
export async function createTts(): Promise<
  TextToSpeechPort & { source: 'browser' | 'system' | 'none' }
> {
  const systemAvailable = await window.kiwi.voice.speechAvailable();
  let beak: ReturnType<typeof setInterval> | undefined;
  const source = browserVoices() > 0 ? 'browser' : systemAvailable ? 'system' : 'none';

  return {
    source,
    isAvailable: () => source !== 'none',
    speak(text, handlers) {
      if (source === 'browser') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onboundary = handlers.onBoundary;
        utterance.onend = handlers.onEnd;
        utterance.onerror = handlers.onEnd;
        window.speechSynthesis.speak(utterance);
        return;
      }
      // System speech has no word events, so the beak moves on a steady beat while it talks.
      handlers.onBoundary();
      beak = setInterval(handlers.onBoundary, BEAK_INTERVAL_MS);
      void window.kiwi.voice.speak(text).finally(() => {
        clearInterval(beak);
        handlers.onEnd();
      });
    },
    cancel() {
      clearInterval(beak);
      if (source === 'browser') window.speechSynthesis.cancel();
      else window.kiwi.voice.cancelSpeech();
    },
  };
}
