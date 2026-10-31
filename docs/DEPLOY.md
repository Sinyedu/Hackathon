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

Cloudflare only provides the tunnel (a public HTTPS address for your laptop). The backend, OCR,
SQLite and Ollama all keep running on the laptop. `cloudflared` is installed at
`~/.local/bin/cloudflared` (no account or login needed for quick tunnels).

### Checklist: what Vercel needs
- [ ] The repo pushed to GitHub (it is) and a Vercel account connected to it.
- [ ] A Vercel project with **Root Directory = `frontend`** (Vite and pnpm are auto-detected;
      `frontend/vercel.json` already handles routing).
- [ ] Environment variable **`VITE_API_URL`** = your tunnel URL (no trailing slash), for Production
      (and Preview if you want previews to work).
- [ ] The Vercel URL added to the backend's `CORS_ORIGINS`.

### Steps
1. Start everything on the laptop: `ollama list` must show `qwen3:1.7b`, then `make backend`.
2. `make tunnel` in a second terminal. It prints `https://<words>.trycloudflare.com`; keep it running.
3. Check it: `curl https://<words>.trycloudflare.com/api/health` returns `{"service":"DockProof API","status":"ok"}`.
4. First deploy only: create the Vercel project (dashboard import, or `cd frontend && npx vercel`),
   set `VITE_API_URL` to the tunnel URL, deploy. Note the production URL, e.g. `https://dockproof.vercel.app`.
5. In `backend/.env` set (the backend reloads automatically):
   ```env
   CORS_ORIGINS=http://localhost:5173,https://dockproof.vercel.app
   # optional, to allow preview deployments:
   CORS_ORIGIN_REGEX=https://dockproof.*\.vercel\.app
   ```
6. Open the Vercel URL: the landing page must say **Backend online**. Test an upload from a phone.

### Every time the tunnel restarts
Quick-tunnel URLs change on each run, so update `VITE_API_URL` in Vercel and redeploy
(Vercel dashboard -> Settings -> Environment Variables -> Redeploy). Avoid this by doing the
setup once, right before the demo, and not restarting `make tunnel` afterwards.

### Stable URL (optional)
A named Cloudflare tunnel keeps one URL but needs a free Cloudflare account and a domain on it:
`cloudflared tunnel login`, `cloudflared tunnel create dockproof`,
`cloudflared tunnel route dns dockproof api.<your-domain>`, then
`cloudflared tunnel run --url http://localhost:8000 dockproof`. Set `VITE_API_URL=https://api.<your-domain>` once.

## Gotchas
- `VITE_API_URL` is baked in at build time: a new tunnel URL means changing it in Vercel and
  redeploying. For a stable URL use a named Cloudflare tunnel or an ngrok free static domain.
- Browsers block an HTTPS page from calling an HTTP API, so the tunnel (HTTPS) is required for Vercel.
- The tunnel makes the API publicly reachable with no login. Use synthetic data only, and stop it after the demo.
- The laptop must stay awake and online with Ollama running (`ollama list` shows `qwen3:1.7b`).
- SQLite lives in `backend/dockproof.db` on the laptop; deleting it resets all cases.
- Keep the local run (section A or `localhost`) as the fallback demo.

## Full cloud (stretch)
Render web service built from a Dockerfile that runs Ollama and the API, a persistent disk for
`dockproof.db` and the model, and an instance with enough RAM for `qwen3:1.7b`. Not set up yet.
