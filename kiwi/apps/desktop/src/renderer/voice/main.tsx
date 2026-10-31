import { createVoiceSession } from '@kiwi/core';
import type { VoiceEvent } from '@kiwi/shared';
import { createMicrophoneInput } from './audio-input';
import { playChime } from './chime';
import { createSpeechSynthesisTts } from './speech-synthesis-tts';
import { createWhisperStt } from './whisper-stt';

const LEVEL_INTERVAL_MS = 66;

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

const tts = createSpeechSynthesisTts();
if (!tts.isAvailable()) {
  report({
    type: 'engine',
    engine: 'textToSpeech',
    status: 'unavailable',
    message: 'No system voice found. Replies stay on screen.',
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

window.kiwi.onAgentEvent((event) => session.onAgentEvent(event));

/** Device labels are only available once microphone permission has been granted. */
async function reportDevices(): Promise<void> {
  const all = await navigator.mediaDevices.enumerateDevices();
  const devices = all
    .filter((device) => device.kind === 'audioinput' && device.deviceId !== '')
    .map((device) => ({ id: device.deviceId, label: device.label || 'Microphone' }));
  report({ type: 'devices', devices });
}

navigator.mediaDevices.addEventListener('devicechange', () => void reportDevices());
void reportDevices();
window.kiwi.voice.onCommand((command) => {
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
    case 'configure':
      inputDeviceId = command.inputDeviceId;
      void session.configure({ wakeWord: command.wakeWord, speakReplies: command.speakReplies });
      break;
  }
});
