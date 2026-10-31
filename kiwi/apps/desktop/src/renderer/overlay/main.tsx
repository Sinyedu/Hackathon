import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MASCOT_HIT_AREA } from '@kiwi/shared';
import '../styles/tokens.css';
import './overlay.css';
import { useMascotDrag } from './use-mascot-drag';

function Overlay() {
  const drag = useMascotDrag(() => window.kiwi.panel.toggle());
  return (
    <button
      type="button"
      className="mascot-placeholder"
      aria-label="Kiwi. Click to open the chat panel, drag to move."
      style={{ ...MASCOT_HIT_AREA, left: MASCOT_HIT_AREA.x, top: MASCOT_HIT_AREA.y }}
      {...drag}
    />
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
