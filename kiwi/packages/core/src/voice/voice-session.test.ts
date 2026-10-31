import { describe, expect, it } from 'vitest';
import { createTestVoice } from './testing';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const types = (events: { type: string }[]): string[] => events.map((e) => e.type);

describe('push-to-talk', () => {
  it('records while held, transcribes on release and submits the command', async () => {
    const { session, events, submitted, audio } = createTestVoice(['open github']);
    await session.startCapture('push');
    audio.push(0.2, 600);
    await session.endCapture();
    expect(submitted).toEqual(['open github']);
    expect(events).toContainEqual({ type: 'transcript', text: 'open github' });
    expect(types(events)).toContain('captureStart');
    expect(types(events)).toContain('captureEnd');
  });

  it('opens the mic only for the capture when wake word is off, and shows the indicator', async () => {
    const { session, events, audio } = createTestVoice(['hello']);
    await session.startCapture('push');
    expect(audio.running()).toBe(true);
    expect(events).toContainEqual({ type: 'micState', on: true });
    await session.endCapture();
    expect(audio.running()).toBe(false);
    expect(events).toContainEqual({ type: 'micState', on: false });
  });

  it('does not stop on silence in push mode', async () => {
    const { session, audio, submitted } = createTestVoice(['x']);
    await session.startCapture('push');
    audio.push(0.2, 300);
    audio.push(0, 3000);
    expect(submitted).toEqual([]);
    await session.endCapture();
    expect(submitted).toEqual(['x']);
  });
});

describe('tap-to-talk', () => {
  it('ends after 0.8 s of silence', async () => {
    const { session, audio, submitted } = createTestVoice(['volume down']);
    await session.startCapture('tap');
    audio.push(0.2, 600);
    audio.push(0, 1000);
    await settle();
    expect(submitted).toEqual(['volume down']);
  });

  it('discards a capture that was only a short noise burst', async () => {
    const { session, audio, submitted, stt } = createTestVoice(['noise']);
    await session.startCapture('tap');
    audio.push(0.2, 100);
    audio.push(0, 1000);
    await settle();
    expect(submitted).toEqual([]);
    expect(stt.calls).toBe(0);
  });
});

describe('wake word', () => {
  const speech = (audio: { push(level: number, ms: number): void }): void => {
    audio.push(0, 400);
    audio.push(0.2, 600);
    audio.push(0, 700);
  };

  it('opens the mic when enabled and submits "hey kiwi <command>" directly', async () => {
    const { session, audio, submitted } = createTestVoice(['Hey Kiwi, open github']);
    await session.configure({ wakeWord: true, speakReplies: true });
    expect(audio.running()).toBe(true);
    speech(audio);
    await settle();
    expect(submitted).toEqual(['open github']);
  });

  it('listens for the command after a bare "hey kiwi"', async () => {
    const { session, audio, submitted, events } = createTestVoice([
      'hey kiwi',
      'set a timer for one minute',
    ]);
    await session.configure({ wakeWord: true, speakReplies: true });
    speech(audio);
    await settle();
    expect(events).toContainEqual({ type: 'captureStart', via: 'wake' });
    audio.push(0.2, 600);
    audio.push(0, 1000);
    await settle();
    expect(submitted).toEqual(['set a timer for one minute']);
  });

  it('ignores ordinary speech', async () => {
    const { session, audio, submitted } = createTestVoice(['the weather is nice today']);
    await session.configure({ wakeWord: true, speakReplies: true });
    speech(audio);
    await settle();
    expect(submitted).toEqual([]);
  });

  it('does not retrigger inside the cooldown', async () => {
    const { session, audio, submitted } = createTestVoice([
      'kiwi open github',
      'kiwi open spotify',
    ]);
    await session.configure({ wakeWord: true, speakReplies: true });
    speech(audio);
    await settle();
    speech(audio);
    await settle();
    expect(submitted).toEqual(['open github']);
  });

  it('stops everything on "kiwi stop"', async () => {
    const { session, audio, events, tts } = createTestVoice(['kiwi stop']);
    await session.configure({ wakeWord: true, speakReplies: true });
    speech(audio);
    await settle();
    expect(types(events)).toContain('stopped');
    expect(tts.cancelled).toBeGreaterThan(0);
  });

  it('keeps the mic open after a capture when wake word is on', async () => {
    const { session, audio } = createTestVoice(['x']);
    await session.configure({ wakeWord: true, speakReplies: true });
    await session.startCapture('push');
    await session.endCapture();
    expect(audio.running()).toBe(true);
  });
});

describe('spoken replies', () => {
  it('speaks the fast-path receipt for a voice command, sentence by sentence', async () => {
    const { session, tts, events } = createTestVoice(['open github']);
    await session.startCapture('push');
    await session.endCapture();
    session.onAgentEvent({ type: 'receipt', id: 'r', status: 'DONE', text: 'Opened github.com' });
    expect(tts.spoken).toEqual(['Opened github.com']);
    expect(types(events)).toContain('speakStart');
    expect(events.some((e) => e.type === 'latency' && e.stage === 'transcriptToSpeech')).toBe(true);
    tts.finishCurrent();
    expect(types(events)).toContain('speakEnd');
  });

  it('speaks model replies in order and skips the duplicate receipt', async () => {
    const { session, tts } = createTestVoice(['hello']);
    await session.startCapture('push');
    await session.endCapture();
    session.onAgentEvent({ type: 'thinking' });
    session.onAgentEvent({ type: 'receipt', id: 'r', status: 'DONE', text: 'Opened github.com' });
    session.onAgentEvent({ type: 'assistantDelta', id: 'a', text: 'Done. All ' });
    session.onAgentEvent({ type: 'assistantDelta', id: 'a', text: 'set.' });
    session.onAgentEvent({ type: 'assistantDone', id: 'a' });
    expect(tts.spoken).toEqual(['Done.']);
    tts.finishCurrent();
    expect(tts.spoken).toEqual(['Done.', 'All set.']);
  });

  it('stays silent for typed commands and when disabled', async () => {
    const typed = createTestVoice([]);
    typed.session.onAgentEvent({
      type: 'receipt',
      id: 'r',
      status: 'DONE',
      text: 'Opened github.com',
    });
    expect(typed.tts.spoken).toEqual([]);

    const muted = createTestVoice(['hi']);
    await muted.session.configure({ wakeWord: false, speakReplies: false });
    await muted.session.startCapture('push');
    await muted.session.endCapture();
    muted.session.onAgentEvent({ type: 'receipt', id: 'r', status: 'DONE', text: 'Done' });
    expect(muted.tts.spoken).toEqual([]);
  });

  it('cancels speech when stopped', async () => {
    const { session, tts, events } = createTestVoice(['hi']);
    await session.startCapture('push');
    await session.endCapture();
    session.onAgentEvent({ type: 'receipt', id: 'r', status: 'DONE', text: 'Done' });
    session.stopAll();
    expect(tts.cancelled).toBeGreaterThan(0);
    expect(types(events)).toContain('speakEnd');
  });

  it('is silent without a speech engine', async () => {
    const { session, tts } = createTestVoice(['hi'], { ttsAvailable: false });
    await session.startCapture('push');
    await session.endCapture();
    session.onAgentEvent({ type: 'receipt', id: 'r', status: 'DONE', text: 'Done' });
    expect(tts.spoken).toEqual([]);
  });
});
