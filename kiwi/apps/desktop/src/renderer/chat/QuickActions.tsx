const QUICK_ACTIONS = [
  { label: 'Research a topic', text: 'research how honeybees make honey' },
  { label: 'What am I reading?', text: 'what is on my screen' },
  { label: 'Note my clipboard', text: 'read my clipboard and save it as a note' },
  { label: 'Take a note', text: 'take a note read the paper on sleep' },
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
