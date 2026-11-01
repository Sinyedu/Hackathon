# 0003 — Power skills

Status: accepted

- **sort_folder** plans, asks for Yes/No itself, applies the moves and journals one undo entry (`undo_moves`). The step file names `apply_plan` and `undo_last`; this is the same behaviour in one tool plus the existing `undo` command, which avoids a half-applied plan living in memory between calls.
- **Research** uses DuckDuckGo's HTML endpoint for URLs only, fetches at most three pages (8 s timeout, 1 MB cap, no private addresses), fences each page as untrusted data and summarizes with the fast model. Reply is cut to three sentences in code.
- **Screen understanding** needs a vision model (`gemma3:4b` by default) and a Yes before every capture. A small thumbnail is stored in the receipt as proof.
- **Maths** is deterministic code (`convert.ts`); the model is never asked to calculate.
- **Code delegation** is off by default. The Claude Code backend runs `claude -p` in a new `git worktree` on branch `kiwi/<slug>` with `--permission-mode dontAsk`, tools limited to read, edit and one fixed test command, `--max-budget-usd`, a 5 minute timeout and a message cap (this CLI version has no `--max-turns`). Only PATH/HOME-style variables are passed on. Keep merges the branch; Discard removes worktree and branch. Replay mode plays a recording and is always labelled. The settings screen warns to check the hackathon rules about proprietary models.
- **Voice window trust**: it may report, submit recognized text and stop; it cannot confirm actions, undo, change settings or move windows. Runtime assets are served from the app; the speech model is pinned to a commit.
