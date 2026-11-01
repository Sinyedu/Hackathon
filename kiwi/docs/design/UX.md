# UX

- **Placement:** the mascot lives in a 200×200 overlay near a screen corner (default top right). The chat panel docks centered beneath it and flips above near the screen bottom.
- **Panel behavior:** hidden by default. Click the mascot or press Ctrl/Cmd+Shift+K to toggle, Esc to close. Dragging the mascot moves the panel with it.
- **States:** sleeping, waking, idle (ready), listening, thinking, working, speaking, done, error. Each has a distinct pose plus a small mark (zz, dots, tool arrow, check, exclamation). `idle` is an extra resting state needed by the reducer timeouts (done to idle, idle to sleeping).
- **Speech bubble:** at most two lines above the mascot, fades after about 3 s; shows a live transcript ("Heard: ...") or an action label.
- **Empty state:** greeting plus quick-action chips. **Loading:** streaming cursor and the thinking state. **Error:** crossed eyes plus a FAILED receipt with a short, actionable sentence.
- **Voice of the copy:** short, kind, plain. Says what happened, never claims more.
