import type { MascotState } from '@kiwi/core';
import type { ChatMessage } from '@kiwi/shared';
import './chat.css';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { PanelHeader } from './PanelHeader';
import { QuickActions } from './QuickActions';

interface ChatPanelProps {
  state: MascotState;
  messages: ChatMessage[];
  micActive?: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ state, messages, micActive = false, onSend }: ChatPanelProps) {
  return (
    <main className="panel">
      <PanelHeader state={state} micActive={micActive} />
      <MessageList messages={messages} />
      {messages.length === 0 && <QuickActions onPick={onSend} />}
      <Composer onSend={onSend} />
    </main>
  );
}
