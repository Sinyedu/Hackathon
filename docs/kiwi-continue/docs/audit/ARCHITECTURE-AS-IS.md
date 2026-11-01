# Architecture as measured, 2026-11-01

This continuation pack is the working documentation root. Paths below are relative to the original repository root, three levels above `tools/`. No application copy was created. The current application is DockProof with a Kiwi visual layer; general desktop control, coding mode, tray behavior and installer are not implemented.

```text
pnpm desktop (frontend/package.json; global Node and pnpm required)
  Electron 39.8.10: frontend/electron/main.cjs
    Browser/main process: child process lifecycle, fixed localhost URLs
    GPU process
    network utility process
    renderer/Tab process: React 19 + Vite-built TypeScript UI
    audio utility and video-capture utility processes when media is used
    preload.cjs: context-isolated desktop metadata; optional audit bridge
    Python .venv launcher -> system Python 3.12 -> uvicorn app.main:app :8000
      FastAPI routes -> domain schemas and services
      inbox scan every 1 second, supplier seeding
      background thread -> faster-whisper small.en CPU/int8 warmup
      RapidOCR + ONNX Runtime + OpenCV for scan extraction
      PyMuPDF for text PDFs, RapidFuzz for deterministic matching
      httpx -> Ollama HTTP :11434 -> qwen3:1.7b runner
      optional per-request cloud HTTP configured in renderer headers
    --dev additionally spawns pnpm.cmd -> Node/Vite :5173

React: App -> LiveWorkspace -> useLiveSession + useAgent
  input file / camera -> Python extraction -> review -> reconciliation -> approval
  mic -> useRecorder OR useHandsFree -> MediaRecorder Blob -> POST transcribe
  hands-free: RMS threshold -> 3 seconds silence -> Whisper -> parseWake("agent")
  transcript -> intentOf -> deterministic document command OR reconciliation ask
  ask -> Python assistant -> Ollama -> validated NDJSON sentences
  browser speechSynthesis -> OS voice -> caption + CSS mascot phase
```

Electron starts Python; it does not start or supervise Ollama. Hugging Face downloads Whisper on first load. There is no voice utility process, MessagePort audio transport, PCM resampler, keyword-spotting engine, tool registry or general agent loop. The existing preload exposes no general action IPC. HTTP links connect the renderer directly to Python. The audit-only bridge carries numeric timing metadata.

The production URL is `http://127.0.0.1:8000`, the dev URL is `http://127.0.0.1:5173`. Frontend services independently derive port 8000. The backend correctly locates root `frontend/dist` using `Path(__file__).resolve().parents[2]`; however it mounts only `/assets` and returns index.html for other non-API paths, including the mascot's public URL. An HTTP 200 alone does not prove a usable asset.

## Packages and code boundaries

The complete direct Node package inventory and exact ranges are in `frontend/package.json`; resolved versions are in `frontend/pnpm-lock.yaml`. Runtime dependencies: React, React DOM, lucide-react, qrcode. Build/test dependencies: Vite, TypeScript, Tailwind/Vite integration, React Vite plugin, Vitest, jsdom, Testing Library, oxlint and type packages. Electron is currently a dev dependency but is required by the desktop start script; no redistributable executable is built.

All 13 pinned direct Python dependencies are in `backend/requirements.txt`: FastAPI, uvicorn, python-multipart, pydantic-settings, PyMuPDF, RapidFuzz, httpx, pytest, RapidOCR, ONNX Runtime, Pillow, faster-whisper and av. Native ML libraries and model caches are Python runtime requirements. `scripts/dev.py` provisions the venv and launches separate development servers.

`backend/app/services/store.py` holds sessions, uploads, claims, approvals and audit events in process-local dictionaries. Restart clears them. The UI remembers a session id and the last 30 chat entries in localStorage. API keys are retrievable from renderer sessionStorage (`services/aiSettings.ts`); Electron safeStorage is absent. Supplier/product fixtures are JSON. No SQLite claim persistence exists in this checkout.

## Startup and current process ownership

Observed loopback :8000 owner: Python PID 45336, parent venv launcher PID 34160. Electron audit starts another uvicorn, which exits with Windows error 10048. Health polling accepts the already-running API and loads that service anyway. This is a warm, shared-service run, not a clean cold startup. A successful window does not prove the spawned child survived.

Audit sample process roles and RSS are preserved in `evidence/electron.json`. Latest run: Browser, GPU, network, Tab, audio and video-capture utilities; Python measured separately. Ollama and model-runner memory are excluded from the app budget. The repository also has unrelated Node processes; the audit does not terminate them or count all Node processes as Kiwi.

## Diagnostic code added in phase 0

`--audit` installs `tools/electron-audit.cjs`, samples `app.getAppMetrics()` every 5 seconds and evaluates `renderer-audit.js` in the real window. Reports are bounded to 120 samples. `KIWI_AUDIT_EXIT_MS` bounds an audit launch. The optional preload bridge and `src/lib/trace.ts` send fixed-span metadata to the main-process tracer. Capture, ASR roundtrip, wake parsing, routing, first validated sentence and speech onstart share a voice request ID. They do not log prompts, headers, audio or transcripts. `llm_first_token` currently measures the first validated sentence (an explicit proxy); `tts_first_audio` measures speech onstart, not acoustic speaker latency. No unimplemented tool span is emitted. Render/wake-armed/provider-ready timing is not yet complete.

Normal launches do not write diagnostic files. Trace location is Electron userData `logs/trace.jsonl` (currently `%APPDATA%/Electron/logs/trace.jsonl`). Before shipping, phase 1 must move production diagnostics into a packaged resource and add rotation; the current audit module is development-only and deliberately lives in this continuation folder.
