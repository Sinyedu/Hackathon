# Phase 0 audit — 2026-11-01

Status: audit and diagnostics delivered; acceptance gaps remain below. No phase 1–7 features implemented and no commit created. Work was performed in the existing dirty workspace; a clean clone/install and second-machine run were not performed. Do not treat the current successful warm-service launch as installer readiness.

## Findings, ranked by impact

| Rank | Finding and evidence | Impact | Effort estimate | Fix phase |
|---|---|---|---|---|
| 1 | `tools/voice-diagnostic.mjs` calls the actual `parseWake`: `Hey Kiwi, open GitHub` and `Kiwi stop` both return null; `Hey agent, what is missing?` works. `lib/wake.ts`, `agentIntent.ts`, header labels and Whisper prompt still refer to agent. | Primary expected wake phrase cannot work even with perfect ASR. | 0.5 day for immediate naming consistency; engine replacement needs its spike | 2 |
| 2 | `useHandsFree.ts`: `SILENCE_MS = 3000`, followed by complete MediaRecorder upload and blocking batch Whisper transcription in a backend thread. Generated 1-second silence WAV roundtrip: **3555.06 ms**. | 800 ms transcript and 1 s fast-command budgets cannot be met with the current endpointing threshold. Silence decode timing is not speech accuracy. | 1–2 days after voice spike | 2 |
| 3 | Repeated Electron launch logs: uvicorn exits with **WinError 10048** on :8000, while `waitFor` loads the API owned by existing PID 45336. Waiter accepts any status below 500. | Desktop can appear healthy while its own backend failed; stale process ownership and unsafe shutdown/restart behavior. | 0.5–1 day | 1, 7 |
| 4 | `/kiwi-mascot.svg` returns **200 text/html**, confirmed by content prefix. Only `/assets` is mounted in `backend/app/main.py`; root public assets hit the SPA fallback. | Mascot node exists but image is not delivered in desktop mode. A previous Vite asset 200 check missed the production route. | 1–2 hours | 1 |
| 5 | `aiSettings.ts`: raw key in renderer sessionStorage; `getApiKey()` exposes it and `aiHeaders()` forwards it to Python. No Electron safeStorage, masked status port or main-owned provider. | Does not satisfy continuation security contract. Do not enter a real key until phase 3. | 0.5–1 day | 3 |
| 6 | Backend accepts per-request provider/base URL/model headers. No local launch token, endpoint allowlist or authenticated main bridge. CORS includes `null`; this is not authentication. | Untrusted clients can initiate server-side model/provider calls; key and endpoint trust not enforced. | 0.5–1 day | 3, 7 |
| 7 | Latest Electron RSS: **585.82 MiB** across six processes; separately measured Python + launcher: **419.37 MiB**. Combined working-set sum ~**1005.19 MiB**, excluding Ollama. `evidence/electron.json`, `machine.json`. | Exceeds 600 MB/MiB budget even before packaging; RSS sum may double-count shared pages, but Electron plus Python clearly exceed target. | 1–2 days profiling/lazy loading; ML sidecar budget may need an ADR | 1 |
| 8 | Electron cumulative CPU delta over **10.0146 s**: **7.98% of one core**; longest observed renderer task **214 ms**. Six-process rAF proxy **179.76 callbacks/s** on this display. | Misses <5% and <50 ms targets; idle callbacks not capped at 30. CPU includes diagnostic overhead and is not a wake-armed baseline. | 0.5–1 day profiling | 1 |
| 9 | Main window is **1440×900**, min **980×680**, normal framed BrowserWindow. CSS `.kiwi-dock-shell` is inside its renderer. No Tray, overlay window, always-on-top, single-instance lock or hide-to-tray implementation. | Current app does not deliver the desired companion sitting on the desktop beside other apps. | 0.5–1 day | 1, 7 |
| 10 | `useAgent.ts`: `if (!result)` stops open-ended requests before model invocation. Main assistant prompt is restricted to reconciliation DATA. | Kiwi cannot behave as a general companion until document upload, even though the user expects ordinary conversation. | 0.5–1 day | 3, 4 |
| 11 | Two capture implementations (`useRecorder`, `useHandsFree`) create separate streams/AudioContexts; hands-free pauses during `busy`, `speaking`, recording. No Esc/global abort, speech barge-in or cancellation passed by the agent to its streaming fetch. | Voice cannot interrupt speech reliably; Kiwi stop is not a kill switch. Capture reentrancy/cleanup risks need focused tests. | 1 day plus phase-2 engine work | 2 |
| 12 | SVG contains two Gaussian blur filters; CSS adds drop-shadow and backdrop-filter. Infinite idle animation and no document visibility listener. | Expensive effects remain; replacing a particle canvas alone did not prove an idle improvement. Paint cost still requires DevTools evidence. | 2–4 hours after profiling | 1 |
| 13 | `services/store.py` stores claims/approval/audit in dictionaries, cleared on restart; frontend session id persists separately. | Root MVP durable SQLite/approval requirement is not met; stale session recovery is required. | 0.5–1 day | 1 / document persistence slice |
| 14 | Production start still requires Electron dependency tree and Python .venv/system runtime. Dev Windows launch uses `spawn('pnpm.cmd', ...)` directly; Node .cmd spawning needs verification. No `dist` command or builder config. | No installable app for users without development tools; dev launcher unverified. | 1–2 days after runtime boundaries stabilize | 7 |
| 15 | Whisper warmup starts on every backend launch, including the failed port-binding attempt. Warnings: HF cache symlinks unavailable and unauthenticated download rate limits. Backend service has no model-readiness endpoint. | Duplicate startup can import/download ML despite failed bind; health 200 does not prove speech or LLM ready. | 2–4 hours | 1, 2 |
| 16 | NDJSON client never flushes trailing decoder/buffer at EOF; new HTTP clients are created per model call. `useLiveSession` recreates SSE on event-count changes. | Fragile streaming termination and avoidable connection churn. | 2–4 hours | 1, 3 |

