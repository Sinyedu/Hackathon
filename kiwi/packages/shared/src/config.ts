import { z } from 'zod';

const platformSchema = z.enum(['win32', 'darwin', 'linux']);

const launchSchema = z.union([
  z.object({ command: z.string().min(1), args: z.array(z.string()).default([]) }),
  z.object({ uri: z.string().min(1) }),
]);

export const appsConfigSchema = z.object({
  apps: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      aliases: z.array(z.string()).default([]),
      launch: z.record(platformSchema, launchSchema),
    }),
  ),
});
export type AppsConfig = z.infer<typeof appsConfigSchema>;
export type AppEntry = AppsConfig['apps'][number];

export const sitesConfigSchema = z.object({
  sites: z.array(
    z.object({
      name: z.string().min(1),
      aliases: z.array(z.string()).default([]),
      url: z.url(),
    }),
  ),
  searchUrls: z.object({ web: z.string().includes('{q}'), youtube: z.string().includes('{q}') }),
});
export type SitesConfig = z.infer<typeof sitesConfigSchema>;

export const commandSchema = z.object({
  id: z.string(),
  tool: z.string(),
  /** Phrases with {slot} placeholders. Slots: target, text, amount, unit. */
  patterns: z.array(z.string()).min(1),
  /** Fixed arguments merged into the tool call. */
  args: z.record(z.string(), z.unknown()).default({}),
  /** Maps a slot name to the tool argument it fills, e.g. { "text": "topic" }. */
  slotArgs: z.record(z.string(), z.string()).default({}),
});

export const commandsConfigSchema = z.object({
  fillers: z.array(z.string()),
  trailingFillers: z.array(z.string()),
  numberWords: z.record(z.string(), z.number()),
  units: z.record(z.enum(['seconds', 'minutes', 'hours']), z.array(z.string())),
  commands: z.array(commandSchema),
});
export type CommandsConfig = z.infer<typeof commandsConfigSchema>;
export type CommandEntry = z.infer<typeof commandSchema>;
