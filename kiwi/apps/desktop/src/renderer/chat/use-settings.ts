import { useEffect, useState } from 'react';
import type { EditableSettings } from '@kiwi/shared';

/** Loads the editable settings and writes every change straight back to the main process. */
export function useSettings() {
  const [settings, setSettings] = useState<EditableSettings | null>(null);

  useEffect(() => {
    void window.kiwi.settings.get().then(setSettings);
  }, []);

  const change = (patch: Partial<EditableSettings>): void => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    window.kiwi.settings.update(patch);
  };
  return { settings, change };
}
