## What changed
<!-- One or two sentences: what and why. Link the task or issue if there is one. -->

## Area
- [ ] Frontend
- [ ] Backend
- [ ] AI matching / prompts
- [ ] CI / docs / tooling

## How it was verified
<!-- Paste the exact commands you ran and their results. Do not tick a box you did not run. -->
- [ ] `cd backend && pytest`
- [ ] `cd frontend && pnpm test`
- [ ] `cd frontend && pnpm lint && pnpm build`
- [ ] Ran the demo flow (upload/scan, match, discrepancy, draft claim, approve, still there after refresh)

## Safety checklist
- [ ] Quantities and prices come from code, never from the model
- [ ] No simulated success: claims and approvals are shown only after they are persisted
- [ ] Model output is validated; an Ollama outage still leaves a manual-review path
- [ ] No secrets, real business data or large binaries committed (fixtures stay synthetic)

## Contracts and conflicts
- [ ] No routes, fields or folders renamed, or the other developer has been told
- [ ] `package.json` and `pnpm-lock.yaml` (or `requirements.txt`) changed together, if dependencies changed
- [ ] No broad reformatting that will cause merge conflicts

## Notes for the reviewer
<!-- Known risks, follow-ups, screenshots for UI changes. -->
