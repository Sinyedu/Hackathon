import { z } from 'zod';
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

export type SttCall =
  { type: 'load'; model: string } | { type: 'transcribe'; samples: Float32Array };
export type SttRequest = SttCall & { id: number };

export type SttResponse =
  { id: number; ok: true; text?: string } | { id: number; ok: false; message: string };

env.allowLocalModels = false;

let recognizer: AutomaticSpeechRecognitionPipeline | null = null;

async function load(model: string): Promise<void> {
  if (recognizer) return;
  const created = await pipeline('automatic-speech-recognition', model, {
    dtype: 'q8',
    device: 'wasm',
  });
  recognizer = created;
}

const outputSchema = z.union([
  z.object({ text: z.string() }),
  z.array(z.object({ text: z.string() })),
]);

async function transcribe(samples: Float32Array): Promise<string> {
  if (!recognizer) throw new Error('The speech model is not loaded.');
  const output = outputSchema.parse(await recognizer(samples));
  return (Array.isArray(output) ? output[0]?.text : output.text) ?? '';
}

self.onmessage = (message: MessageEvent<SttRequest>): void => {
  const request = message.data;
  const work =
    request.type === 'load'
      ? load(request.model).then(() => undefined)
      : transcribe(request.samples);
  work
    .then((text) => self.postMessage({ id: request.id, ok: true, text } satisfies SttResponse))
    .catch((error: unknown) =>
      self.postMessage({ id: request.id, ok: false, message: String(error) } satisfies SttResponse),
    );
};
