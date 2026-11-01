import type { VoiceEvent } from '@kiwi/shared';
import type { AudioInputPort, SpeechToTextPort, TextToSpeechPort } from './ports';
import { SAMPLE_RATE } from './ports';
import { createVoiceSession } from './voice-session';

/** Fakes for the voice ports. */
export interface FakeAudio extends AudioInputPort {
  push(level: number, ms: number): void;
  running(): boolean;
}

export function createFakeAudio(): FakeAudio {
  let handler: ((samples: Float32Array) => void) | null = null;
  return {
    start(onFrame) {
      handler = onFrame;
      return Promise.resolve({ ok: true });
    },
    stop() {
      handler = null;
    },
    running: () => handler !== null,
    push(level, ms) {
      const frame = SAMPLE_RATE / 50;
      for (let i = 0; i < ms / 20; i += 1) handler?.(new Float32Array(frame).fill(level));
    },
  };
}

export function createFakeStt(transcripts: string[]): SpeechToTextPort & { calls: number } {
  const queue = [...transcripts];
  const stt = {
    calls: 0,
    load: () => Promise.resolve(),
    transcribe() {
      stt.calls += 1;
      return Promise.resolve(queue.shift() ?? '');
    },
  };
  return stt;
}

export interface FakeTts extends TextToSpeechPort {
  spoken: string[];
  finishCurrent(): void;
  cancelled: number;
}

export function createFakeTts(available = true): FakeTts {
  let finish: (() => void) | null = null;
  const tts: FakeTts = {
    spoken: [],
    cancelled: 0,
    isAvailable: () => available,
    speak(text, handlers) {
      tts.spoken.push(text);
      handlers.onBoundary();
      finish = handlers.onEnd;
    },
    cancel() {
      tts.cancelled += 1;
      finish = null;
    },
    finishCurrent() {
      const done = finish;
      finish = null;
      done?.();
    },
  };
  return tts;
}

export function createTestVoice(transcripts: string[], options: { ttsAvailable?: boolean } = {}) {
  const events: VoiceEvent[] = [];
  const submitted: string[] = [];
  const audio = createFakeAudio();
  const stt = createFakeStt(transcripts);
  const tts = createFakeTts(options.ttsAvailable ?? true);
  let clock = 0;
  const session = createVoiceSession({
    audio,
    stt,
    tts,
    emit: (event) => events.push(event),
    submit: (text) => submitted.push(text),
    now: () => (clock += 10),
  });
  return { session, events, submitted, audio, stt, tts };
}
