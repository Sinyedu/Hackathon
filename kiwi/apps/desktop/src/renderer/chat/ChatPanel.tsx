import type { MascotState } from '@kiwi/core';
import type { ChatMessage } from '@kiwi/shared';
import './chat.css';
import { Composer } from './Composer';
import { ConfirmBar } from './ConfirmBar';
import { MessageList } from './MessageList';
import { PanelHeader } from './PanelHeader';
import { QuickActions } from './QuickActions';

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
}

export function ChatPanel(props: ChatPanelProps) {
  const { state, messages, micActive = false, confirming = false, busy = false } = props;
  return (
    <main className="panel">
      <PanelHeader state={state} micActive={micActive} onUndo={props.onUndo} />
      <MessageList messages={messages} />
      {messages.length === 0 && <QuickActions onPick={props.onSend} />}
      {confirming && props.onConfirm && <ConfirmBar onAnswer={props.onConfirm} />}
      {busy && !confirming && props.onCancel && (
        <button className="btn btn--ghost" type="button" onClick={props.onCancel}>
          Stop
        </button>
      )}
      <Composer disabled={busy && !confirming} onSend={props.onSend} />
    </main>
  );
}
