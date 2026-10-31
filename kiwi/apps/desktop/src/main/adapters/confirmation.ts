import type { ConfirmationPort } from '@kiwi/core';

const CONFIRMATION_TIMEOUT_MS = 60_000;

export interface ConfirmationBridge extends ConfirmationPort {
  resolve(id: string, accepted: boolean): void;
  cancelAll(): void;
}

/** Waits for the chat UI to answer Yes or No; silence for a minute counts as No. */
export function createConfirmationBridge(
  timeoutMs: number = CONFIRMATION_TIMEOUT_MS,
): ConfirmationBridge {
  const pending = new Map<string, (accepted: boolean) => void>();

  const settle = (id: string, accepted: boolean): void => {
    pending.get(id)?.(accepted);
    pending.delete(id);
  };

  return {
    confirm: ({ id }) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => settle(id, false), timeoutMs);
        pending.set(id, (accepted) => {
          clearTimeout(timer);
          resolve(accepted);
        });
      }),
    resolve: settle,
    cancelAll() {
      for (const id of [...pending.keys()]) settle(id, false);
    },
  };
}
