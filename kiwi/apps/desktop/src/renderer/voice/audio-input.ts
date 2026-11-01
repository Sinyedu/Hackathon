import { SAMPLE_RATE, type AudioInputPort } from '@kiwi/core';
import workletUrl from './capture.worklet.js?url';

interface Handle {
  context: AudioContext;
  stream: MediaStream;
}

function describeError(error: unknown): {
  reason: 'denied' | 'no_device' | 'error';
  message: string;
} {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      reason: 'denied',
      message:
        'Microphone access was denied. Allow it in your system privacy settings, then try again.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      reason: 'no_device',
      message: 'No microphone was found. Plug one in or pick another input device in settings.',
    };
  }
  return { reason: 'error', message: `The microphone could not start: ${String(error)}` };
}

/** Microphone as 16 kHz mono frames. Audio stays in memory and is never saved. */
export function createMicrophoneInput(getDeviceId: () => string | null): AudioInputPort {
  let handle: Handle | null = null;

  return {
    async start(onFrame) {
      try {
        const deviceId = getDeviceId();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          },
        });
        const context = new AudioContext({ sampleRate: SAMPLE_RATE });
        await context.audioWorklet.addModule(workletUrl);
        const node = new AudioWorkletNode(context, 'kiwi-capture');
        node.port.onmessage = (message: MessageEvent<Float32Array>): void => onFrame(message.data);
        context.createMediaStreamSource(stream).connect(node);
        handle = { context, stream };
        return { ok: true };
      } catch (error) {
        return { ok: false, ...describeError(error) };
      }
    },
    stop() {
      handle?.stream.getTracks().forEach((track) => track.stop());
      void handle?.context.close();
      handle = null;
    },
  };
}
