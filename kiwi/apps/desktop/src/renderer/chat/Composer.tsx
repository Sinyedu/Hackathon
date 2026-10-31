import { useState, type SyntheticEvent } from 'react';

interface ComposerProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

export function Composer({ disabled = false, onSend }: ComposerProps) {
  const [text, setText] = useState('');

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form className="composer" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="composer-input">
        Message Kiwi
      </label>
      <input
        id="composer-input"
        className="composer-input"
        value={text}
        disabled={disabled}
        placeholder="Ask Kiwi to do something"
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
      />
      <button className="btn" type="submit" disabled={disabled || text.trim() === ''}>
        Send
      </button>
    </form>
  );
}
