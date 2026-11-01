# Kiwi desktop companion

Kiwi lives in a small transparent window in the bottom-right corner of Windows. The supplied lime mascot breathes, blinks, follows your cursor with its eyes, and animates while listening, thinking and speaking. Click Kiwi to open the chat panel; closing the panel leaves the mascot on your desktop. Its tray icon has Show, Mute, Pause microphone and Quit controls.

## Test the Windows build

Open `frontend/release/Kiwi-Portable-0.1.0.exe` directly, or install `frontend/release/Kiwi-Setup-0.1.0.exe`. Both are unsigned local test builds. Windows may show an unknown-publisher/SmartScreen prompt. These executables do not require Node, pnpm, a browser dev server or system Python.

On this computer Ollama and `qwen3:1.7b` are installed. Other computers need Ollama plus that model, or a personal compatible API key in Settings. Speech recognition uses a separately downloaded English model: use **Download speech model** in Settings if it is missing. Downloaded models stay outside the installer. No claim is made that model downloads work without an internet connection.

- Click Kiwi to chat. Click the microphone to record; click it again to send.
- `Ctrl+Shift+Space`: open Kiwi and toggle microphone recording.
- `Ctrl+Shift+.`: stop speech and cancel the model request. Esc also stops inside the panel.
- Enable **Listen for “Hey Kiwi”** in Settings for hands-free requests. Say the wake phrase and your request together. This uses local batch speech recognition; it is not an instant keyword detector and does not interrupt TTS while speaking. Use the stop hotkey to interrupt immediately.
- Select Natural voice or original synthesized Kiwi blips. The mute button is always in the panel.

Try “open GitHub and YouTube”, “search for pizza recipes”, “play lo-fi”, “open calculator”, “volume down”, “pause music”, “switch to dark mode”, “set a 25 minute timer”, or “what time is it?”. Music commands open a search page; play/pause sends media keys to the active media app. Timers require Kiwi to remain running.

“Build a coffee shop landing page” drafts one standalone HTML page. Kiwi asks before generating and before writing/opening it, saves only a new folder in `Documents/KiwiProjects`, opens VS Code if installed in its standard user location, and opens the browser preview. This is a bounded page builder, not a general autonomous coding agent. It does not run generated shell commands or install packages.

API keys are encrypted with Electron safeStorage in the main process, never returned to the renderer. Cloud mode sends your text and recent conversation to your chosen endpoint; it does not send screenshots, clipboard or microphone audio. Chat history is bounded in memory and resets on restart. Persistent personal memory, screen understanding, arbitrary window control and the full phase-6 coding-agent workflow are not implemented. The settings panel and assistant describe supported commands; there is no “do anything” shell execution.

## Build and verify from source

```powershell
python scripts/dev.py setup
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-build.txt
cd frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd build
pnpm.cmd test
pnpm.cmd test:desktop
pnpm.cmd lint
pnpm.cmd desktop
# Quit Kiwi before rebuilding its packaged files:
pnpm.cmd dist
```

`pnpm dist` builds the renderer, freezes the speech service, and creates the Windows NSIS and portable executables. Icon sources are in `frontend/build`; `pnpm build:icons` regenerates them from the provided SVG using a hidden Electron window. Release binaries and model files are intentionally not committed. See `docs/QA_CHECKLIST.md` and `docs/DEMO.md` for actual checks and the demo sequence.

## DockProof development workspace