Estimates are planning estimates, not measured implementation times. Existing exact/fuzzy matching, validated quantities, source evidence and approval calculations must be preserved.

## Baseline against every budget

Demo machine: Windows 11 Pro 10.0.26200, Ryzen 5 9600X (6 cores/12 logical processors), 31.07 GiB RAM, Radeon RX 9060 XT plus integrated Radeon. This is not a low-spec laptop. Hardware values were read with elevated read-only CIM queries after sandbox denial.

| Metric | Baseline observed | Budget | Assessment |
|---|---|---|---|
| App ready / window created / document load | 24.06 / 40.75 / 153.79 ms from diagnostic module start | mascot visible <2 s | Proxy only: warm service, not process-launch-to-mascot-paint; SVG response is HTML |
| Wake armed + provider ready | not measured; diagnostic header read `Hey agent: starting…` | <5 s | FAIL: no readiness proof |
| Electron CPU, 10.0146 s interval | 7.98% of one core using cumulative CPU deltas | <5% | FAIL for measured interval; not controlled wake-armed idle |
| All app memory excluding model runtime | Electron 585.82 + Python/launcher 419.37 ≈1005.19 MiB RSS | <600 MB | FAIL; non-simultaneous samples, shared RSS caveat |
| Mascot active animation / paint cost | not captured in DevTools | 60 fps/no drops over 10 s | NOT VERIFIED |
| Idle rAF callback cadence | 179.76 callbacks/s over ~10 s; 0 gaps >25 ms | idle animation ≤30 fps, paused hidden | Callback proxy only; static code has no cap or hidden pause |
| Keystroke to echo | not measured | <50 ms | NOT VERIFIED |
| Longest observed renderer task | 214 ms, observer includes buffered startup tasks | <50 ms | FAIL |
| Wake phrase end to chime | no keyword engine or chime | <300 ms | FAIL capability |
| Speech end to final transcript | no recorded spoken WAV; generated silent WAV roundtrip 3555.06 ms | <800 ms | NOT VERIFIED for speech; 3000 ms endpointing already exceeds budget |
| Fast command speech end to action | no general open-GitHub tool | <1 s | FAIL capability |
| Cloud first word | no real key used | <1.5 s | NOT VERIFIED |
| Local first spoken word | not measured end-to-end; complete tiny direct-model request 4251.88 ms | <3 s | NOT VERIFIED; full request timing is not first-token timing |
| Wake hits / false triggers | not measured with a human/recorded WAV | ≥17/20 and ≤1/5 min | NOT VERIFIED; Kiwi phrase parser definitely fails |

Voice environment actually observed: secure localhost, microphone permission granted, 4 audio inputs and 4 outputs enumerated, standalone AudioContext running at 48 kHz, MediaRecorder supported, 5 speech-synthesis voices. These are capability checks, not proof of the input track's sample rate or physical speaker output. Actual capture format/chunk cadence/VAD activity, spoken WAV roundtrip and audible TTS need a user-present test.

Baseline bundle snapshot: JS **337788 bytes** (build reported 107.61 kB gzip); CSS **60609 bytes** (13.12 kB gzip); public PNGs **4531572 bytes** combined; mascot SVG **2402 bytes**. See `evidence/baseline.json` for per-file bytes. The final metadata-propagation change rebuilt successfully at **337840 bytes JS /107.63 kB gzip**; lint and diff checks also passed. No before/after speed improvement is claimed in phase 0.

