import type { SpeechToTextPort } from '@kiwi/core';
import type { SttCall, SttResponse } from './stt.worker';

const DEFAULT_MODEL = 'onnx-community/whisper-tiny.en';

/** Whisper running in a worker through WebAssembly. The model is downloaded once on first use. */
export function createWhisperStt(
  onStatus: (message: string) => void,
  model: string = DEFAULT_MODEL,
): SpeechToTextPort {
  const worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<
    number,
    { resolve: (text: string) => void; reject: (error: Error) => void }
  >();
  let nextId = 0;
  let loading: Promise<void> | null = null;

  worker.onmessage = (message: MessageEvent<SttResponse>): void => {
    const response = message.data;
    const waiter = pending.get(response.id);
    pending.delete(response.id);
    if (!waiter) return;
    if (response.ok) waiter.resolve(response.text ?? '');
    else waiter.reject(new Error(response.message));
  };

  const call = (request: SttCall, transfer: Transferable[] = []): Promise<string> =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1);
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...request, id }, transfer);
    });

  return {
    load() {
      loading ??= (async () => {
        onStatus('Downloading the speech model (first run only)…');
        await call({ type: 'load', model });
        onStatus('Speech model ready.');
      })().catch((error: unknown) => {
        loading = null;
        throw error;
      });
      return loading;
    },
    transcribe: (samples) => call({ type: 'transcribe', samples }, [samples.buffer]),
  };
}
