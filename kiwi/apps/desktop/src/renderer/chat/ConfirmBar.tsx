export function ConfirmBar({ onAnswer }: { onAnswer: (accepted: boolean) => void }) {
  return (
    <div className="confirm-bar" role="group" aria-label="Confirm the planned action">
      <span>Go ahead?</span>
      <button className="btn" type="button" autoFocus onClick={() => onAnswer(true)}>
        Yes
      </button>
      <button className="btn btn--ghost" type="button" onClick={() => onAnswer(false)}>
        No
      </button>
    </div>
  );
}
