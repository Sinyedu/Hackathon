import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createSystemSpeech } from './system-speech';

function fakeChild(outcome: 'close' | 'error', onStdin: (text: string) => void): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  const stdin = new PassThrough();
  let text = '';
  stdin.on('data', (chunk: Buffer) => (text += chunk.toString()));
  stdin.on('end', () => onStdin(text));
  Object.assign(child, { stdin, kill: () => child.emit('close') || true });
  setImmediate(() => child.emit(outcome));
  return child;
}

describe('createSystemSpeech', () => {
  it('sends the sentence on stdin, never inside a shell string', async () => {
    const calls: { command: string; args: string[] }[] = [];
    let heard = '';
    const speech = createSystemSpeech((command, args) => {
      calls.push({ command, args });
      return fakeChild('close', (text) => (heard = text));
    });
    await speech.speak('Hello; rm -rf /');
    if (process.platform === 'linux') {
      expect(calls[0]?.command).toBe('espeak-ng');
      expect(calls[0]?.args).not.toContain('Hello; rm -rf /');
      expect(heard).toBe('Hello; rm -rf /');
    }
  });

  it('falls back to the next command when one is missing', async () => {
    const used: string[] = [];
    const speech = createSystemSpeech((command) => {
      used.push(command);
      return fakeChild(command === 'espeak-ng' ? 'error' : 'close', () => undefined);
    });
    await speech.speak('hi');
    if (process.platform === 'linux') expect(used).toEqual(['espeak-ng', 'spd-say']);
  });

  it('reports availability from whether a command can start', async () => {
    const present = createSystemSpeech(() => fakeChild('close', () => undefined));
    const absent = createSystemSpeech(() => fakeChild('error', () => undefined));
    expect(await present.available()).toBe(true);
    if (process.platform === 'linux') expect(await absent.available()).toBe(false);
  });
});
