.PHONY: backend frontend test build lint check

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && pnpm dev

test:
	cd backend && .venv/bin/pytest -q

build:
	cd frontend && pnpm build

lint:
	cd frontend && pnpm lint

check: test lint build
