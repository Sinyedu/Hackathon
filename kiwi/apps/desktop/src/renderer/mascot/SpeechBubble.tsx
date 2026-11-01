import { useEffect, useState } from 'react';
import './speech-bubble.css';

export type BubbleKind = 'transcript' | 'action';

interface SpeechBubbleProps {
  text: string;
  kind: BubbleKind;
  /** The bubble fades after this long; defaults to 3 seconds. */
  durationMs?: number;
}

export function SpeechBubble({ text, kind, durationMs = 3000 }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [text, durationMs]);

  return (
    <p className={`bubble bubble--${kind}`} data-visible={visible} role="status" aria-live="polite">
      {kind === 'transcript' && <span className="bubble-label">Heard: </span>}
      {text}
    </p>
  );
}
