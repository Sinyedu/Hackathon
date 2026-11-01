import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MASCOT_HIT_AREA } from '@kiwi/shared';
import { Mascot } from '../mascot/Mascot';
import { SpeechBubble } from '../mascot/SpeechBubble';
import { useMascotState } from '../mascot/use-mascot-state';
import { useVoiceState } from '../mascot/use-voice-state';
import '../styles/tokens.css';
import './overlay.css';
import { useMascotDrag } from './use-mascot-drag';

function Overlay() {
  const drag = useMascotDrag(() => window.kiwi.panel.toggle());
  const { state, bubble } = useMascotState();
  const voice = useVoiceState();
  return (
    <>
      <div className="overlay-bubble">
        {voice.heard ? (
          <SpeechBubble key={`h${voice.heard.key}`} kind="transcript" text={voice.heard.text} />
        ) : (
          bubble && <SpeechBubble key={bubble.key} kind="action" text={bubble.text} />
        )}
      </div>
      <button
        type="button"
        className="mascot-button"
        aria-label="Kiwi. Click to open the chat panel, drag to move."
        style={{ ...MASCOT_HIT_AREA, left: MASCOT_HIT_AREA.x, top: MASCOT_HIT_AREA.y }}
        {...drag}
      >
        <Mascot state={state} micLevel={voice.micLevel} mouthOpen={voice.mouthOpen} />
      </button>
      {voice.micOn && (
        <span className="mic-indicator" role="img" aria-label="Microphone is on">
          <span className="mic-indicator-dot" />
          Mic
        </span>
      )}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
