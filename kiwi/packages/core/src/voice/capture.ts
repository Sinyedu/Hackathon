import {
  defaultEndpointConfig,
  initialEndpointState,
  stepEndpoint,
  type EndpointDecision,
  type EndpointState,
} from './endpointing';
import { SAMPLE_RATE } from './ports';

export type CaptureVia = 'push' | 'tap' | 'wake';

/** A command being recorded: its audio so far and how close it is to ending. */
export class Capture {
  readonly chunks: Float32Array[] = [];
  private state: EndpointState = initialEndpointState;

  constructor(private readonly via: CaptureVia) {}

  /** Adds a frame and reports whether the capture should continue, end or be discarded. */
  push(samples: Float32Array, level: number): EndpointDecision {
    this.chunks.push(samples);
    const step = stepEndpoint(
      this.state,
      { level, durationMs: (samples.length / SAMPLE_RATE) * 1000 },
      defaultEndpointConfig,
      this.via !== 'push',
    );
    this.state = step.state;
    return step.decision;
  }
}
