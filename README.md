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

Node 20+, pnpm, Python 3.11+ (with `venv`; on Debian/Ubuntu: `sudo apt install python3-venv`), and Ollama.

## Quick start

```bash
# Backend (terminal 1)
cd backend
python3 -m venv .venv && source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (terminal 2)
cd frontend
corepack pnpm install
cp .env.example .env
corepack pnpm dev --host 0.0.0.0
```

## Ollama

Install Ollama from <https://ollama.com/download>, then:

```bash
ollama pull qwen3:1.7b   # ~1.4 GB download
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

## Ask by voice (assistant)

The **Ask agent** button opens a full-screen agent: an orb, a **Speak with agent** button and floating cards (purchase order, delivery note, each problem, recovery, claim). Tap a card, or ask by voice or typing ("explain this", "what is in the delivery note?"), and the agent opens the matching card with a summary, the key numbers highlighted and a link to the original scan. **Hands-free is on by default**: just say "Hey agent" (no click) and ask. It keeps listening until you have been silent for 3 seconds, so pauses are fine. Audio that is not addressed to the agent is discarded without being sent to the model; the toggle in the agent turns it off (remembered per browser). Speech is transcribed locally by open-weight Whisper (`small.en` via faster-whisper, about 480 MB, downloaded on first use, with a vocabulary hint; set `WHISPER_MODEL`/`WHISPER_LANGUAGE` in `backend/.env`). A local Qwen3 4B model (`ollama pull qwen3:4b-instruct-2507-q4_K_M`, set with `ASSISTANT_MODEL`; falls back to `OLLAMA_MODEL` if missing) then answers from the text DockProof read plus its calculated results, with links to the original scans. It cannot see the image pixels. Any number in an answer that is not in the data is rejected and the answer is rebuilt from the stored results (shown as such). Compare models with `cd backend && PYTHONPATH=. python scripts/eval_assistant.py <model> ...`. The microphone needs HTTPS or localhost (the Vercel site and the tunnel qualify; a plain-HTTP LAN address does not, so type there). "Read answers aloud" uses the browser's built-in voice.
Endpoints: `POST /api/voice/transcribe`, `POST /api/reconciliations/{id}/ask`.

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
