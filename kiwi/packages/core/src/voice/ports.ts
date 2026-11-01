export type AudioStartResult =
  { ok: true } | { ok: false; reason: 'denied' | 'no_device' | 'error'; message: string };

/** Microphone input as 16 kHz mono float frames. Audio is never written to disk. */
export interface AudioInputPort {
  start(onFrame: (samples: Float32Array) => void): Promise<AudioStartResult>;
  stop(): void;
}

export interface SpeechToTextPort {
  /** Resolves when the engine can transcribe; rejects with a readable message otherwise. */
  load(): Promise<void>;
  transcribe(samples: Float32Array): Promise<string>;
}

export interface SpeakHandlers {
  onBoundary: () => void;
  onEnd: () => void;
}

export interface TextToSpeechPort {
  isAvailable(): boolean;
  speak(text: string, handlers: SpeakHandlers): void;
  cancel(): void;
}

export const SAMPLE_RATE = 16_000;
