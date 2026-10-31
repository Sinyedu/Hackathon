import { z } from 'zod';

/** Off by default. Check the hackathon rules about proprietary models before enabling. */
export const codeDelegationSchema = z.object({
  enabled: z.boolean(),
  backend: z.enum(['claude', 'replay']),
  /** Absolute paths of project folders delegation may work in. */
  projects: z.array(z.string()),
  testCommand: z.string(),
});
export type CodeDelegationSettings = z.infer<typeof codeDelegationSchema>;

export const voiceSettingsSchema = z.object({
  /** Always-on "Hey Kiwi" listening. Off until the user turns it on. */
  wakeWord: z.boolean(),
  speakReplies: z.boolean(),
  inputDeviceId: z.string().nullable(),
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

/** The part of the settings the UI may read and change. */
export const editableSettingsSchema = voiceSettingsSchema.extend({
  fastModel: z.string().min(1),
  planningModel: z.string().min(1),
  visionModel: z.string().min(1),
  sandboxPath: z.string().nullable(),
  launchAtLogin: z.boolean(),
  setupDone: z.boolean(),
  panelShortcut: z.string().min(1),
  talkShortcut: z.string().min(1),
  codeDelegation: codeDelegationSchema,
});
export type EditableSettings = z.infer<typeof editableSettingsSchema>;

export const settingsSchema = z.object({
  overlayPosition: z.object({ x: z.number().int(), y: z.number().int() }).nullable().default(null),
  ollamaUrl: z.url().default('http://127.0.0.1:11434'),
  /** Used for quick, cheap model calls. */
  fastModel: z.string().min(1).default('qwen3:1.7b'),
  /** Used for the tool-calling loop. */
  planningModel: z.string().min(1).default('qwen3:1.7b'),
  /** Vision-capable model used by "what's on my screen". */
  visionModel: z.string().min(1).default('gemma3:4b'),
  /** Folder for notes and file sorting; null means ~/KiwiSandbox. */
  sandboxPath: z.string().nullable().default(null),
  setupDone: z.boolean().default(false),
  launchAtLogin: z.boolean().default(false),
  codeDelegation: codeDelegationSchema.default({
    enabled: false,
    backend: 'claude',
    projects: [],
    testCommand: 'npm test',
  }),
  panelShortcut: z.string().min(1).default('CommandOrControl+Shift+K'),
  talkShortcut: z.string().min(1).default('CommandOrControl+Shift+Space'),
  wakeWord: z.boolean().default(false),
  speakReplies: z.boolean().default(true),
  inputDeviceId: z.string().nullable().default(null),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
