import { useEffect, useState } from 'react';
import type { PullProgress, SetupStatus } from '@kiwi/shared';

export function useSetup() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [progress, setProgress] = useState<Record<string, PullProgress>>({});

  const refresh = (): void => {
    void window.kiwi.setup.status().then(setStatus);
  };

  useEffect(() => {
    refresh();
    return window.kiwi.setup.onProgress((item) => {
      setProgress((current) => ({ ...current, [item.model]: item }));
      if (item.done) refresh();
    });
  }, []);

  return { status, progress, refresh, pull: (model: string) => window.kiwi.setup.pull(model) };
}
