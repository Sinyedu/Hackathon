import { z } from 'zod';

export const settingsSchema = z.object({
  overlayPosition: z.object({ x: z.number().int(), y: z.number().int() }).nullable().default(null),
  ollamaUrl: z.url().default('http://127.0.0.1:11434'),
  /** Used for quick, cheap model calls. */
  fastModel: z.string().min(1).default('qwen3:1.7b'),
  /** Used for the tool-calling loop. */
  planningModel: z.string().min(1).default('qwen3:1.7b'),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
