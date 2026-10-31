import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@kiwi/shared';
import { StatusChip } from './StatusChip';

function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'receipt') {
    return (
      <li className="msg msg--receipt">
        <StatusChip status={message.status} />
        <span>{message.text}</span>
      </li>
    );
  }
  const streaming = message.role === 'assistant' && message.streaming;
  return (
    <li className={`msg msg--${message.role}`}>
      {message.text}
      {streaming && <span className="msg-cursor" aria-label="Kiwi is typing" />}
    </li>
  );
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">Hi, I'm Kiwi.</p>
        <p>Try “open github”, “timer 5 minutes” or “note buy milk”.</p>
      </div>
    );
  }
  return (
    <ol className="messages" aria-label="Conversation" aria-live="polite" tabIndex={0}>
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      <li ref={end} aria-hidden="true" />
    </ol>
  );
}
