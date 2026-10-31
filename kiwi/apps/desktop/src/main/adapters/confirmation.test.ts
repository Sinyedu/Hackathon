import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConfirmationBridge } from './confirmation';

afterEach(() => vi.useRealTimers());

describe('createConfirmationBridge', () => {
  it('resolves true on an explicit yes', async () => {
    const bridge = createConfirmationBridge();
    const answer = bridge.confirm({ id: 'a', lines: [] });
    bridge.resolve('a', true);
    expect(await answer).toBe(true);
  });

  it('resolves false on no', async () => {
    const bridge = createConfirmationBridge();
    const answer = bridge.confirm({ id: 'a', lines: [] });
    bridge.resolve('a', false);
    expect(await answer).toBe(false);
  });

  it('cancels on timeout', async () => {
    vi.useFakeTimers();
    const answer = createConfirmationBridge(1000).confirm({ id: 'a', lines: [] });
    vi.advanceTimersByTime(1000);
    expect(await answer).toBe(false);
  });

  it('cancels everything pending', async () => {
    const bridge = createConfirmationBridge();
    const answers = [
      bridge.confirm({ id: 'a', lines: [] }),
      bridge.confirm({ id: 'b', lines: [] }),
    ];
    bridge.cancelAll();
    expect(await Promise.all(answers)).toEqual([false, false]);
  });
});
