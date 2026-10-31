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

interface PanelHeaderProps {
  state: MascotState;
  micActive: boolean;
  onUndo?: () => void;
}

export function PanelHeader({ state, micActive, onUndo }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <h1>Kiwi</h1>
      <span className="panel-state">{stateText[state]}</span>
      {onUndo && (
        <button className="btn btn--ghost btn--small" type="button" onClick={onUndo}>
          Undo
        </button>
      )}
      <span
        className="mic-dot"
        data-active={micActive}
        role="img"
        aria-label={micActive ? 'Microphone on' : 'Microphone off'}
      />
    </header>
  );
}
