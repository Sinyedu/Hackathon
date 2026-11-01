const noop = (): void => undefined;

/** Hold the button to talk; releasing (or leaving it) sends what was said. */
export function MicButton({ active }: { active: boolean }) {
  return (
    <button
      className="btn btn--ghost"
      type="button"
      aria-pressed={active}
      aria-label="Hold to talk to Kiwi"
      onPointerDown={() => window.kiwi.voice.pushStart()}
      onPointerUp={() => window.kiwi.voice.pushEnd()}
      onPointerLeave={active ? () => window.kiwi.voice.pushEnd() : noop}
      onKeyDown={(event) => {
        if (event.key === ' ' && !event.repeat) window.kiwi.voice.pushStart();
      }}
      onKeyUp={(event) => {
        if (event.key === ' ') window.kiwi.voice.pushEnd();
      }}
    >
      {active ? 'Listening…' : 'Talk'}
    </button>
  );
}
