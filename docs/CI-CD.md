# CI / CD

## CI (`.github/workflows/ci.yml`)
Runs on every push to `main` and every pull request:

| Job | What it runs |
|---|---|
| Backend | `pip install -r backend/requirements.txt`, then `pytest` (Ollama is mocked; no model needed) |
| Frontend | `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build` (TypeScript check included) |

Run the same checks locally with `make check`.
Keep `backend/requirements.txt` and `frontend/pnpm-lock.yaml` committed and in sync: CI installs from them.

## CD (`.github/workflows/deploy-frontend.yml`)
After CI succeeds on `main`, the frontend is built and deployed to Vercel production.
It builds with `VITE_API_URL` taken from the GitHub repository variable of the same name (see setup below).

**One-time setup** (the deploy step is skipped until all three secrets exist):
1. Create a Vercel token: vercel.com -> Account Settings -> Tokens.
2. Get the IDs: run `npx vercel link` inside the repo root (choose the existing project), then read
   `orgId` and `projectId` from `.vercel/project.json` (git-ignored). Or find them in the Vercel
   project settings.
3. GitHub repo -> Settings -> Secrets and variables -> Actions -> add:
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
   Then, on the **Variables** tab (not Secrets), add `VITE_API_URL` = your current tunnel URL.
   Vercel cannot hand "Sensitive" variables to the CLI, so the deploy workflow takes the API URL
   from this GitHub variable instead. Update it whenever the tunnel URL changes.
4. Avoid double deploys: Vercel's own Git integration also deploys every push. Once the secrets work,
   turn off its production deploys by adding to `frontend/vercel.json`:
   ```json
   "git": { "deploymentEnabled": { "main": false } }
   ```
   (Do this only after a successful Actions deploy, otherwise `main` would not deploy at all.)

## What is not automated
The backend, Ollama and the Cloudflare tunnel run on a laptop, so there is no server to deploy to.
Backend "delivery" is `git pull` + `make backend`. If the tunnel URL changes, update `VITE_API_URL`
in Vercel and re-run the deploy workflow (Actions -> Deploy frontend -> Re-run).
