# DockProof

AI-powered delivery reconciliation. DockProof compares a purchase order, delivery note and invoice,
uses a small local open-weight model (Qwen3 1.7B via Ollama) to match differently named products,
and uses deterministic code for quantities, prices, discrepancies and claims. Claims require human approval.

> Status: scaffold plus working OCR extraction (`services/extract.py`) and AI product matching (`services/match.py`). Upload API, reconciliation, claims and UI are still stubs; see `docs/MAP.md`.
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

## URLs

- Frontend: <http://localhost:5173>
- API: <http://localhost:8000> (health: `/api/health`, docs: `/docs`)

## Environment variables

| File | Variable | Default |
|---|---|---|
| `backend/.env` | `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `backend/.env` | `OLLAMA_MODEL` | `qwen3:1.7b` |
| `backend/.env` | `DATABASE_URL` | `sqlite:///./dockproof.db` |
| `frontend/.env` | `VITE_API_URL` | `http://localhost:8000` |
