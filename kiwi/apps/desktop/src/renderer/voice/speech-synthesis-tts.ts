import type { TextToSpeechPort } from '@kiwi/core';

/** Operating-system speech through the Web Speech API. */
export function createSpeechSynthesisTts(): TextToSpeechPort {
  const synth = window.speechSynthesis;
  return {
    isAvailable: () => synth.getVoices().length > 0,
    speak(text, handlers) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onboundary = handlers.onBoundary;
      utterance.onend = handlers.onEnd;
      utterance.onerror = handlers.onEnd;
      synth.speak(utterance);
    },
    cancel: () => synth.cancel(),
  };
}
