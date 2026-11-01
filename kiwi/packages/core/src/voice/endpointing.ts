export interface EndpointConfig {
  /** RMS below this counts as silence. */
  silenceThreshold: number;
  /** Silence this long after speech ends the capture (tap-to-talk). */
  silenceMs: number;
  /** Captures shorter than this are discarded as noise. */
  minMs: number;
  /** Hard stop. */
  maxMs: number;
}

export const defaultEndpointConfig: EndpointConfig = {
  silenceThreshold: 0.015,
  silenceMs: 800,
  minMs: 300,
  maxMs: 12_000,
};

export interface EndpointState {
  elapsedMs: number;
  silentMs: number;
  heardSpeech: boolean;
}

export type EndpointDecision = 'continue' | 'end' | 'discard';

export const initialEndpointState: EndpointState = {
  elapsedMs: 0,
  silentMs: 0,
  heardSpeech: false,
};

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/**
 * Advances the endpointer by one audio frame. With `useSilence: false` (hold-to-talk) only the
 * maximum length ends the capture; the caller ends it on key release.
 */
export function stepEndpoint(
  state: EndpointState,
  frame: { level: number; durationMs: number },
  config: EndpointConfig,
  useSilence: boolean,
): { state: EndpointState; decision: EndpointDecision } {
  const loud = frame.level >= config.silenceThreshold;
  const next: EndpointState = {
    elapsedMs: state.elapsedMs + frame.durationMs,
    heardSpeech: state.heardSpeech || loud,
    silentMs: loud ? 0 : state.silentMs + frame.durationMs,
  };
  if (next.elapsedMs >= config.maxMs) return { state: next, decision: 'end' };
  if (!useSilence || !next.heardSpeech) return { state: next, decision: 'continue' };
  if (next.silentMs >= config.silenceMs) {
    return {
      state: next,
      decision: next.elapsedMs - next.silentMs < config.minMs ? 'discard' : 'end',
    };
  }
  return { state: next, decision: 'continue' };
}
