import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@kiwi/shared';
import { StatusChip } from './StatusChip';

function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'receipt') {
    return (
      <li className="msg msg--receipt">
        <StatusChip status={message.status} />
        <span>{message.text}</span>
        {message.image && (
          <img className="proof" src={message.image} alt="Screenshot Kiwi looked at" />
        )}
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
        <p className="empty-kicker">READY WHEN YOU ARE</p>
        <p className="empty-title">Tell me what to do.</p>
        <p>
          Say it naturally. I can open things, search, set timers, take notes, or do a few actions
          in a row.
        </p>
        <p className="empty-example">“Open a new tab and search for cozy cafés.”</p>
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
