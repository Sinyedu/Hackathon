import { useState } from 'react';
import type { EditableSettings } from '@kiwi/shared';
import { useSettings } from './use-settings';

type Change = (patch: Partial<EditableSettings>) => void;

function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label>
      {label}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
      />
    </label>
  );
}

function VoiceSection({
  settings,
  change,
  devices,
}: {
  settings: EditableSettings;
  change: Change;
  devices: { id: string; label: string }[];
}) {
  return (
    <fieldset>
      <legend>Voice</legend>
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
      <button
        className="btn btn--ghost btn--small"
        type="button"
        onClick={() => window.kiwi.voice.test()}
      >
        Test voice
      </button>
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
      <TextField
        label="Open Kiwi shortcut"
        value={settings.panelShortcut}
        onCommit={(panelShortcut) => change({ panelShortcut })}
      />
      <TextField
        label="Tap to talk shortcut"
        value={settings.talkShortcut}
        onCommit={(talkShortcut) => change({ talkShortcut })}
      />
    </fieldset>
  );
}

function ModelSection({ settings, change }: { settings: EditableSettings; change: Change }) {
  return (
    <fieldset>
      <legend>Models (Ollama)</legend>
      <TextField
        label="Planning model"
        value={settings.planningModel}
        onCommit={(planningModel) => change({ planningModel })}
      />
      <TextField
        label="Fast model"
        value={settings.fastModel}
        onCommit={(fastModel) => change({ fastModel })}
      />
      <TextField
        label="Vision model"
        value={settings.visionModel}
        onCommit={(visionModel) => change({ visionModel })}
      />
    </fieldset>
  );
}

function DelegationSection({ settings, change }: { settings: EditableSettings; change: Change }) {
  const code = settings.codeDelegation;
  const update = (patch: Partial<typeof code>): void =>
    change({ codeDelegation: { ...code, ...patch } });
  return (
    <fieldset>
      <legend>Code delegation</legend>
      <p className="settings-note">
        Off by default. Check the hackathon rules about proprietary models before turning it on.
      </p>
      <label>
        <input
          type="checkbox"
          checked={code.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        Allow coding tasks
      </label>
      <label>
        Backend
        <select
          value={code.backend}
          onChange={(e) => update({ backend: e.target.value === 'replay' ? 'replay' : 'claude' })}
        >
          <option value="claude">Claude Code (needs the claude command)</option>
          <option value="replay">Replay (recorded demo, nothing runs)</option>
        </select>
      </label>
      <TextField
        label="Allowed project folder"
        value={code.projects[0] ?? ''}
        onCommit={(path) => update({ projects: path ? [path] : [] })}
      />
      <TextField
        label="Test command"
        value={code.testCommand}
        onCommit={(testCommand) => update({ testCommand })}
      />
    </fieldset>
  );
}

export function SettingsForm({ devices }: { devices: { id: string; label: string }[] }) {
  const { settings, change } = useSettings();
  if (!settings) return null;
  return (
    <form className="voice-settings" aria-label="Settings" onSubmit={(e) => e.preventDefault()}>
      <VoiceSection settings={settings} change={change} devices={devices} />
      <ModelSection settings={settings} change={change} />
      <fieldset>
        <legend>General</legend>
        <TextField
          label="Sandbox folder (empty = ~/KiwiSandbox)"
          value={settings.sandboxPath ?? ''}
          onCommit={(path) => change({ sandboxPath: path || null })}
        />
        <label>
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(e) => change({ launchAtLogin: e.target.checked })}
          />
          Start Kiwi when I log in
        </label>
      </fieldset>
      <DelegationSection settings={settings} change={change} />
    </form>
  );
}
