import { describe, expect, it } from 'vitest';
import { isWakeWord, parseWakeUtterance } from './wake-phrase';

describe('isWakeWord', () => {
  it.each(['kiwi', 'Kiwi', 'kivi', 'keewee', 'kiwy', 'kewi', 'keewi'])('accepts %s', (word) => {
    expect(isWakeWord(word)).toBe(true);
  });

  it.each(['key', 'quiz', 'hello', 'we', 'kitchen', 'giraffe', ''])('rejects %j', (word) => {
    expect(isWakeWord(word)).toBe(false);
  });
});

describe('parseWakeUtterance', () => {
  it.each([
    ['Hey Kiwi.', ''],
    ['hey kiwi open github', 'open github'],
    ['Kiwi, set a timer for one minute', 'set a timer for one minute'],
    ['hey kivi what time is it', 'what time is it'],
    ['hey key we open spotify', 'open spotify'],
    ['okay keewee volume down', 'volume down'],
  ])('wakes on %j', (text, command) => {
    expect(parseWakeUtterance(text)).toEqual({ kind: 'wake', command });
  });

  it.each(['kiwi stop', 'Hey Kiwi, stop!', 'kiwi cancel'])('stops on %j', (text) => {
    expect(parseWakeUtterance(text)).toEqual({ kind: 'stop' });
  });

  it.each(['open github', 'what is the weather', 'the kiwi bird is green', '', 'hey there'])(
    'ignores %j',
    (text) => {
      expect(parseWakeUtterance(text)).toEqual({ kind: 'none' });
    },
  );
});
