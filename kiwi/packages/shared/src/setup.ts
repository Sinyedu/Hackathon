import { z } from 'zod';

export const setupStatusSchema = z.object({
  ollamaRunning: z.boolean(),
  installedModels: z.array(z.string()),
  ramGb: z.number(),
  platform: z.string(),
  recommended: z.object({ fast: z.string(), planning: z.string(), vision: z.string() }),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;

export const pullProgressSchema = z.object({
  model: z.string(),
  status: z.string(),
  /** 0-100, or null while the size is not known yet. */
  percent: z.number().nullable(),
  done: z.boolean(),
  error: z.string().nullable(),
});
export type PullProgress = z.infer<typeof pullProgressSchema>;

export const setupPullSchema = z.object({ model: z.string().regex(/^[\w.:/-]{1,80}$/) });
