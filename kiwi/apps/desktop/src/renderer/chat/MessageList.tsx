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

/** Shown while Kiwi works, so nothing of its reasoning has to be displayed. */
function WorkingLoader() {
  return (
    <li className="msg msg--assistant msg--working" role="status" aria-label="Kiwi is working">
      <span className="loader-dot" />
      <span className="loader-dot" />
      <span className="loader-dot" />
    </li>
  );
}

export function MessageList({
  messages,
  working = false,
}: {
  messages: ChatMessage[];
  working?: boolean;
}) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, working]);

  if (messages.length === 0 && !working) {
    return (
      <div className="empty">
        <p className="empty-kicker">RESEARCH &amp; NOTES</p>
        <p className="empty-title">What are you reading?</p>
        <p>
          I can look into a topic, tell you what is on your screen, and keep the parts that matter
          as notes.
        </p>
        <p className="empty-example">“Research how honeybees make honey.”</p>
      </div>
    );
  }
  return (
    <ol className="messages" aria-label="Conversation" aria-live="polite" tabIndex={0}>
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {working && <WorkingLoader />}
      <li ref={end} aria-hidden="true" />
    </ol>
  );
}