## Checks run

| Acceptance | Result and evidence |
|---|---|
| Process architecture map | PASS: `ARCHITECTURE-AS-IS.md` names startup entries, subprocesses, runtime packages and ownership |
| Complete measured baseline table + machine specs | FAIL/PARTIAL: real warm-window, CPU, RSS, long-task, asset, model and ASR figures recorded; cold startup, paint, active animation, input, voice accuracy and low-spec measurements absent |
| Definite failing voice stage or next suspect | PASS for parser diagnostic: actual `parseWake` rejects perfect Kiwi transcripts. Physical microphone pipeline remains unverified; not attributed to permissions |
| Ranked top 10 findings | PASS: 16 evidence-backed findings above |
| Packaging ADR | PASS: ADR 0003 recommends packaged Python document sidecar with main/utility-process assistant orchestration |

Validation after diagnostic changes: `pnpm.cmd build` passed; 153 frontend tests passed; oxlint passed; 152 backend tests passed in 64.16 s. Vite reports the existing `::highlight(agent-key)` optimizer warning. Sandbox-native launch crashed earlier with 0xC0000005; elevated desktop launch succeeded, proving the earlier blanket GUI-impossibility claim incorrect. No GPU/sandbox-disabling flags are required by the successful measurement.

Clean install, installer, 10-minute idle leak, microphone speech, cloud credentials, physical TTS and second-machine checks are not passed. No phase gate is silently waived. No credentials or user audio were added to evidence.

## Repeat commands from this folder

Run from `C:\coding project\Hackathon-Kiwi\Hackathon\docs\kiwi-continue` in PowerShell. Runtime commands need normal desktop access (the tool sandbox required escalation).

```powershell
# Existing-workspace build/check, not a clean-clone assertion
Push-Location ../../frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd build
pnpm.cmd test
pnpm.cmd lint
Pop-Location
Push-Location ../../backend
./.venv/Scripts/python.exe -m pytest -q
Pop-Location

# Actual parser + endpoint diagnostic; no transcript/audio is saved
node tools/voice-diagnostic.mjs
# Optional user-provided recorded WAV, kept out of version control:
node tools/voice-diagnostic.mjs --wav C:/path/to/hey-kiwi.wav

# Opt-in real Electron metrics; app launches as usual (may collide with :8000)
Push-Location ../../frontend
$env:KIWI_AUDIT_EXIT_MS = '30000'
pnpm.cmd desktop --audit
Remove-Item Env:KIWI_AUDIT_EXIT_MS
Pop-Location

# 3 process snapshots over 10 seconds + built asset bytes
../../backend/.venv/Scripts/python.exe tools/baseline.py

# Hardware and backend ownership; read-only OS permission required in tool sandbox
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory,NumberOfLogicalProcessors
Get-CimInstance Win32_Processor | Select-Object Name
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version
Get-CimInstance Win32_VideoController | Select-Object Name
Get-NetTCPConnection -LocalPort 8000 -State Listen
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Select-Object ProcessId,ParentProcessId,CommandLine
Get-Process -Id 45336,34160 | Select-Object Id,WorkingSet64,CPU # substitute newly observed PIDs
```

Diagnostic scripts overwrite their own JSON evidence with the latest run. `voice-diagnostic.mjs` needs Node supporting TypeScript type stripping (tested Node 24) and locally running backend/Ollama. A speech request may trigger the existing app's first Whisper download; the script is not an offline accuracy test. Model request times are complete non-streaming roundtrips.

CPU calculation: sum per-process differences in `cumulativeCPUUsage` across matching PIDs, divide by elapsed seconds and multiply by 100. This is one-core percent; do not compare Electron's already-normalized per-machine percentages directly to the one-core budget. RSS is Electron `workingSetSize` KiB /1024, plus separately observed Python working sets. Workspace process sampler misses system-Python command lines without the workspace string; use the port-owner query to add those processes.

## Refactor gate and handoff

Diagnostic modules are separate from product behavior and enabled explicitly. Tracer has one metadata-only writer; bounded samples and async trace writes. No duplicate audio engine or provider was introduced. Existing user changes were preserved, including untracked SVG and root package-lock. The existing 300+ line useAgent hook was not refactored in an audit-only phase; phase 1 owns that gate. Product route/provider/security fixes are documented, not smuggled into diagnostics.

Suggested commit: `chore(audit): add architecture map, performance baseline, tracer, voice diagnostic and packaging decision`.

Next phase is phase 1, using these ranked findings and recording before/after evidence. Phases 2–7 remain pending; their requirements are in the continuation pack. The START_HERE phase-0-only instruction is the reason this audit does not claim to have implemented them.
