import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import './panel.css';

function Panel() {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') window.kiwi.panel.hide();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <main className="panel">
      <h1>Kiwi</h1>
      <p>The chat panel is empty for now. Press Esc to close it.</p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
