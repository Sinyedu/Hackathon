# Agent map

Quick orientation for coding agents. Rules and scope live in `AGENTS.md` / `CLAUDE.md`; this file only maps code.

## Contract (change both sides together)

| Backend | Frontend |
|---|---|
| `backend/app/schemas/domain.py` | `frontend/src/types/reconciliation.ts` |
| `backend/app/api/reconciliations.py` | `frontend/src/services/api.ts` |

Routes: `POST /api/reconciliations`, `GET /api/reconciliations/{id}`, `POST /api/reconciliations/{id}/approve`, `GET /api/health`.
Unimplemented handlers return 501; services raise `NotImplementedError`. Replace stubs, don't rename them.

## Backend modules (owner · status)

| File | Purpose | Owner | Status |
|---|---|---|---|
| `services/extract.py` | Image/PDF -> RapidOCR -> LineItems with evidence | backend | done (not yet wired to the API) |
| `services/match.py` | rules, then Qwen candidate selection (`scripts/eval_matching.py` = live check) | AI | done |
| `services/reconcile.py` | pure Decimal discrepancy maths | backend | stub |
| `services/claims.py` | draft/approve claim, audit log | backend | stub |
| `services/ollama.py` | async Ollama client | AI | done |
| `core/db.py` | sqlite3 + schema (`init_db`) | backend | done (not yet called at startup) |
| `api/reconciliations.py` | HTTP orchestration | backend | stub |

## Frontend (owner: frontend)

`pages/` screens, `components/` UI pieces, `hooks/` data hooks, `services/api.ts` the only place that calls `fetch`.

## Commands

`make backend`, `make frontend`, `make test`, `make check` (tests + lint + build).
Update the Status column when you implement a stub.
