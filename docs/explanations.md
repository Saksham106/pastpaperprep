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

The public bank index carries `hasExplanation: true` for listed IDs. The explanation itself is signed by `/api/assets/sign` (paid) or `/api/assets/free` (free years) with the same access rule as the mark scheme, always from R2. Explanation signing does not spend the daily download allowance. Instead each member can open at most 200 paid explanations a day (`consume_explanation_allowance`, migration `20261012000000_explanation_daily_cap.sql`); free-year explanations and accounts with a download exemption are not capped. R2 CORS (`config/r2-cors.json`) already allows `GET` from the site, which the browser needs to fetch the JSON.

Explanations sit under their own top-level prefix, outside every bank's image prefix, so `npm run r2:verify` is unaffected.

## Pipeline

1. **Prepare** a manifest (question/mark-scheme PNGs, extracted text, output paths):
   `node scripts/explanations/prepare-batch.mjs --bank ib-hl --all --pending`
2. **Generate and verify** with subagents (Claude Code workflow): one agent writes each explanation from the images following `SPEC.md` and runs `validate.mjs`; a fresh agent solves the question blind, checks it against the mark scheme and returns pass / fix / fail. Fails and critical issues are repaired and re-verified once; anything still failing is held for review.
3. **Ledger**: save the workflow's per-question statuses to `_ledger.json`.
4. **Before the first deploy**, apply `supabase/migrations/20261012000000_explanation_daily_cap.sql` to production and read back `consume_explanation_allowance` (owner approval). Without it, paid explanations return 503.
5. **Publish** (owner approval; temporary bucket-scoped R2 token as `R2_SYNC_ACCESS_KEY_ID` / `R2_SYNC_SECRET_ACCESS_KEY`):
   `node scripts/explanations/publish.mjs --bank ib-hl` (dry run), then `--apply`. Uploads use atomic create-if-absent (`If-None-Match: *`), never overwrite an existing object, and read back every projected body by SHA-256. An existing identical object is accepted; a conflict, upload failure, or read-back failure holds the entire proposed bank set and leaves `available.json` unchanged. A durable receipt under `<bank>/_publish-receipts/` records the exact expected keys/hashes and every verification result before the availability file is atomically replaced. Commit that file only after a complete receipt; the button appears after the next deploy.

### Publishing safety and evidence

- Dry runs do not construct a remote client, upload, write receipts, or edit availability. `--verify-only` performs remote reads and local receipt/availability writes; it is not a dry run.
- `--via-wrangler --verify-only` is supported. Wrangler uploads are deliberately refused because its CLI path does not enforce atomic create-if-absent; use the temporary scoped S3 token for `--apply`. Do not work around conflicts by overwriting: hold the ID for a separately reviewed correction/replacement operation.
- Reconcile remote hashes against exactly `JSON.stringify({ schemaVersion: 1, bank, questionId, totalMarks: doc.totalMarks, parts: doc.parts })`, not the pretty-printed local file bytes. Review-only metadata is intentionally excluded. Receipts contain IDs/hashes, not premium text.
- Local explanation/ledger reads reject traversal, symlinked files and ancestors, non-canonical roots, and path/inode changes around opening and reading. Pass a canonical `PPP_PROJECTS_ROOT` when needed.
- Publication requires a known runtime question, matching runtime mark total, a unique ledger ID, a publishable ledger status, structural/KaTeX validation, and no `needs_review` flag. Structural validation checks mark-code syntax and part totals; it does **not** prove the printed mark allocation, mathematical answers, or code ownership against source images.

### Ledger and blind-review provenance

Use `ledger-from-journal.mjs --bank <bank> --manifest <manifest.json> <earliest.jsonl> <later.jsonl> ...` with journals in chronological workflow order. Bank-tagged results are scoped to that bank: AI HL and AI SL deliberately reuse IDs. Untagged legacy labels must come from a bank-specific journal. The manifest and its tasks must name the requested bank and contain unique safe IDs. Subset manifests preserve existing rows outside their scope. New failures supersede prior passes; newer verify/fix events invalidate older rechecks. A minor repair needs both `fixed: true` and `validatorPassed: true`.

A ledger pass is an assertion, not sufficient evidence that the current file was blind-reviewed. Keep the generator and fresh verifier identities, blind-solution/source-reading trace, original verdict, repair and recheck results, exact explanation/source hashes, and journal paths. Historical journals without content hashes cannot prove that later local edits were reviewed. Hold IDs with missing or cross-bank provenance for targeted review; do not reconstruct proof from generated counts or silently rewrite private ledgers.

### Migration-history release gate

Verify both the installed `consume_explanation_allowance` definition/permissions and the migration-history record `20261012000000`. A matching installed function alone does not prove that migration history is reconciled. If the function is already installed but that record is absent, stop automatic replay and arrange an owner-approved migration-history reconciliation after comparing the installed definition; do not change production during an audit.

## Local preview

Signing returns 503 locally (no R2 keys). To see explanations in `next dev`, copy JSON files to `public/dev-explanations/<bank>/` (ignored by Git) and start the dev server with `NEXT_PUBLIC_EXPLANATIONS_DEV=1`. The bank index then flags those questions and the client reads the local files. Never set this variable in Vercel.

## Taking one down

Remove its ID from `available.json` and deploy. The R2 object can stay; nothing links to it.
