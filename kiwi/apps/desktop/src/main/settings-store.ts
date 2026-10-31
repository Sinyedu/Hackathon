import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { defaultSettings, settingsSchema, type Settings } from '@kiwi/shared';

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json');

export function loadSettings(): Settings {
  let raw: string;
  try {
    raw = readFileSync(settingsPath(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultSettings;
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    console.warn(`settings.json is not valid JSON, using defaults: ${String(error)}`);
    return defaultSettings;
  }
  const parsed = settingsSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  console.warn(`settings.json is invalid, using defaults: ${parsed.error.message}`);
  return defaultSettings;
}

export function saveSettings(settings: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}
