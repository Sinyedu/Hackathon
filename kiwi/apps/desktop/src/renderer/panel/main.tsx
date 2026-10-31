import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatMessage } from '@kiwi/shared';
import { ChatPanel } from '../chat/ChatPanel';
import '../styles/tokens.css';

function Panel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') window.kiwi.panel.hide();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const send = (text: string): void =>
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }]);

  return <ChatPanel state="idle" messages={messages} onSend={send} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
