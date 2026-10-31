import { useEffect, useReducer } from 'react';
import { initialChatState, reduceChat } from '@kiwi/core';

const YES = /^(y|yes|yep|yeah|ok|okay|sure|do it|go ahead)\W*$/i;
const NO = /^(n|no|nope|cancel|stop|don't)\W*$/i;

export function useChat() {
  const [state, dispatch] = useReducer(reduceChat, initialChatState);

  useEffect(() => window.kiwi.onAgentEvent(dispatch), []);

  const send = (text: string): void => {
    const { pending } = state;
    if (pending && (YES.test(text) || NO.test(text))) {
      window.kiwi.chat.confirm(pending.id, YES.test(text));
      return;
    }
    window.kiwi.chat.send(text);
  };

  return {
    ...state,
    send,
    confirm: (accepted: boolean) => {
      if (state.pending) window.kiwi.chat.confirm(state.pending.id, accepted);
    },
    undo: () => window.kiwi.chat.undo(),
    cancel: () => window.kiwi.chat.cancel(),
  };
}
