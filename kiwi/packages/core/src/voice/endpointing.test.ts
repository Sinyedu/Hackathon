import { describe, expect, it } from 'vitest';
import {
  defaultEndpointConfig as config,
  initialEndpointState,
  rms,
  stepEndpoint,
  type EndpointDecision,
} from './endpointing';

const LOUD = 0.1;
const QUIET = 0;

function run(frames: [number, number][], useSilence = true): EndpointDecision[] {
  let state = initialEndpointState;
  return frames.map(([level, durationMs]) => {
    const step = stepEndpoint(state, { level, durationMs }, config, useSilence);
    state = step.state;
    return step.decision;
  });
}

describe('stepEndpoint', () => {
  it('ends after 800 ms of silence following speech', () => {
    const decisions = run([
      [LOUD, 500],
      [QUIET, 400],
      [QUIET, 400],
    ]);
    expect(decisions).toEqual(['continue', 'continue', 'end']);
  });

  it('keeps waiting when no speech has been heard yet', () => {
    expect(run([[QUIET, 5000]])).toEqual(['continue']);
  });

  it('resets the silence counter when speech resumes', () => {
    const decisions = run([
      [LOUD, 300],
      [QUIET, 700],
      [LOUD, 100],
      [QUIET, 700],
    ]);
    expect(decisions).toEqual(['continue', 'continue', 'continue', 'continue']);
  });

  it('discards captures shorter than the minimum', () => {
    expect(
      run([
        [LOUD, 100],
        [QUIET, 800],
      ]),
    ).toEqual(['continue', 'discard']);
  });

  it('stops at the 12 second maximum', () => {
    expect(
      run([
        [LOUD, 6000],
        [LOUD, 6000],
      ]),
    ).toEqual(['continue', 'end']);
  });

  it('ignores silence in hold-to-talk mode but still honors the maximum', () => {
    expect(
      run(
        [
          [LOUD, 500],
          [QUIET, 3000],
          [QUIET, 9000],
        ],
        false,
      ),
    ).toEqual(['continue', 'continue', 'end']);
  });

  it('treats a level exactly at the threshold as speech', () => {
    expect(
      run([
        [config.silenceThreshold, 400],
        [QUIET, 800],
      ]),
    ).toEqual(['continue', 'end']);
  });
});

describe('rms', () => {
  it('measures signal level', () => {
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});
