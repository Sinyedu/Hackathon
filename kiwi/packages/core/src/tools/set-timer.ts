import { z } from 'zod';
import { defineTool } from './types';

const MAX_SECONDS = 24 * 60 * 60;

export function formatDuration(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

export const setTimer = defineTool({
  name: 'set_timer',
  description: 'Start a countdown timer that notifies when it ends.',
  risk: 'read',
  argsSchema: z.object({
    seconds: z.number().int().min(1).max(MAX_SECONDS),
    label: z.string().max(60).default('Timer'),
  }),
  describe: ({ seconds }) => `Start a ${formatDuration(seconds)} timer`,
  execute({ seconds, label }, { platform }) {
    const timerId = platform.startTimer(seconds, label);
    return Promise.resolve({
      ok: true,
      summary: `Started a ${formatDuration(seconds)} timer`,
      inverse: { tool: 'cancel_timer', args: { timerId }, description: 'Cancel the timer' },
    });
  },
});

export const cancelTimer = defineTool({
  name: 'cancel_timer',
  description: 'Cancel a running timer.',
  risk: 'read',
  internal: true,
  argsSchema: z.object({ timerId: z.string() }),
  describe: () => 'Cancel the timer',
  execute({ timerId }, { platform }) {
    const cancelled = platform.cancelTimer(timerId);
    return Promise.resolve(
      cancelled
        ? { ok: true, summary: 'Cancelled the timer' }
        : { ok: false, message: 'That timer has already finished.' },
    );
  },
});
