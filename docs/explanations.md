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
4. **Before the first deploy**, reconcile the original migration history and apply `supabase/migrations/20261012010000_atomic_explanation_sign_allowance.sql` with owner approval. Read back both `consume_explanation_allowance` and `consume_explanation_and_download_allowance`, their ACLs, and migration history. The forward migration preserves the original migration file, rejects invalid counts before exemption handling, and atomically debits mixed explanation/image requests. A missing mixed-call RPC fails closed with 503; do not deploy ahead of this dependency.
5. **Publish** (owner approval; temporary bucket-scoped R2 token as `R2_SYNC_ACCESS_KEY_ID` / `R2_SYNC_SECRET_ACCESS_KEY`):
   `node scripts/explanations/publish.mjs --bank ib-hl` (dry run), then `--apply`. Uploads use atomic create-if-absent (`If-None-Match: *`), never overwrite an existing object, and read back every projected body by SHA-256. An existing identical object is accepted; a conflict, upload failure, or read-back failure holds the entire proposed bank set and leaves `available.json` unchanged. A durable receipt under `<bank>/_publish-receipts/` records the exact expected keys/hashes and every verification result before the availability file is atomically replaced. Commit that file only after a complete receipt; the button appears after the next deploy.

### Publishing safety and evidence

- Dry runs do not construct a remote client, upload, write receipts, or edit availability. `--verify-only` performs remote reads and local receipt/availability writes; it is not a dry run.
- `--via-wrangler --verify-only` is supported. Wrangler uploads are deliberately refused because its CLI path does not enforce atomic create-if-absent; use the temporary scoped S3 token for `--apply`. Do not work around conflicts by overwriting: hold the ID for a separately reviewed correction/replacement operation.
- Reconcile remote hashes against exactly `JSON.stringify({ schemaVersion: 1, bank, questionId, totalMarks: doc.totalMarks, parts: doc.parts })`, not the pretty-printed local file bytes. Review-only metadata is intentionally excluded. Receipts contain IDs/hashes, not premium text.
- Local explanation/ledger reads reject traversal, symlinked files and ancestors, non-canonical roots, and path/inode changes around opening and reading. Pass a canonical `PPP_PROJECTS_ROOT` when needed.
- Publication requires a known runtime question, matching runtime mark total, a unique ledger ID, a publishable ledger status, structural/KaTeX validation, and no `needs_review` flag. Structural validation checks mark-code syntax and part totals; it does **not** prove the printed mark allocation, mathematical answers, or code ownership against source images.

### Ledger and blind-review provenance

Use `ledger-from-journal.mjs --bank <bank> --manifest <manifest.json> <earliest.jsonl> <later.jsonl> ...` with journals in chronological workflow order. Results require an explicit matching `bank` field or a matching bank-tagged stage label; if both exist they must agree. Generic/unbanked results are ignored even in a supposedly bank-specific journal. AI HL and AI SL deliberately reuse IDs. The manifest and its tasks must name the requested bank and contain unique safe IDs. Subset manifests preserve existing rows outside their scope. New failures supersede prior passes; newer verify/fix events invalidate older rechecks. A minor repair needs both `fixed: true` and `validatorPassed: true`.

The corrected reducer writes `bankEvidenceVersion: 1` at ledger level and on each row reconstructed from scoped journal evidence, with the row's `bank`. Publication requires all three markers. Prior passes are inherited only from such scoped ledgers/rows; neither a legacy pass nor adding a header silently upgrades evidence. Rows retained outside a subset stay unproven unless already scoped, and are held by the publisher. Explicitly rematerialize legacy ledgers by replaying the complete original journals against a full-bank manifest into a separately reviewed private output root. Preserve original ledgers/journals; compare IDs and held outcomes before replacing any operational ledger with owner approval. Do not hand-add markers or infer banks from IDs. Ambiguous historical results need explicit bank evidence or fresh targeted review.

These markers identify corrected bank-scoped reducer semantics only: they are not cryptographic proof, hashes of reviewed content, or a claim of new blind verification. A full replay does not convert historical review into hash-bound review of current files.

A ledger pass is an assertion, not sufficient evidence that the current file was blind-reviewed. Keep the generator and fresh verifier identities, blind-solution/source-reading trace, original verdict, repair and recheck results, exact explanation/source hashes, and journal paths. Historical journals without content hashes cannot prove that later local edits were reviewed. Hold IDs with missing or cross-bank provenance for targeted review; do not reconstruct proof from generated counts or silently rewrite private ledgers.

### Migration-history release gate

Verify both the installed `consume_explanation_allowance` definition/permissions and the migration-history record `20261012000000`. A matching installed function alone does not prove that migration history is reconciled. If the function is already installed but that record is absent, stop automatic replay and arrange an owner-approved migration-history reconciliation after comparing the installed definition; do not change production during an audit.

## Coverage and review holds

The current candidate advertises 1,972 explanations: AA HL 801, AA SL 541, AI HL 300, and AI SL 330. Availability is per question, not a claim that every question in those banks is complete. Physics and the IGCSE pilot remain unadvertised.

The audit held 104 formerly advertised AI HL IDs because their journal verdicts came only from AI SL reviewers of shared IDs. This is a provenance hold, not a claim that their mathematics is wrong. Their objects and original private ledgers remain unchanged. Restore an ID only after independent same-bank verification and a reviewed availability update; never restore the old ledger's inferred passes. A bank-scoped replay protects the boundary but is not a new blind review or a content-hash binding for historical results.

Cloudflare readback matched all 2,076 pre-hold objects to their exact publication projections by key, size and single-part ETag/MD5. Sixteen full GET samples matched SHA-256, and a separate 16-question source/content sample found no mathematical blocker. The sample was not a sealed, strictly mark-scheme-blind exercise and does not establish correctness of every explanation. Two AA HL prose corrections are staged privately for a separately approved content replacement; they are not uploaded or committed as premium text.

## Local preview

Signing returns 503 locally without storage credentials. Vercel previews also lack the production-only R2 credentials, and their origins are outside the intentional R2 CORS allowlist. Do not broaden credentials or CORS merely to make previews pass.

To check rendering in `next dev`, copy only the student-facing JSON projection to `public/dev-explanations/<bank>/` (ignored by Git) and start the dev server with `NEXT_PUBLIC_EXPLANATIONS_DEV=1`. Treat this as local client/rendering QA, not production entitlement, signing, or quota evidence. Remove all local explanation fixtures before a production build; production must refuse this directory and deny its HTTP path even if the client flag is set. Never set the flag in Vercel.

## Taking one down

Remove its ID from `available.json` and deploy. The R2 object can stay; nothing links to it.
