# 0004 — Focus: research and notes

Status: accepted

Kiwi leads with one specialty so it does not read as a generic assistant: **helping the user understand what they are reading and keep what matters**.

- **Headline skills:** `research` (web summary with sources), `screenshot_describe` (what is on screen, with a Yes before every capture), `clipboard_read` and `write_note` (keep it, undoable).
- **Everything else stays** (apps, links, timers, volume, file sorting, code delegation) but is no longer the pitch. No tool was removed and no safety rule changed.
- **Where the focus lives:** the system prompt in `packages/core/src/prompt.ts`, the empty state and quick actions in the chat panel, `PRODUCT.md` and the README.
- **Not done yet:** reading a saved note back, summarising a whole open page without a screenshot, and note search. Candidates for `docs/BACKLOG.md`.
