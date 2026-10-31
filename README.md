# DockProof

[![CI](https://github.com/Hizashii/Hackathon/actions/workflows/ci.yml/badge.svg)](https://github.com/Hizashii/Hackathon/actions/workflows/ci.yml)

AI-powered delivery reconciliation. DockProof compares a purchase order, delivery note and invoice,
uses a small local open-weight model (Qwen3 1.7B via Ollama) to match differently named products,
and uses deterministic code for quantities, prices, discrepancies and claims. Claims require human approval.

> Status: working end to end: scan or upload, OCR, AI product matching, reconciliation, claims, correction and approval, plus **AutoRecover** (shortage recovery plans and draft replacement orders). See `docs/MAP.md`.
> See `AGENTS.md`, `CLAUDE.md` and `DESCRIPTION.md` for scope and rules.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS v4, pnpm, native `fetch`
- Backend: Python 3.11+ / FastAPI / Pydantic / SQLite
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
uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

## Ollama

Install Ollama from <https://ollama.com/download>, then:

```bash
ollama pull qwen3:1.7b   # ~1.4 GB download
ollama run qwen3:1.7b    # optional interactive smoke test
```

The backend never downloads the model or runs inference at startup.

## Development commands

| Task | Command |
|---|---|
| Backend tests | `cd backend && pytest` |
| Model accuracy check (needs Ollama) | `cd backend && PYTHONPATH=. python scripts/eval_matching.py` |
| OCR spike on an image | `cd backend && python scripts/ocr_spike.py IMAGE` |
| Frontend build + typecheck | `cd frontend && pnpm build` |
| Frontend lint | `cd frontend && pnpm lint` |

See `docs/DEPLOY.md` for phone access and the Vercel + tunnel deployment, and `docs/CI-CD.md` for the GitHub Actions pipeline.

## AutoRecover demo (about 60 seconds)

Needs the backend, frontend and Ollama running (`ollama list` shows `qwen3:1.7b`).

1. Open the app and click **Try the demo scenario: Missing Tomatoes**. The real OCR/matching/reconciliation runs on the synthetic fixture scans: 24 cases ordered, 18 delivered.
2. On the shortage card (-6 cases) click **Find Recovery Options**. AutoRecover searches the seeded suppliers and shows ranked options with costs, lead times and reasons. Toggle **Cheapest first / Fastest first** to see the ranking change.
3. Click **Create Replacement Order** on an option, then **Approve draft** (an AI-assessed substitute needs the confirmation box ticked first).
4. Reload the page: the order status is still there (persisted in SQLite).

Suppliers are loaded from `fixtures/suppliers.json` at backend startup. The seed is idempotent and never overwrites existing rows; to re-seed manually run `cd backend && PYTHONPATH=. python -c "from app.services.suppliers import seed_suppliers; print(seed_suppliers())"`.
New endpoints: `GET /api/suppliers`, `POST /api/reconciliations/{id}/discrepancies/{item}/recover`, `GET .../recovery`, `POST /api/recovery-plans/{id}/draft-order`, `POST /api/replacement-orders/{id}/approve|reject`, `POST /api/demo/missing-tomatoes`.

## Ask by voice (assistant)

The floating **Ask** button opens a chat. Tap the microphone and speak, or type or pick a question. Speech is transcribed locally by open-weight Whisper (`base.en` via faster-whisper, about 145 MB, downloaded on first use; set `WHISPER_MODEL`/`WHISPER_LANGUAGE` in `backend/.env`). Qwen3 1.7B then answers from the text DockProof read plus its calculated results, with links to the original scans. It cannot see the image pixels. The microphone needs HTTPS or localhost (the Vercel site and the tunnel qualify; a plain-HTTP LAN address does not, so type there). "Read answers aloud" uses the browser's built-in voice.
Endpoints: `POST /api/voice/transcribe`, `POST /api/reconciliations/{id}/ask`.

## URLs

- Frontend: <http://localhost:5173>
- API: <http://localhost:8000> (health: `/api/health`, docs: `/docs`)

## Environment variables

| File | Variable | Default |
|---|---|---|
| `backend/.env` | `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `backend/.env` | `OLLAMA_MODEL` | `qwen3:1.7b` |
| `backend/.env` | `DATABASE_URL` | `sqlite:///./dockproof.db` |
| `backend/.env` | `CORS_ORIGINS` | `http://localhost:5173` |
| `backend/.env` | `CORS_ORIGIN_REGEX` | private-LAN dev origins |
| `frontend/.env` | `VITE_API_URL` | unset = same host as the page, port 8000 |
