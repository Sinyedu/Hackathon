import type { AgentEvent } from '@kiwi/shared';

/** Emits a complete assistant message in one go. */
export function say(
  deps: { emit: (event: AgentEvent) => void; newId: () => string },
  text: string,
): void {
  const id = deps.newId();
  deps.emit({ type: 'assistantDelta', id, text });
  deps.emit({ type: 'assistantDone', id });
}
