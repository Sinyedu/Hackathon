import { useEffect, useState } from 'react';
import type { VoiceEvent } from '@kiwi/shared';

export interface VoiceView {
  micOn: boolean;
  micLevel: number;
  mouthOpen: number;
  heard: { text: string; key: number } | null;
  /** The latest engine problem or status worth showing, e.g. a denied microphone. */
  engineNote: string | null;
  latencies: Record<string, number>;
  devices: { id: string; label: string }[];
}

const MOUTH_DECAY_MS = 140;

const initial: VoiceView = {
  micOn: false,
  micLevel: 0,
  mouthOpen: 0,
  heard: null,
  engineNote: null,
  latencies: {},
  devices: [],
};

function applyVoiceEvent(current: VoiceView, event: VoiceEvent): VoiceView {
  switch (event.type) {
    case 'micState':
      return { ...current, micOn: event.on, micLevel: event.on ? current.micLevel : 0 };
    case 'level':
      return { ...current, micLevel: event.value };
    case 'mouth':
      return { ...current, mouthOpen: event.value };
    case 'transcript':
      return { ...current, heard: { text: event.text, key: (current.heard?.key ?? 0) + 1 } };
    case 'engine':
      return { ...current, engineNote: event.status === 'ready' ? null : event.message };
    case 'devices':
      return { ...current, devices: event.devices };
    case 'latency':
      return {
        ...current,
        latencies: { ...current.latencies, [event.stage]: Math.round(event.ms) },
      };
    default:
      return current;
  }
}

/** Voice status for the UI. Reads voice events only; no audio ever reaches the renderer UI. */
export function useVoiceState(): VoiceView {
  const [view, setView] = useState<VoiceView>(initial);

  useEffect(
    () =>
      window.kiwi.voice.onEvent((event) => setView((current) => applyVoiceEvent(current, event))),
    [],
  );

  useEffect(() => {
    if (view.mouthOpen === 0) return;
    const timer = setTimeout(
      () => setView((current) => ({ ...current, mouthOpen: 0 })),
      MOUTH_DECAY_MS,
    );
    return () => clearTimeout(timer);
  }, [view.mouthOpen]);

  return view;
}
