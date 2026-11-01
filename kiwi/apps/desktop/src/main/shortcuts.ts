import { globalShortcut } from 'electron';
import type { Settings } from '@kiwi/shared';
import { log } from './logger';

export interface ShortcutActions {
  togglePanel: () => void;
  talk: () => void;
}

/** Registers the configured global shortcuts; call again after the settings change. */
export function registerShortcuts(settings: Settings, actions: ShortcutActions): void {
  globalShortcut.unregisterAll();
  const bindings: [string, () => void][] = [
    [settings.panelShortcut, actions.togglePanel],
    [settings.talkShortcut, actions.talk],
  ];
  for (const [accelerator, action] of bindings) {
    if (!globalShortcut.register(accelerator, action))
      log.warn(`Could not register global shortcut ${accelerator}`);
  }
}
