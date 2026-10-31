import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE } from './ports';
import { createVadSegmenter } from './vad-segmenter';

const FRAME = SAMPLE_RATE / 50; // 20 ms
const frame = (level: number): Float32Array => new Float32Array(FRAME).fill(level);

function feed(levels: number[]): Float32Array[] {
  const segmenter = createVadSegmenter();
  return levels.flatMap((level) => {
    const out = segmenter.push(frame(level));
    return out ? [out] : [];
  });
}

const repeat = (level: number, ms: number): number[] =>
  Array.from({ length: ms / 20 }, () => level);

describe('createVadSegmenter', () => {
  it('emits nothing for silence', () => {
    expect(feed(repeat(0, 2000))).toEqual([]);
  });

  it('emits one utterance after speech followed by silence', () => {
    const segments = feed([...repeat(0, 400), ...repeat(0.2, 600), ...repeat(0, 600)]);
    expect(segments).toHaveLength(1);
    const ms = ((segments[0]?.length ?? 0) / SAMPLE_RATE) * 1000;
    expect(ms).toBeGreaterThan(900);
    expect(ms).toBeLessThan(1500);
  });

  it('includes pre-roll before the speech started', () => {
    const [segment] = feed([...repeat(0.001, 400), ...repeat(0.2, 400), ...repeat(0, 600)]);
    expect(segment?.[0]).toBeCloseTo(0.001);
  });

  it('ignores blips shorter than the start threshold', () => {
    expect(feed([...repeat(0, 200), ...repeat(0.2, 40), ...repeat(0, 1000)])).toEqual([]);
  });

  it('cuts long speech at the maximum length', () => {
    expect(feed(repeat(0.2, 3200))).toHaveLength(1);
  });
});
