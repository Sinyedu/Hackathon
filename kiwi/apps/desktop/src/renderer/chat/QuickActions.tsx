const QUICK_ACTIONS = [
  { label: 'Open a new tab', text: 'open a new tab' },
  { label: 'Open GitHub', text: 'open github' },
  { label: 'Set a 5-minute timer', text: 'set a timer for 5 minutes' },
  { label: 'Take a note', text: 'take a note buy milk' },
] as const;

export function QuickActions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <ul className="quick-actions" aria-label="Quick actions">
      {QUICK_ACTIONS.map((action) => (
        <li key={action.text}>
          <button className="btn btn--ghost" type="button" onClick={() => onPick(action.text)}>
            {action.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
