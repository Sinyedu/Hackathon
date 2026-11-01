import type { ReceiptStatus } from '@kiwi/shared';

const symbols: Record<ReceiptStatus, string> = {
  DONE: '✓',
  PLANNED: '…',
  FAILED: '✕',
  UNDONE: '↺',
};

/** Status is conveyed by both a symbol and a word, never by color alone. */
export function StatusChip({ status }: { status: ReceiptStatus }) {
  return (
    <span className={`chip chip--${status.toLowerCase()}`}>
      <span aria-hidden="true">{symbols[status]} </span>
      {status}
    </span>
  );
}
