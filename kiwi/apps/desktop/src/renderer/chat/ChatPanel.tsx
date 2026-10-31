import type { MascotState } from '@kiwi/core';
import type { ChatMessage } from '@kiwi/shared';
import './chat.css';
import { Composer } from './Composer';
import { ConfirmBar } from './ConfirmBar';
import { MessageList } from './MessageList';
import { PanelHeader } from './PanelHeader';
import { QuickActions } from './QuickActions';
import { SettingsForm } from './SettingsForm';
import { MicButton } from './VoiceControls';

interface ChatPanelProps {
  state: MascotState;
  messages: ChatMessage[];
  micActive?: boolean;
  /** True while an action is waiting for Yes or No. */
  confirming?: boolean;
  busy?: boolean;
  onSend: (text: string) => void;
  onConfirm?: (accepted: boolean) => void;
  onUndo?: () => void;
  onCancel?: () => void;
  /** Voice extras; absent in the static gallery. */
  voice?: {
    engineNote: string | null;
    devices: { id: string; label: string }[];
    latencies: Record<string, number>;
  };
}

export function ChatPanel(props: ChatPanelProps) {
  const { state, messages, micActive = false, confirming = false, busy = false } = props;
  return (
    <main className="panel">
      <PanelHeader state={state} micActive={micActive} onUndo={props.onUndo} />
      {props.voice?.engineNote && (
        <p className="engine-note" role="status">
          {props.voice.engineNote}
        </p>
      )}
      <MessageList messages={messages} />
      {messages.length === 0 && <QuickActions onPick={props.onSend} />}
      {confirming && props.onConfirm && <ConfirmBar onAnswer={props.onConfirm} />}
      {busy && !confirming && props.onCancel && (
        <button className="btn btn--ghost" type="button" onClick={props.onCancel}>
          Stop
        </button>
      )}
      <Composer disabled={busy && !confirming} onSend={props.onSend} />
      {props.voice && (
        <>
          <div className="panel-actions">
            <MicButton active={micActive} />
          </div>
          <details>
            <summary>Settings</summary>
            <SettingsForm devices={props.voice.devices} />
          </details>
          {import.meta.env.DEV && (
            <p className="debug-latency">
              {Object.entries(props.voice.latencies)
                .map(([stage, ms]) => `${stage} ${ms}ms`)
                .join(' · ') || 'No voice latency yet'}
            </p>
          )}
        </>
      )}
    </main>
  );
}
