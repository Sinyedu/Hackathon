const QUICK_ACTIONS = ['open github', 'timer 5 minutes', 'note buy milk', 'volume down'] as const;

export function QuickActions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <ul className="quick-actions" aria-label="Quick actions">
      {QUICK_ACTIONS.map((action) => (
        <li key={action}>
          <button className="btn btn--ghost" type="button" onClick={() => onPick(action)}>
            {action}
          </button>
        </li>
      ))}
    </ul>
  );
}
