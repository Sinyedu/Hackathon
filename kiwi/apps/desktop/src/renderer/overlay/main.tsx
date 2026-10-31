import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MASCOT_HIT_AREA } from '@kiwi/shared';
import { Mascot } from '../mascot/Mascot';
import { SpeechBubble } from '../mascot/SpeechBubble';
import { useMascotState } from '../mascot/use-mascot-state';
import '../styles/tokens.css';
import './overlay.css';
import { useMascotDrag } from './use-mascot-drag';

function Overlay() {
  const drag = useMascotDrag(() => window.kiwi.panel.toggle());
  const { state, bubble } = useMascotState();
  return (
    <>
      {bubble && (
        <div className="overlay-bubble">
          <SpeechBubble key={bubble.key} kind="action" text={bubble.text} />
        </div>
      )}
      <button
        type="button"
        className="mascot-button"
        aria-label="Kiwi. Click to open the chat panel, drag to move."
        style={{ ...MASCOT_HIT_AREA, left: MASCOT_HIT_AREA.x, top: MASCOT_HIT_AREA.y }}
        {...drag}
      >
        <Mascot state={state} />
      </button>
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
