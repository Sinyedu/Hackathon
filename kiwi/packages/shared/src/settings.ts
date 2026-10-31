import { z } from 'zod';

export const settingsSchema = z.object({
  overlayPosition: z.object({ x: z.number().int(), y: z.number().int() }).nullable().default(null),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
