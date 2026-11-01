# Kiwi Windows test release 0.1.1

## Hands-free update

- Frontend: 156 tests passed; desktop command-routing/wake-verification tests: 3 passed; build and lint pass.
- Native Windows recognizer tested with synthetic WAVs: wake plus a separate command passes; ordinary speech without “Hey Kiwi” produces no wake or final event. This is a limited fixture test, not a human wake-accuracy certification.
- Complete desktop fixture sequence passes without any button event: wake -> provisional live words -> in-memory audio -> local Whisper final -> actual time command -> reply. `handsfree-smoke.json` records the events and confirms `voiceOutputStarted: true` from the real speech-synthesis start event.
- Listening screenshot verifies the smile's computed display is `none`, the speaker's is `block`, and captions appear below the collapsed mascot.
- Native listeners use an isolated test profile and paced fixture audio in diagnostics. Normal operation captures the default microphone and does not save audio or transcript logs.
- A startup verification bug returned a function from `executeJavaScript`, which Electron could not serialize. Returning a simple value fixes the error dialog; startup exceptions now also leave a local diagnostic log.
- Corrected packaged run: `packaged-handsfree-smoke.json` records wake, interim words, final verification, the actual time action, and `voiceOutputStarted: true`. A synthetic WAV finishes at EOF, so its final mic badge is “Mic off”; normal microphone mode stays armed.

Existing 0.1.0 measurements below are retained as the previous release baseline. The Windows native wake/live-caption adapter supersedes its button-oriented, batch-only wake path; see ADR 0006.

Demo machine: Windows 11 Pro 10.0.26200, Ryzen 5 9600X, 31.07 GiB RAM, Radeon RX 9060 XT. This is a test on the user's existing system, not a clean VM or low-spec-machine certification.

## Automated and instrumented checks

| Check | Result | Evidence |
|---|---|---|
| Renderer build/type check | PASS | `cd frontend; pnpm.cmd build` |
| Frontend regression tests | PASS, 153 tests | `pnpm.cmd test` |
| Desktop routing and command-injection guards | PASS, 2 scenario tests | `pnpm.cmd test:desktop`; includes polite speech, ASR spacing, spoken timer numbers and rejection of file/javascript URLs and shell strings |
| Lint and diff whitespace | PASS | `pnpm.cmd lint`; `git diff --check` |
| Existing backend regressions | PASS, 152 tests in 76.30 s | `cd backend; .venv/Scripts/python.exe -m pytest -q` |
| Desktop window uses supplied SVG | PASS | `kiwi-continue/docs/audit/evidence/companion-smoke.json`, screenshot adjacent; 3 animated eye paths, inline source SVG, transparent background |
| Bottom-right placement and always-on-top | PASS, instrumented | collapsed bounds 160×190; main-process `isAlwaysOnTop()` true |
| Main-owned local provider through preload | PASS | real qwen3:1.7b response: “I'm Kiwi, a warm and concise desktop companion.” via isolated Electron IPC |
| Microphone capture | PASS, device acquisition | `getUserMedia` succeeds; actual input track 48 kHz; capture stopped after capability test |
| Natural speech capability | PASS, capability only | five OS voices enumerated; physical speaker playback still requires listening |
| Frozen speech executable offline | PASS | `node tools/test_desktop_voice.mjs`; synthetic Windows voice fixture, decoded “Hey Kiwi. OpenGIT Hub.” and routed as GitHub; unauthorized request rejected with 401 |
| Actual packaged app launch | PASS on this computer | `release/win-unpacked/Kiwi.exe --smoke`; `kiwi-continue/docs/audit/evidence/packaged-companion-smoke.json` |
| Packaged cursor-following eyes | PASS, instrumented | eye translations change to -17.99px / -12.00px following main-process cursor event |
| Packaged provider and speech integration | PASS | real IPC chat completed in 3493.70 ms; bundled sidecar decoded the spoken fixture in 2458.23 ms, with no system Python launched |
| Key isolation | SOURCE VERIFIED, no real key test | `settings.cjs`: encrypted safeStorage blob only; API key never returned by IPC; cloud key is write-only transient form input |

Dev-file companion startup sample: mascot-ready 465.52 ms; initial sample 235.17 ms. These are instrumented main-module-to-ready values, not cold installer launch measurements. First-file smoke Electron RSS totals about 374 MiB and does not load Python or OCR. Compare with old audit's ~1005 MiB app working-set sum only as a workload change, not an equivalent wake-armed benchmark. 10-minute leak, idle CPU, active speech CPU, full paint cost and the full phase-pack budgets have not been certified.

The packaged sample reached mascot-ready at **216.27 ms**. This was an unpacked release executable on the demo workstation, not the portable self-extractor or installer wizard. Screenshot: `kiwi-continue/docs/audit/evidence/packaged-companion-smoke.json.png`. The app uses the original SVG; the custom app/tray icon was rasterized from that same vector.

The speech fixture was synthesized locally by Windows SAPI, not recorded from a person. The packaged speech test runs with `HF_HUB_OFFLINE=1` and uses the already-cached small.en model. Last standalone frozen test took 2038.19 ms including decoder/model work; do not claim an 800 ms ASR budget or a wake hit-rate from this one fixture.

## Manual scenarios still required

- Human wake phrase accuracy and false wakes; use “Hey Kiwi” plus the request in one utterance.
- Listen to natural voice and blips through the selected speakers/headphones.
- Try app launches, theme/media changes and timer notifications with the user's apps.
- Website-generation confirmation, saved HTML preview and VS Code opening.
- Real cloud API session, encrypted-key restart and forget-key behavior with user credentials.
- Installer wizard, uninstall/reinstall and clean Windows machine without development tools.

## Known limits

Windows x64 only. Unsigned local build. Local reasoning requires Ollama and a separately installed model; final speech verification needs a separately cached/downloaded English model. Wake and provisional words use Windows offline English speech components. A bare “Hey Kiwi” opens a 12-second command window. Normal dictation pauses while Kiwi is speaking/thinking; “Kiwi stop” remains available, as does Ctrl+Shift+.. No claim that all phase-2 latency or human accuracy targets are met. The tray's Pause microphone control takes effect immediately; hidden Kiwi pauses listening. Timers stop when Kiwi quits. Chat history resets on restart.

Desktop actions use fixed templates; no arbitrary shell execution, unrestricted filesystem manipulation, password entry or autonomous sending/purchasing. Music is a search page plus media keys, not Spotify OAuth. Website building is one approved HTML file, not a full coding-agent loop. Persistent memory, arbitrary window snapping/control, screen vision, per-tool undo and cross-platform adapters remain roadmap items. The legacy document application remains development-only and its in-memory state is not persisted claims storage.