[![CI](https://github.com/Hizashii/Hackathon/actions/workflows/ci.yml/badge.svg)](https://github.com/Hizashii/Hackathon/actions/workflows/ci.yml)

AI-powered delivery reconciliation. DockProof compares a purchase order, delivery note and invoice,
uses a small local open-weight model (Qwen3 1.7B via Ollama) to match differently named products,
and uses deterministic code for quantities, prices, discrepancies and claims. Claims require human approval.

> This original document workflow is retained for development and is not included in the standalone companion installer. Its state is process-local and clears on backend restart. See `docs/MAP.md`.
> See `AGENTS.md`, `CLAUDE.md` and `DESCRIPTION.md` for scope and rules.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS v4, pnpm, native `fetch`
- Backend: Python 3.11+ / FastAPI / Pydantic / process-local memory
- Scan reading: RapidOCR (ONNX, installed via pip) for photos/screenshots; PyMuPDF for text PDFs
- AI: `qwen3:1.7b` (Apache 2.0) through Ollama, called with `httpx`

## Structure

```text
frontend/   React app (src/{components,pages,hooks,services,types,lib})
backend/    FastAPI app (app/{api,services,models,schemas,core}, tests/)
fixtures/   Synthetic sample documents
```

## Prerequisites

Works on **Windows 10/11, Linux and macOS**. You need Node 20+ with pnpm (`npm install -g pnpm`), Python 3.11+ (Linux: `sudo apt install python3-venv`), and [Ollama](https://ollama.com/download). A recent Chrome, Edge or Firefox is recommended.

## Quick start (any OS)

```bash
python scripts/dev.py setup     # creates backend/.venv, installs backend + frontend dependencies, copies .env
python scripts/dev.py doctor    # shows what is installed (pnpm, Ollama, models, cloudflared)
python scripts/dev.py           # runs backend (8000) and frontend (5173); Ctrl+C stops both
```

For the companion desktop app, use Electron from `frontend/`:

```bash
cd frontend
pnpm desktop:dev   # build then launch the desktop companion
pnpm build
pnpm desktop       # launch the companion from built local files
```

The companion loads local files and uses narrow Electron IPC. The speech sidecar starts only when needed, on a random loopback port with a per-launch token. Development mode uses the Python venv for that sidecar; the packaged build contains its own runtime. The separate document workspace still uses `python scripts/dev.py` and FastAPI on port 8000.

On Windows run the same commands from PowerShell or cmd (`py scripts/dev.py setup` works too). Add `--lan` to reach the app from a phone on the same Wi-Fi. On Linux/macOS `make backend` / `make frontend` still work; on Windows use the script instead (the Makefile uses `.venv/bin`).

<details><summary>Manual setup</summary>

```bash
# Backend: Linux/macOS                                # Windows PowerShell
cd backend                                            # cd backend
python3 -m venv .venv && source .venv/bin/activate    # py -m venv .venv ; .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt             # python -m pip install -r requirements.txt
cp .env.example .env                                  # copy .env.example .env
python -m uvicorn app.main:app --port 8000

# Frontend
cd frontend && pnpm install && pnpm dev
```
</details>

**Public tunnel for the deployed frontend** (optional): install `cloudflared` (Windows: `winget install Cloudflare.cloudflared`; macOS: `brew install cloudflared`; Linux: download from Cloudflare's releases), then `cloudflared tunnel --url http://localhost:8000`.

## Ollama

Install Ollama from <https://ollama.com/download>, then:

```bash
ollama pull qwen3:1.7b                        # ~1.4 GB: matching and recovery
ollama run qwen3:1.7b    # optional interactive smoke test
```

The backend never downloads the model or runs inference at startup. If Ollama is unavailable, uncertain matches remain for human review.

## Development commands

| Task | Command |
|---|---|
| Backend tests | `cd backend && pytest` |
| Model accuracy check (needs Ollama) | `cd backend && PYTHONPATH=. python scripts/eval_matching.py` |
| OCR spike on an image | `cd backend && python scripts/ocr_spike.py IMAGE` |
| Frontend build + typecheck | `cd frontend && pnpm build` |
| Frontend lint | `cd frontend && pnpm lint` |

See `docs/DEPLOY.md` for phone access and the Vercel + tunnel deployment, and `docs/CI-CD.md` for the GitHub Actions pipeline.

## Live dock demo

Open <http://localhost:5173> on the laptop. The office screen shows a QR link for a phone on the same Wi-Fi or hotspot. Scan it to open `/dock` on the phone. Use **Chaos Dock** to generate synthetic purchase orders and delivery notes, or upload scans directly. The watcher reads generated pairs from `dock-inbox/` through the same OCR pipeline. Review a shortage, open its proof, and approve the draft claim only after checking it. **Reveal answer key** compares the result with the synthetic key after processing.

For **AutoRecover**, expand a shortage on the office result, click **Find Recovery Options**, then create a draft replacement order. Approval records a local decision; nothing is sent to a supplier.

State lives in the backend process and is cleared when it restarts. The frontend stores the session ID in localStorage so refreshes reconnect while the backend stays running.

Suppliers are loaded from `fixtures/suppliers.json` into memory at backend startup. The seed is idempotent within a running process; to re-seed manually run `cd backend && PYTHONPATH=. python -c "from app.services.suppliers import seed_suppliers; print(seed_suppliers())"`.
New endpoints: `GET /api/suppliers`, `POST /api/reconciliations/{id}/discrepancies/{item}/recover`, `GET .../recovery`, `POST /api/recovery-plans/{id}/draft-order`, `POST /api/replacement-orders/{id}/approve|reject`, `POST /api/demo/missing-tomatoes`.

## Ask by voice (the agent)

Kiwi is also available as a lightweight desktop-style dock in the bottom-right corner. Open its dashboard to switch between local Ollama and a personal OpenAI-compatible key. The key is kept in the current browser session and sent only with assistant requests; it is not saved in `.env`, SQLite, or the prompt context. Use the local Ollama option for the no-cost, offline-friendly path. ChatGPT and API billing are separate, although some eligible Pro/Business plans may include API credits.

**Hey agent, anywhere on the site.** Saying "Hey agent" (alone, or followed by your request) opens the agent already listening, so no click is needed. It keeps listening until you have been silent for 3 seconds. The **Hey agent** switch in the header turns this off (remembered per browser). Audio that does not start with the wake phrase is discarded and never reaches a model; transcription runs on your machine.

- **Open my files**: the agent shows a paperclip. Tap it and pick your purchase order and delivery note from wherever you keep them. Reading starts the moment they are in. (Browsers do not allow a page to open a file dialog from speech alone, so one tap is needed.) Names containing "order"/"po" or "delivery"/"dn" are sorted automatically; otherwise the agent asks which is which.
- **Walkthrough**: after a delivery is analysed the agent docks to the bottom and tours the result by voice: the headline, the two columns read from your scans, why the red rows are red, the open product question, the draft claim, the recovery option and the notes. It outlines each thing on the page and highlights the keywords it mentions. Say "walk me through it" to hear it again; the skip button stops it.
- **Models**: speech is transcribed by open-weight Whisper (`small.en` via faster-whisper, about 480 MB, preloaded when the backend starts; set `WHISPER_MODEL`/`WHISPER_LANGUAGE` in `backend/.env`). A local Qwen3 1.7B model (`ASSISTANT_MODEL`, falls back to `OLLAMA_MODEL`) answers free questions from the text DockProof read, keeping one small model loaded for a responsive laptop demo. Any number in an answer that is not in the data is rejected and replaced by the stored results. Kiwi's dashboard also accepts a user's own OpenAI-compatible API key for a cloud model; ChatGPT subscriptions do not provide free API credits, so Ollama is the no-cost path.

**If "Hey agent" does not react**
- The header switch shows the real state. *Click the page once*: browsers keep audio suspended until you click or press a key. *Mic blocked*: allow the microphone in the address bar. *Needs HTTPS*: use `localhost` or an https address (a plain `http://192.168...` address has no microphone).
- It shows what it heard when that was not the wake phrase (for example "Heard: hey asian"), so you can tell a misheard phrase from a dead microphone.
- The first voice request needs the Whisper model; check the backend log if it is still downloading.
- Spoken answers use the browser's built-in voice. Some Linux setups have none installed (Chrome then stays silent; on Debian/Ubuntu try `sudo apt install speech-dispatcher espeak-ng`). The agent keeps working without a voice; the text is shown.

- **Memory and speed**: the conversation is saved per session in the browser (it survives a reload) and the last 8 turns are sent to the model so follow-ups like "and how long does it take?" work. Answers stream sentence by sentence and are spoken as they arrive; each sentence is number-checked before it is shown. The header status says *Waiting*, *Listening to you*, *Thinking* or *Speaking (not listening)*, and shows what was heard.

Endpoints: `POST /api/voice/transcribe`, `POST /api/reconciliations/{id}/ask`, `POST /api/reconciliations/{id}/ask/stream`, `GET /api/reconciliations/{id}/cards`.

## URLs

- Frontend: <http://localhost:5173>
- API: <http://localhost:8000> (health: `/api/health`, docs: `/docs`)

## Environment variables

| File | Variable | Default |
|---|---|---|
| `backend/.env` | `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `backend/.env` | `OLLAMA_MODEL` | `qwen3:1.7b` |
| `backend/.env` | `CORS_ORIGINS` | `http://localhost:5173` |
| `backend/.env` | `CORS_ORIGIN_REGEX` | private-LAN dev origins |
| `frontend/.env` | `VITE_API_URL` | unset = same host as the page, port 8000 |
