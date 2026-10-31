# Deployment

Plan: **frontend on Vercel, backend + Ollama on the laptop exposed through an HTTPS tunnel.**
The backend cannot run on Vercel (needs Ollama, persistent SQLite, large OCR dependencies).
A full Render deployment (Docker with Ollama, >= 4 GB RAM, persistent disk) is a stretch goal.

## A. Phone on the same Wi-Fi (no deployment)

```bash
make backend-lan    # terminal 1
make frontend-lan   # terminal 2
```

Open `http://<laptop-ip>:5173` on the phone (`hostname -I` shows the laptop IP).
Leave `VITE_API_URL` unset: the app calls the same host on port 8000.
The camera input uses native file capture, which works over plain HTTP.

## B. Public demo: Vercel frontend + tunnelled backend

1. **Tunnel the API** (install `cloudflared` yourself first):
   ```bash
   make tunnel     # prints https://<random>.trycloudflare.com
   ```
   The URL changes on every restart (see "Gotchas").
2. **Backend env** (`backend/.env`), then restart the backend:
   ```env
   CORS_ORIGINS=http://localhost:5173,https://<your-app>.vercel.app
   CORS_ORIGIN_REGEX=https://dockproof.*\.vercel\.app   # optional: preview deployments
   ```
3. **Vercel**: import the repo, set **Root Directory = `frontend`**. Framework (Vite) and pnpm are
   auto-detected. Add the environment variable:
   `VITE_API_URL=https://<random>.trycloudflare.com` then deploy.
   (Or: `cd frontend && vercel --prod` after `vercel login`.)
4. Open the Vercel URL. The landing page must show **Backend online**.

## Gotchas
- `VITE_API_URL` is baked in at build time: a new tunnel URL means changing it in Vercel and
  redeploying. For a stable URL use a named Cloudflare tunnel or an ngrok free static domain.
- Browsers block an HTTPS page from calling an HTTP API, so the tunnel (HTTPS) is required for Vercel.
- The laptop must stay awake and online with Ollama running (`ollama list` shows `qwen3:1.7b`).
- SQLite lives in `backend/dockproof.db` on the laptop; deleting it resets all cases.
- Keep the local run (section A or `localhost`) as the fallback demo.

## Full cloud (stretch)
Render web service built from a Dockerfile that runs Ollama and the API, a persistent disk for
`dockproof.db` and the model, and an instance with enough RAM for `qwen3:1.7b`. Not set up yet.
