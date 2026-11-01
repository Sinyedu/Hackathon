import { describe, expect, it } from 'vitest';
import { recommendModels } from './models';

describe('recommendModels', () => {
  it.each([
    [4, 'qwen3:1.7b'],
    [7.9, 'qwen3:1.7b'],
    [8, 'qwen3:4b'],
    [15.9, 'qwen3:4b'],
    [16, 'qwen3:8b'],
    [64, 'qwen3:8b'],
  ])('%d GB gets planning model %s', (ram, planning) => {
    expect(recommendModels(ram).planning).toBe(planning);
  });
});
