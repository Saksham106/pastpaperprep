# Worked explanations

Each question can carry a worked explanation: an "Explanation" button beside "Show answer" that shows how the official answer is reached, step by step, with the mark codes each step earns.

## Where things live

| What | Where | In Git? |
|---|---|---|
| Writing spec | `scripts/explanations/SPEC.md` | yes |
| Generated explanations | `../research/explanations/<bank>/<id>.json` | **no** (premium; this repo is public) |
| Verification ledger | `../research/explanations/<bank>/_ledger.json` | no |
| Published objects | R2 `pastpaperprep-assets`, key `explanations/<bank>/<id>.json` | no |
| Which questions have one | `src/data/explanations/available.json` (IDs only) | yes |

The public bank index carries `hasExplanation: true` for listed IDs. The explanation itself is signed by `/api/assets/sign` (paid) or `/api/assets/free` (free years) with the same access rule as the mark scheme, always from R2. Explanation signing does not spend the daily download allowance. R2 CORS (`config/r2-cors.json`) already allows `GET` from the site, which the browser needs to fetch the JSON.

Explanations sit under their own top-level prefix, outside every bank's image prefix, so `npm run r2:verify` is unaffected.

## Pipeline

1. **Prepare** a manifest (question/mark-scheme PNGs, extracted text, output paths):
   `node scripts/explanations/prepare-batch.mjs --bank ib-hl --all --pending`
2. **Generate and verify** with subagents (Claude Code workflow): one agent writes each explanation from the images following `SPEC.md` and runs `validate.mjs`; a fresh agent solves the question blind, checks it against the mark scheme and returns pass / fix / fail. Fails and critical issues are repaired and re-verified once; anything still failing is held for review.
3. **Ledger**: save the workflow's per-question statuses to `_ledger.json`.
4. **Publish** (owner approval; temporary bucket-scoped R2 token as `R2_SYNC_ACCESS_KEY_ID` / `R2_SYNC_SECRET_ACCESS_KEY`):
   `node scripts/explanations/publish.mjs --bank ib-hl` (dry run), then `--apply`. It uploads, reads every object back by hash, and writes the verified IDs to `available.json`. Commit that file; the button appears after the next deploy.

## Local preview

Signing returns 503 locally (no R2 keys). To see explanations in `next dev`, copy JSON files to `public/dev-explanations/<bank>/` (ignored by Git) and start the dev server with `NEXT_PUBLIC_EXPLANATIONS_DEV=1`. The bank index then flags those questions and the client reads the local files. Never set this variable in Vercel.

## Taking one down

Remove its ID from `available.json` and deploy. The R2 object can stay; nothing links to it.
