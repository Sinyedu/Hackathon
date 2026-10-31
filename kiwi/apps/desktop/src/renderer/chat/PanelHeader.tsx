import type { MascotState } from '@kiwi/core';

const stateText: Record<MascotState, string> = {
  sleeping: 'Sleeping',
  waking: 'Waking up',
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  working: 'Working',
  speaking: 'Speaking',
  done: 'Done',
  error: 'Needs attention',
};

export function PanelHeader({ state, micActive }: { state: MascotState; micActive: boolean }) {
  return (
    <header className="panel-header">
      <h1>Kiwi</h1>
      <span className="panel-state">{stateText[state]}</span>
      <span
        className="mic-dot"
        data-active={micActive}
        role="img"
        aria-label={micActive ? 'Microphone on' : 'Microphone off'}
      />
    </header>
  );
}
