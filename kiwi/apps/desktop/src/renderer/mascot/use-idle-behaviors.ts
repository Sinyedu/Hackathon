import { useEffect, useState } from 'react';

type Glance = -1 | 0 | 1;

function useRandomTimer(enabled: boolean, minMs: number, maxMs: number, onFire: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (): void => {
      timer = setTimeout(
        () => {
          onFire();
          schedule();
        },
        minMs + Math.random() * (maxMs - minMs),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled, minMs, maxMs, onFire]);
}

/** Occasional blink, glance and hop while Kiwi is awake and resting. */
export function useIdleBehaviors(enabled: boolean) {
  const [blinking, setBlinking] = useState(false);
  const [glance, setGlance] = useState<Glance>(0);
  const [hopping, setHopping] = useState(false);

  useRandomTimer(enabled, 2500, 5000, () => {
    setBlinking(true);
    setTimeout(() => setBlinking(false), 160);
  });
  useRandomTimer(enabled, 4000, 8000, () => {
    setGlance(([-1, 1] as const)[Math.floor(Math.random() * 2)] ?? 0);
    setTimeout(() => setGlance(0), 1200);
  });
  useRandomTimer(enabled, 12_000, 25_000, () => {
    setHopping(true);
    setTimeout(() => setHopping(false), 500);
  });

  return { blinking, glance, hopping };
}
