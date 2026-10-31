# DockProof

[![CI](https://github.com/Hizashii/Hackathon/actions/workflows/ci.yml/badge.svg)](https://github.com/Hizashii/Hackathon/actions/workflows/ci.yml)

AI-powered delivery reconciliation. DockProof compares a purchase order, delivery note and invoice,
uses a small local open-weight model (Qwen3 1.7B via Ollama) to match differently named products,
and uses deterministic code for quantities, prices, discrepancies and claims. Claims require human approval.

> Status: working end to end: scan or upload, OCR, AI product matching, reconciliation, claims, correction and approval, plus **AutoRecover** (shortage recovery plans and draft replacement orders). See `docs/MAP.md`.
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
ollama pull qwen3:4b-instruct-2507-q4_K_M     # ~2.5 GB: the voice assistant's answers
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

**Hey agent, anywhere on the site.** Saying "Hey agent" (alone, or followed by your request) opens the agent already listening, so no click is needed. It keeps listening until you have been silent for 3 seconds. The **Hey agent** switch in the header turns this off (remembered per browser). Audio that does not start with the wake phrase is discarded and never reaches a model; transcription runs on your machine.

- **Open my files**: the agent shows a paperclip. Tap it and pick your purchase order and delivery note from wherever you keep them. Reading starts the moment they are in. (Browsers do not allow a page to open a file dialog from speech alone, so one tap is needed.) Names containing "order"/"po" or "delivery"/"dn" are sorted automatically; otherwise the agent asks which is which.
- **Walkthrough**: after a delivery is analysed the agent docks to the bottom and tours the result by voice: the headline, the two columns read from your scans, why the red rows are red, the open product question, the draft claim, the recovery option and the notes. It outlines each thing on the page and highlights the keywords it mentions. Say "walk me through it" to hear it again; the skip button stops it.
- **Models**: speech is transcribed by open-weight Whisper (`small.en` via faster-whisper, about 480 MB, preloaded when the backend starts; set `WHISPER_MODEL`/`WHISPER_LANGUAGE` in `backend/.env`). A local Qwen3 4B model (`ASSISTANT_MODEL`, falls back to `OLLAMA_MODEL`) answers free questions from the text DockProof read. Any number in an answer that is not in the data is rejected and replaced by the stored results. Compare models with `cd backend && PYTHONPATH=. python scripts/eval_assistant.py <model> ...`.

**If "Hey agent" does not react**
- The header switch shows the real state. *Click the page once*: browsers keep audio suspended until you click or press a key. *Mic blocked*: allow the microphone in the address bar. *Needs HTTPS*: use `localhost` or an https address (a plain `http://192.168...` address has no microphone).
- It shows what it heard when that was not the wake phrase (for example "Heard: hey asian"), so you can tell a misheard phrase from a dead microphone.
- The first voice request needs the Whisper model; check the backend log if it is still downloading.
- Spoken answers use the browser's built-in voice. Some Linux setups have none installed (Chrome then stays silent; on Debian/Ubuntu try `sudo apt install speech-dispatcher espeak-ng`). The agent keeps working without a voice; the text is shown.

Endpoints: `POST /api/voice/transcribe`, `POST /api/reconciliations/{id}/ask`, `GET /api/reconciliations/{id}/cards`.

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
