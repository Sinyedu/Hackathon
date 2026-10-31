import { z } from 'zod';

export const voiceSettingsSchema = z.object({
  /** Always-on "Hey Kiwi" listening. Off until the user turns it on. */
  wakeWord: z.boolean(),
  speakReplies: z.boolean(),
  inputDeviceId: z.string().nullable(),
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

export const settingsSchema = z.object({
  overlayPosition: z.object({ x: z.number().int(), y: z.number().int() }).nullable().default(null),
  ollamaUrl: z.url().default('http://127.0.0.1:11434'),
  /** Used for quick, cheap model calls. */
  fastModel: z.string().min(1).default('qwen3:1.7b'),
  /** Used for the tool-calling loop. */
  planningModel: z.string().min(1).default('qwen3:1.7b'),
  /** Always-on "Hey Kiwi" listening. Off until the user turns it on. */
  wakeWord: z.boolean().default(false),
  speakReplies: z.boolean().default(true),
  inputDeviceId: z.string().nullable().default(null),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
