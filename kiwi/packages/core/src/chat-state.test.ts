import type { AgentEvent, VoiceEvent } from '@kiwi/shared';
import { describe, expect, it } from 'vitest';
import { initialChatState, reduceChat } from './chat-state';
import { mascotEventsFor, mascotEventsForVoice } from './mascot-events';

const apply = (events: AgentEvent[]) => events.reduce(reduceChat, initialChatState);

describe('reduceChat', () => {
  it('streams assistant text into one message and finalizes it', () => {
    const state = apply([
      { type: 'userMessage', id: 'u', text: 'hi' },
      { type: 'assistantDelta', id: 'a', text: 'Hel' },
      { type: 'assistantDelta', id: 'a', text: 'lo' },
      { type: 'assistantDone', id: 'a' },
    ]);
    expect(state.messages).toEqual([
      { id: 'u', role: 'user', text: 'hi' },
      { id: 'a', role: 'assistant', text: 'Hello', streaming: false },
    ]);
    expect(state.busy).toBe(true);
  });

  it('drops empty assistant messages', () => {
    const state = apply([
      { type: 'assistantDelta', id: 'a', text: '' },
      { type: 'assistantDone', id: 'a' },
    ]);
    expect(state.messages).toEqual([]);
  });

  it('upgrades a planned receipt in place', () => {
    const state = apply([
      { type: 'receipt', id: 'r', status: 'PLANNED', text: 'Save note' },
      { type: 'receipt', id: 'r', status: 'DONE', text: 'Saved note' },
    ]);
    expect(state.messages).toEqual([
      { id: 'r', role: 'receipt', status: 'DONE', text: 'Saved note' },
    ]);
  });

  it('tracks pending confirmations and clears them when the run ends', () => {
    const pending = apply([{ type: 'confirmationRequested', id: 'r', lines: ['Save note'] }]);
    expect(pending.pending).toEqual({ id: 'r', lines: ['Save note'] });
    expect(reduceChat(pending, { type: 'runFinished', outcome: 'cancelled' })).toMatchObject({
      pending: null,
      busy: false,
    });
  });

  it('shows notices as assistant messages', () => {
    expect(apply([{ type: 'notice', text: 'Timer finished' }]).messages[0]).toMatchObject({
      role: 'assistant',
      text: 'Timer finished',
    });
  });
});

describe('mascotEventsFor', () => {
  it.each<[AgentEvent, string[]]>([
    [{ type: 'thinking' }, ['thinkStart']],
    [{ type: 'toolStarted', name: 'x' }, ['toolStart']],
    [{ type: 'toolFinished', name: 'x', ok: true }, ['toolEnd']],
    [{ type: 'runFinished', outcome: 'done' }, ['succeed']],
    [{ type: 'runFinished', outcome: 'error' }, ['fail']],
    [{ type: 'runFinished', outcome: 'cancelled' }, ['cancel']],
    [{ type: 'assistantDone', id: 'a' }, []],
  ])('%j', (event, expected) => {
    expect(mascotEventsFor(event).map((e) => e.type)).toEqual(expected);
  });
});

describe('mascotEventsForVoice', () => {
  it.each<[VoiceEvent, string[]]>([
    [{ type: 'captureStart', via: 'wake' }, ['listenStart']],
    [{ type: 'captureEnd' }, ['listenEnd']],
    [{ type: 'speakStart' }, ['speakStart']],
    [{ type: 'speakEnd' }, ['speakEnd']],
    [{ type: 'stopped' }, ['cancel']],
    [{ type: 'level', value: 0.5 }, []],
    [{ type: 'transcript', text: 'x' }, []],
  ])('%j', (event, expected) => {
    expect(mascotEventsForVoice(event).map((e) => e.type)).toEqual(expected);
  });
});
