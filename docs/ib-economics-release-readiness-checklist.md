# IB Economics HL/SL release-readiness checklist

**Disposition: locally verified candidate; production remains disabled and blocked.**

This checklist is IB Economics-only. Cambridge ingestion/classification work is out of scope and was not restarted.

## Checkout and runtime

- App: `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep`
  - branch: `main`
  - HEAD: `476e5d3f50bfa4f8cb636e4d5102e5ebc6f0eb7a`
  - pre-existing dirty state was preserved; no unrelated tracked file was reverted.
- Source: `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice`
  - branch: `master`
  - HEAD: `03c3fb0c1032fb0584547b8a03f3b25b8a3f8755`
  - source working tree was read/validated only; no source artifact was rewritten.
- Source Python: `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/.venv/bin/python` (Python 3.11.x; pinned project interpreter).
- App browser/test runtime: `/Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node` (Node v22.22.0, arm64, darwin).
- Default `/usr/local/bin/node` is Node v26.4.0 x64/Rosetta and is not the approved browser-runtime command for this checkout.

## Current gate matrix

| Gate | Current result | Evidence / remaining action |
|---|---|---|
| Source identity and classification | **PASS locally** | 184 unique canonical IDs; 111 HL rows / 42 papers; 89 SL rows / 32 papers; final and release-input validators returned `[]`. Do not rerun classification or audit pipeline. |
| Source provenance and runtime | **PASS locally** | Final SHA `28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb`; release-input SHA `0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39`; taxonomy SHA `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c`. |
| Source rights/publication | **BLOCKED pending decision** | Source retains `rights_status: unknown_publication_blocking`. A user-attested rights decision may satisfy this named-corpus policy boundary, but no independent legal clearance was inferred. |
| App candidate integration | **PASS locally** | `generate-ib-economics-production.mjs` generated deterministic HL/SL candidate runtime and private indexes. Runtime seals remain `published: false` and `assetVerification: pending_external_readback`. |
| Local-preview security | **PASS for development-only preview** | Explicit `NODE_ENV=development` plus `PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW=true`; unset/test/staging/preview/production deny. Traversal, outside symlink, raw-PDF, and spoofed forwarded-header cases are covered. |
| Production authorization | **PASS fail-closed, not enabled** | Production needs both `PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION=true` and `PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED=true`; default production catalog remains 12 banks. Entitlement and quota checks stay server-authoritative. |
| Private storage | **BLOCKED external** | Manifests are `upload: false`; no object upload or authoritative remote read-back/hash receipt exists. Exact namespaces are `ib-economics-hl/` and `ib-economics-sl/`. |
| Entitlements/billing | **BLOCKED external** | Product IDs are wired in code and the preparation migration, but products are inactive, no real Stripe price IDs are present, no migration was applied, and no external entitlement/webhook/quota read-back was performed. |
| Browser/PDF delivery | **PASS bounded normal path** | Fresh normal-path evidence covers HL/SL hydration, filters, question image, all 3 answer pages for the sampled question, and browser-triggered 4-page PDFs. It is not full-corpus browser signoff. |
| Release authorization | **BLOCKED** | No upload, migration, deployment, publication, merge, commit, or push is authorized or performed by this candidate pass. |

## Candidate artifacts

Source-approved inputs and outputs:

- `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/data/classification/final-classifications.json`
- `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/data/classification/release-inputs.json`
- `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/data/classification/release-taxonomy.json`
- `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/site/data/questions-hl.json`
- `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/site/data/questions-sl.json`
- `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/site/assets/ib-economics/`

App candidate outputs:

- `src/data/production/ib-economics-hl.json` — 111 questions / 42 papers; runtime SHA `bfc686cd227db3cac7e106166c2f379efdf34850845330ce716b592e03a9b9db`
- `src/data/production/ib-economics-sl.json` — 89 questions / 32 papers; runtime SHA `276534dbe988bf36e3e4945c9b5b538997a897d852e26cb4188d3b382254af05`
- `src/data/private-index/ib-economics-hl.json`
- `src/data/private-index/ib-economics-sl.json`
- `src/data/ib-economics-runtime-manifest.json`
- `docs/ib-economics-asset-manifests/ib-economics-hl-upload-manifest.json` — 965 derived assets
- `docs/ib-economics-asset-manifests/ib-economics-sl-upload-manifest.json` — 639 derived assets
- `supabase/migrations/20260911010000_add_ib_economics_candidate.sql` — preparation only; product rows explicitly `active=false`, no price IDs

