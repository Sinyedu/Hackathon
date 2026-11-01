import { createVoiceSession, type VoiceSession } from '@kiwi/core';
import type { VoiceCommand, VoiceEvent } from '@kiwi/shared';
import { createMicrophoneInput } from './audio-input';
import { playChime } from './chime';
import { createTts } from './speech-synthesis-tts';
import { createWhisperStt } from './whisper-stt';

const LEVEL_INTERVAL_MS = 66;
const TEST_SENTENCE = "Hi, I'm Kiwi. If you can hear this, my voice works.";

let inputDeviceId: string | null = null;
let lastLevelAt = 0;

function report(event: VoiceEvent): void {
  if (event.type === 'level') {
    const now = performance.now();
    if (now - lastLevelAt < LEVEL_INTERVAL_MS) return;
    lastLevelAt = now;
  }
  if (event.type === 'captureStart' && event.via === 'wake') playChime();
  window.kiwi.voice.report(event);
}

/** Device labels are only available once microphone permission has been granted. */
async function reportDevices(): Promise<void> {
  const all = await navigator.mediaDevices.enumerateDevices();
  const devices = all
    .filter((device) => device.kind === 'audioinput' && device.deviceId !== '')
    .map((device) => ({ id: device.deviceId, label: device.label || 'Microphone' }));
  report({ type: 'devices', devices });
}

function handleCommand(session: VoiceSession, command: VoiceCommand): void {
  switch (command.type) {
    case 'captureStart':
      void session.startCapture(command.via);
      break;
    case 'captureEnd':
      void session.endCapture();
      break;
    case 'stopAll':
      session.stopAll();
      break;
    case 'speakTest':
      session.speakTest(TEST_SENTENCE);
      break;
    case 'configure':
      inputDeviceId = command.inputDeviceId;
      void session.configure({ wakeWord: command.wakeWord, speakReplies: command.speakReplies });
      break;
  }
}

async function start(): Promise<VoiceSession> {
  const tts = await createTts();
  if (tts.source === 'none') {
    report({
      type: 'engine',
      engine: 'textToSpeech',
      status: 'unavailable',
      message: 'No system voice found, so replies stay on screen.',
    });
  } else if (tts.source === 'system') {
    report({
      type: 'engine',
      engine: 'textToSpeech',
      status: 'fallback',
      message: "Using your computer's built-in speech.",
    });
  }

  const session = createVoiceSession({
    audio: createMicrophoneInput(() => inputDeviceId),
    stt: createWhisperStt((message) =>
      report({ type: 'engine', engine: 'speechToText', status: 'loading', message }),
    ),
    tts,
    emit: report,
    submit: (text) => window.kiwi.chat.send(text),
    now: () => performance.now(),
  });

  navigator.mediaDevices.addEventListener('devicechange', () => void reportDevices());
  void reportDevices();
  return session;
}

// Listen right away; messages that arrive while the engines are still loading wait for the session.
const ready = start();
window.kiwi.onAgentEvent((event) => void ready.then((session) => session.onAgentEvent(event)));
window.kiwi.voice.onCommand(
  (command) => void ready.then((session) => handleCommand(session, command)),
);
