# Demo script

Goal: show a local assistant that acts, shows every action as a receipt, and can undo it.

## Before you go on stage (rehearsal checklist)

- [ ] `ollama serve` is running and `ollama list` shows the planning model (`qwen3:1.7b` or the one the wizard picked).
- [ ] Optional: `ollama pull gemma3:4b` for the screen description step (about 3 GB; needs roughly 8 GB of RAM free).
- [ ] Start Kiwi, finish the first-run wizard once, check the green mascot sits in the screen corner.
- [ ] `~/KiwiSandbox/Downloads` contains the demo files (Kiwi seeds fake, empty files there on first run; delete the folder to reseed).
- [ ] Microphone allowed; "Hey Kiwi" turned on in Settings; say it once in the room to check.
- [ ] Network is up for weather and research. Speech model downloaded once (needs the network the first time).
- [ ] Volume is not muted. A browser is open so links appear fast.

## Script (about 4 minutes)

1. **Type** `open github`. A GitHub tab opens, a DONE receipt appears. (Fast path, no model.)
2. **Say** "Hey Kiwi, set a timer for one minute". Chime, mascot listens, a DONE receipt. Say "undo": the timer is cancelled, receipt UNDONE.
3. **Type** `note buy milk`. A PLANNED line and Yes/No appear. Click Yes. Say "undo": the note moves to `.trash`.
4. **Type** `clean up my downloads`. Show the PLANNED moves, click Yes, open the folder. Type `undo` and show every file back.
5. **Type** `research electron ipc best practices`. Three sources as receipts, a three-sentence answer.
6. **Type** `weather in Sofia`, `convert 5 km to miles`, `calculate 12 * (3 + 4)`. Point out that maths is done by code, not the model.
7. **Say** "Hey Kiwi, what's on my screen". Confirm; a thumbnail receipt proves what it saw.
8. Optional: with code delegation set to **Replay** in Settings, type `delegate add a greeting function`, then `show diff` and `discard it`. The receipts are labelled `[replay]`.
9. Press `Esc` while it speaks or thinks to show the kill switch.

## Safety talking points

Only allowlisted apps; files only inside `~/KiwiSandbox` and "delete" means `.trash`; web pages and clipboard text are fenced as untrusted data; nothing that changes files runs without Yes.

## Backup plan

- No Ollama or model: the fast-path commands in steps 1 to 4 and 6 still work. Say so honestly.
- No network: skip research and weather; everything else is local.
- Voice fails: type the same commands; the panel shows why voice is unavailable.
- Screen step fails (model missing or no permission): the receipt says why; move on.
- Code delegation: use Replay mode; it never touches your files and is labelled.
- Last resort: show the recorded run of this script if you made one, and say it is a recording.
