import { describe, expect, it } from 'vitest';
import { mascotTimeoutMs, reduceMascot, type MascotEvent, type MascotState } from './mascot';

const transitions: [MascotState, MascotEvent['type'], MascotState][] = [
  ['sleeping', 'wake', 'waking'],
  ['idle', 'wake', 'idle'],
  ['idle', 'listenStart', 'listening'],
  ['sleeping', 'listenStart', 'listening'],
  ['listening', 'listenEnd', 'thinking'],
  ['idle', 'listenEnd', 'idle'],
  ['idle', 'thinkStart', 'thinking'],
  ['thinking', 'toolStart', 'working'],
  ['working', 'toolEnd', 'thinking'],
  ['idle', 'toolEnd', 'idle'],
  ['thinking', 'speakStart', 'speaking'],
  ['speaking', 'speakEnd', 'done'],
  ['idle', 'speakEnd', 'idle'],
  ['thinking', 'succeed', 'done'],
  ['working', 'fail', 'error'],
  ['listening', 'cancel', 'idle'],
  ['thinking', 'cancel', 'idle'],
  ['working', 'cancel', 'idle'],
  ['speaking', 'cancel', 'idle'],
  ['done', 'cancel', 'done'],
  ['error', 'cancel', 'error'],
  ['waking', 'timeout', 'idle'],
  ['done', 'timeout', 'idle'],
  ['error', 'timeout', 'idle'],
  ['idle', 'timeout', 'sleeping'],
  ['sleeping', 'timeout', 'sleeping'],
  ['thinking', 'timeout', 'thinking'],
];

describe('reduceMascot', () => {
  it.each(transitions)('%s + %s -> %s', (from, event, to) => {
    expect(reduceMascot(from, { type: event })).toBe(to);
  });

  it('defines timeouts only for states that expire', () => {
    expect(Object.keys(mascotTimeoutMs).sort()).toEqual(['done', 'error', 'idle', 'waking']);
  });
});
