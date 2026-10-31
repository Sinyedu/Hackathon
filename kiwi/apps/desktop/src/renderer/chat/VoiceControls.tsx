import { useEffect, useState } from 'react';
import type { VoiceSettings } from '@kiwi/shared';

const noop = (): void => undefined;

/** Hold the button to talk; releasing (or leaving it) sends what was said. */
export function MicButton({ active }: { active: boolean }) {
  return (
    <button
      className="btn btn--ghost"
      type="button"
      aria-pressed={active}
      aria-label="Hold to talk"
      onPointerDown={() => window.kiwi.voice.pushStart()}
      onPointerUp={() => window.kiwi.voice.pushEnd()}
      onPointerLeave={active ? () => window.kiwi.voice.pushEnd() : noop}
      onKeyDown={(event) => {
        if (event.key === ' ' && !event.repeat) window.kiwi.voice.pushStart();
      }}
      onKeyUp={(event) => {
        if (event.key === ' ') window.kiwi.voice.pushEnd();
      }}
    >
      {active ? 'Listening…' : 'Hold to talk'}
    </button>
  );
}

export function VoiceSettingsForm({ devices }: { devices: { id: string; label: string }[] }) {
  const [settings, setSettings] = useState<VoiceSettings | null>(null);

  useEffect(() => {
    void window.kiwi.settings.get().then(setSettings);
  }, []);

  if (!settings) return null;
  const change = (patch: Partial<VoiceSettings>): void => {
    setSettings({ ...settings, ...patch });
    window.kiwi.settings.update(patch);
  };

  return (
    <form className="voice-settings" aria-label="Voice settings">
      <label>
        <input
          type="checkbox"
          checked={settings.wakeWord}
          onChange={(e) => change({ wakeWord: e.target.checked })}
        />
        Always listen for “Hey Kiwi”
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.speakReplies}
          onChange={(e) => change({ speakReplies: e.target.checked })}
        />
        Speak replies
      </label>
      <label>
        Microphone
        <select
          value={settings.inputDeviceId ?? ''}
          onChange={(e) => change({ inputDeviceId: e.target.value || null })}
        >
          <option value="">System default</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
