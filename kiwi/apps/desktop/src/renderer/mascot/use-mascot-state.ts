import { useEffect, useReducer, useState } from 'react';
import {
  mascotEventsFor,
  mascotEventsForVoice,
  mascotTimeoutMs,
  reduceMascot,
  type MascotState,
} from '@kiwi/core';

export interface BubbleContent {
  text: string;
  key: number;
}

/** Mascot state and the latest action label, both derived purely from agent events. */
export function useMascotState(): { state: MascotState; bubble: BubbleContent | null } {
  const [state, dispatch] = useReducer(reduceMascot, 'idle' as MascotState);
  const [bubble, setBubble] = useState<BubbleContent | null>(null);

  useEffect(
    () =>
      window.kiwi.onAgentEvent((event) => {
        for (const mascotEvent of mascotEventsFor(event)) dispatch(mascotEvent);
        if (event.type === 'receipt')
          setBubble((current) => ({ text: event.text, key: (current?.key ?? 0) + 1 }));
      }),
    [],
  );

  useEffect(
    () =>
      window.kiwi.voice.onEvent((event) => {
        for (const mascotEvent of mascotEventsForVoice(event)) dispatch(mascotEvent);
      }),
    [],
  );

  useEffect(() => {
    const delay = mascotTimeoutMs[state];
    if (delay === undefined) return;
    const timer = setTimeout(() => dispatch({ type: 'timeout' }), delay);
    return () => clearTimeout(timer);
  }, [state]);

  return { state, bubble };
}
