# Agent map

Quick orientation for coding agents. Rules and scope live in `AGENTS.md` / `CLAUDE.md`; this file only maps code.

## Contract (change both sides together)

| Backend | Frontend |
|---|---|
| `backend/app/schemas/domain.py` | `frontend/src/types/reconciliation.ts` |
| `backend/app/schemas/recovery.py` | `frontend/src/types/recovery.ts` |
| `backend/app/api/reconciliations.py` | `frontend/src/services/api.ts` |

Routes: `POST /api/reconciliations`, `GET /api/reconciliations/{id}`, `POST /api/reconciliations/{id}/approve`, `GET /api/health`.
Extra route: `GET /api/reconciliations/{id}/documents/{document_id}/file` serves the original scan for the confirm-against-image view.

## Backend modules (owner · status)

| File | Purpose | Owner | Status |
|---|---|---|---|
| `services/extract.py` | Image/PDF -> RapidOCR -> LineItems with evidence | backend | done (not yet wired to the API) |
| `services/match.py` | rules, then Qwen candidate selection (`scripts/eval_matching.py` = live check) | AI | done |
| `services/reconcile.py` | pure Decimal discrepancy maths; returns `ReconcileResult` (discrepancies, unresolved line ids, warnings) | backend | done |
| `services/claims.py` | draft/approve claim; approval refused unless status `ready` | backend | done |
| `services/store.py` | save/load Reconciliation JSON, transactions, audit log | backend | done |
| `services/ollama.py` | async Ollama client | AI | done |
| `core/db.py` | sqlite3 + schema (`init_db`, run at app startup) | backend | done |
| `frontend/src/pages/ScanPage.tsx`, `ReviewPage.tsx` | scan (camera/file) -> review beside scan, correct lines/products, approve; route is `#/r/<id>` | frontend | done |
| `api/catalog.py` | `GET /api/catalog` for the manual-match dropdown | backend | done |
| `api/reconciliations.py` | HTTP orchestration: create / get / approve / original scan file, `POST /{id}/corrections` | backend | done |
| `services/corrections.py` | user fixes OCR digits / picks products; re-reconciles, replaces or removes the draft claim, audits; refused after approval | backend | done |
| `services/suppliers.py` | supplier catalog in SQLite, idempotent seed from `fixtures/suppliers.json` | backend | done |
| `services/compat.py` | AutoRecover: rule-based product compatibility, Qwen only for ambiguous candidates | AI | done |
| `services/recovery_engine.py` | pure Decimal package/cost maths and transparent ranking | backend | done |
| `services/recovery.py` | shortage -> options -> persisted recovery plan | backend | done |
| `services/replacement_orders.py` | draft replacement orders, internal approve/reject, duplicate prevention | backend | done |
| `api/recovery.py` | suppliers, recover, draft order, approve/reject, `POST /api/demo/missing-tomatoes` | backend | done |
| `frontend/src/components/Recovery*.tsx`, `ReplacementOrderCard.tsx`, `hooks/useRecovery.ts` | AutoRecover UI inside the discrepancy card | frontend | done |
| `services/pipeline.py` | extract -> match -> reconcile -> persist -> draft claim | backend | done |
| `services/catalog.py` | loads `fixtures/catalog.json` (seeded catalog) | backend | done |

## Frontend (owner: frontend)

`pages/` screens, `components/` UI pieces, `hooks/` data hooks, `services/api.ts` the only place that calls `fetch`.

## Commands

`make backend`, `make frontend`, `make test`, `make check` (tests + lint + build).
Update the Status column when you implement a stub.
