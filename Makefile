.PHONY: backend frontend test test-frontend build lint check backend-lan frontend-lan tunnel

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && pnpm dev

test:
	cd backend && .venv/bin/pytest -q

test-frontend:
	cd frontend && pnpm test

build:
	cd frontend && pnpm build

lint:
	cd frontend && pnpm lint

check: test test-frontend lint build

# Phone on the same Wi-Fi: open http://<laptop-ip>:5173
backend-lan:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-lan:
	cd frontend && pnpm dev --host

# Public HTTPS URL for the local API (needs cloudflared installed)
tunnel:
	cloudflared tunnel --url http://localhost:8000
