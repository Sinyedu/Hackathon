import { defaultSettings, settingsSchema, type Settings } from '@kiwi/shared';
import { loadConfig, saveConfig, type LoadedConfig } from './adapters/config-files';

export const loadSettings = (): LoadedConfig<Settings> =>
  loadConfig('settings.json', settingsSchema, defaultSettings);

export const saveSettings = (settings: Settings): void => saveConfig('settings.json', settings);
