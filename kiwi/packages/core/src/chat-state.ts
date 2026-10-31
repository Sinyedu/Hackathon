import type { AgentEvent, ChatMessage } from '@kiwi/shared';

export interface PendingConfirmation {
  id: string;
  lines: string[];
}

export interface ChatState {
  messages: ChatMessage[];
  pending: PendingConfirmation | null;
  busy: boolean;
}

export const initialChatState: ChatState = { messages: [], pending: null, busy: false };

function upsert(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const index = messages.findIndex((candidate) => candidate.id === message.id);
  if (index === -1) return [...messages, message];
  return messages.map((candidate, position) => (position === index ? message : candidate));
}

const append = (state: ChatState, message: ChatMessage): ChatState => ({
  ...state,
  messages: [...state.messages, message],
});

function reduceAssistantDelta(state: ChatState, id: string, delta: string): ChatState {
  const existing = state.messages.find((message) => message.id === id);
  const text = (existing?.role === 'assistant' ? existing.text : '') + delta;
  return {
    ...state,
    messages: upsert(state.messages, { id, role: 'assistant', text, streaming: true }),
  };
}

function finishAssistant(state: ChatState, id: string): ChatState {
  const messages = state.messages.flatMap((message) => {
    if (message.id !== id || message.role !== 'assistant') return [message];
    return message.text.trim() === '' ? [] : [{ ...message, streaming: false }];
  });
  return { ...state, messages };
}

export function reduceChat(state: ChatState, event: AgentEvent): ChatState {
  switch (event.type) {
    case 'userMessage':
      return append({ ...state, busy: true }, { id: event.id, role: 'user', text: event.text });
    case 'assistantDelta':
      return reduceAssistantDelta(state, event.id, event.text);
    case 'assistantDone':
      return finishAssistant(state, event.id);
    case 'receipt': {
      const receipt = {
        id: event.id,
        role: 'receipt',
        status: event.status,
        text: event.text,
      } as const;
      return { ...state, messages: upsert(state.messages, receipt) };
    }
    case 'confirmationRequested':
      return { ...state, pending: { id: event.id, lines: event.lines } };
    case 'confirmationResolved':
      return { ...state, pending: null };
    case 'notice':
      return append(state, {
        id: `notice-${state.messages.length}`,
        role: 'assistant',
        text: event.text,
        streaming: false,
      });
    case 'runFinished':
      return { ...state, busy: false, pending: null };
    default:
      return state;
  }
}
