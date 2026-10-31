import { mascotStates } from '@kiwi/core';
import { ChatPanel } from '../chat/ChatPanel';
import { Mascot } from '../mascot/Mascot';
import { SpeechBubble } from '../mascot/SpeechBubble';
import { fakeConversation } from './fake-conversation';
import './gallery.css';

export function Gallery() {
  return (
    <div className="gallery">
      <h1>Kiwi state gallery (dev only, static fake data)</h1>
      <section aria-label="Mascot states" className="gallery-grid">
        {mascotStates.map((state) => (
          <figure key={state}>
            <div className="gallery-mascot">
              <Mascot state={state} micLevel={0.6} mouthOpen={0.7} />
            </div>
            <figcaption>{state}</figcaption>
          </figure>
        ))}
      </section>
      <section aria-label="Reduced motion" className="gallery-grid">
        {mascotStates.map((state) => (
          <figure key={state}>
            <div className="gallery-mascot">
              <Mascot state={state} reducedMotion />
            </div>
            <figcaption>{state} (reduced motion)</figcaption>
          </figure>
        ))}
      </section>
      <section aria-label="Speech bubbles" className="gallery-bubbles">
        <SpeechBubble kind="transcript" text="open github" durationMs={3_600_000} />
        <SpeechBubble kind="action" text="Opening github.com…" durationMs={3_600_000} />
        <SpeechBubble
          kind="action"
          text="This is a very long line that must wrap onto two lines at most and then be clipped cleanly"
          durationMs={3_600_000}
        />
      </section>
      <section aria-label="Chat panel" className="gallery-panels">
        <div className="gallery-panel">
          <ChatPanel state="idle" messages={[]} onSend={() => undefined} />
        </div>
        <div className="gallery-panel">
          <ChatPanel
            state="thinking"
            messages={fakeConversation}
            micActive
            onSend={() => undefined}
          />
        </div>
      </section>
    </div>
  );
}