## Fresh verification run

All commands below were run in the current checkout.

1. Candidate generation:

   ```text
   /Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node scripts/generate-ib-economics-production.mjs
   -> exit 0; HL 111/42 with 965 assets; SL 89/32 with 639 assets
   ```

2. Source foundation:

   ```text
   ./.venv/bin/python scripts/verify_foundation.py
   -> document_count 132, pair_count 66, rights_blocking_count 66, sha256_verified true
   ```

3. Source focused release tests:

   ```text
   ./.venv/bin/python -m pytest -q tests/test_site_data.py tests/test_release_inputs.py tests/test_semantic_qa.py tests/test_apply_semantic_repairs.py
   -> 33 passed in 31.33s
   ```

4. Source direct validators and seals:

   ```text
   validate_final_classifications -> []
   validate_release_inputs -> []
   final rows/unique IDs -> 184/184
   ```

5. App focused IB/security/entitlement tests:

   ```text
   /Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node ./node_modules/vitest/vitest.mjs run \
     src/components/QuestionExplorer.test.tsx \
     src/lib/ib-economics-local-preview.test.ts \
     src/lib/local-preview-asset-security.test.ts \
     src/lib/local-preview-route.test.ts \
     src/lib/ib-economics-production-integration.test.ts \
     src/app/api/pdf/sign/ib-economics-production.test.ts \
     src/app/api/private-bank-index/[bank]/route.test.ts \
     src/lib/access.test.ts src/lib/entitlements.test.ts \
     src/lib/assets.test.ts src/lib/private-assets.test.ts src/lib/signed-assets.test.ts
   -> 12 files passed; 78 tests passed; exit 0
   ```

6. App static checks:

   ```text
   /Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node node_modules/eslint/bin/eslint.js
   -> exit 0

   /Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node node_modules/typescript/bin/tsc --noEmit
   -> exit 0
   ```

7. Normal-path browser evidence already read back from:
   `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/ib-economics-normalpath-browser-qa.json`

   - `normalPath: true`, `fetchShim: false`, `cacheOverride: false`, `monkeypatch: false`
   - HL index 200/111 rows; SL index 200/89 rows
   - HL filters: Microeconomics 59, Global economy 60, 2025 29
   - SL filters: Microeconomics 44, Global economy 48, 2025 25
   - sampled question and all 3 official-answer images decoded for both levels
   - browser PDFs: 4 pages each, `[5,5,5,5]` image objects per page, download failure `null`

## Exact external release handles

Do these only after separately authorized source/rights approval; none were done here.

1. **Storage owner:** provision the private `question-assets` authority and upload only the two manifests above. Verify every object key, byte size, and SHA-256 remotely; record a read-back receipt for both namespaces. Then update the runtime candidate's external verification state. Do not upload raw PDFs or recursively sync the shared source tree.
2. **Billing/Supabase owner:** create/read back the real product and price tuples for `bank_ib_economics_hl`, `bank_ib_economics_sl`, and `bundle_ib_economics`; configure webhook allowlists and quota/RPC behavior. Do not invent `price_...` values. Apply `supabase/migrations/20260911010000_add_ib_economics_candidate.sql` only after storage, rights, and product approval, then read back product rows/functions.
3. **Release-QA owner:** rerun independent review against the corrected current tree, then exercise logged-out denial, entitled HL/SL index/assets/PDF, expired/revoked denial, quota exhaustion, mixed-provider PDF, rollback/previous-authority, and the agreed full-corpus browser/PDF sample. Preserve the evidence paths and hashes.
4. **Release owner:** after all receipts are independently reviewed, explicitly authorize enabling both production flags, exposing the two catalog entries, migration execution, deployment, and publication. Keep both flags unset and the migration unapplied until then.

## Boundary

This candidate is ready for the external storage/billing/rights/release handoff, not for production enablement. The prior local-preview answer-hydration blocker is repaired in `QuestionExplorer` and covered by the local-preview UI regression; paid signer/auth/quota paths remain unchanged. No Cambridge files were changed by this pass.
