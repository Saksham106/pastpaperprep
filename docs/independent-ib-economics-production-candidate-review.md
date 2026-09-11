# Independent IB Economics production-candidate review

**Decision: BLOCKED — not `PASS LOCAL candidate`.**

This is a repository-local review of the dirty candidate change set in
`pastpaperprep`, with source provenance checked against the sibling repository
`ib-economics-topic-practice`. The original review made no app-code fix, source
mutation, upload, DB, Stripe, deploy, or commit. This document owns only the
independent-review record; the repair evidence below is self-check evidence and
is not an independent closure.

## Blocking finding

- **Local-preview answer hydration uses the paid endpoint.** The initial
  question-image effect correctly calls `fetchSignedAssets(..., localPreview)`
  (`src/components/QuestionExplorer.tsx:420-443`), but `QuestionCard` does not
  receive that prop and its answer handler calls
  `fetchSignedAssets(question.bankSlug, [...])` without `localPreview`
  (`src/components/QuestionExplorer.tsx:662-700`). For an enabled local
  Economics preview, clicking **Show answer** therefore posts to
  `/api/assets/sign` instead of `/api/local-preview-assets/sign`. The latter is
  the dev-only route that serves the mounted source images
  (`src/app/api/local-preview-assets/sign/route.ts:12-33`); the paid route is
  not authorized by the local-preview-only access state. Result: local preview
  can load the question image but answer loading fails with the card's
  `The answer could not load. Try again.` state. Add a UI-path regression test
  and pass the local-preview mode into the card before calling this a local
  candidate pass. This was the uncorrected state recorded by the original
  review; the repair and its self-check evidence are recorded below.

## Candidate data and provenance

- Source validator schema was inspected before rerunning the failed custom
  probe. Canonical exam URLs are `data/source-manifest.json` fields
  `question_pdf_url` and `markscheme_pdf_url`; `source_url` and `final_url` are
  fields of the corresponding `data/acquisition-manifest.json` `question` /
  `markscheme` entries. Final-row `source.question_pdf` and
  `source.markscheme_pdf` contain only the sealed `path` and `sha256`.
- The first custom probe stopped with `KeyError: source_url` because it looked
  for that field in the final-row PDF object. That was a probe error, not a
  source mutation and not a validator pass. The repository validator's join
  was then followed exactly (`scripts/validate_classification_stage.py:103-145,
  188-220, 400-428`): source manifest canonical URL -> acquisition
  `source_url`/`final_url`, path, and hash -> final-row source PDF fields.
- Rerun with direct required-field indexing (no `.get` empty defaults, no
  guessed URLs): **184/184 rows passed** canonical question/markscheme URL,
  path, SHA, and on-disk hash joins. Image counting, which the failed probe
  never reached, also passed: **475 question images** and **869 markscheme
  images**, all paths unique and tied to their source paper IDs.
- Source-side validators already run separately from the failed custom probe:
  `verify_foundation.py` passed with 132 documents / 66 pairs and SHA
  verification; focused source tests passed **37**; the mutation-heavy source
  gate passed **80**. These are not being counted as part of the custom
  184-row rerun.
- Runtime seals and counts passed: **HL 111 questions / 42 papers; SL 89 /
  32**. Every row has `id == canonicalId`, the expected bank slug, HTTPS
  question and markscheme URLs, the final-classification seal, semantic-QA
  approval, and safe WebP asset paths.

## Asset and index checks

- Upload manifests passed exact counts: **HL 965** assets and **SL 639**.
  Within each manifest, object keys and source paths are unique; question /
  markscheme image counts are HL **366 / 599** and SL **191 / 448**.
- Object keys use only the exact bank namespaces
  `ib-economics-hl/` and `ib-economics-sl/`; they end in `.webp`, contain no
  `/raw/` or PDF suffix, and contain no absolute/private filesystem path.
  Referenced question IDs cover the complete corresponding runtime bank.
- The **16 shared HL/SL question IDs** retain the same source paths while
  receiving distinct bank object-key namespaces. This is shared-source dedupe,
  not cross-bank object-key collision.
- Public metadata produced by `createPublicBankIndex` contains no rich text,
  solution, source URL, transcript, classification provenance, or image-path
  fields. Candidate private indexes exist under `src/data/private-index/`; no
  Economics index was added under `public/bank-index/`. Existing public index
  bytes for all 12 pre-existing banks matched their recorded SHA-256 values.

## Access, entitlement, quota, and release safety

- Economics is absent from the default 12-bank catalog. Production requires
  both exact environment flags in `src/lib/banks.ts:272-275`; local preview
  additionally requires development mode and its explicit flag
  (`:277-279`). The private index route repeats the double production gate
  before authentication or data access (`src/app/api/private-bank-index/[bank]/route.ts:14-35`).
  Header/forwarded-host spoofing is not used as a gate; the local route test
  covers spoofed forwarded headers.
- Entitlement normalization allowlists product IDs and statuses, validates
  dates, and drops unknown/malformed rows and invalid custom bundles
  (`src/lib/entitlements.ts:44-77`). Access accepts only current `active` or
  `trialing` entitlements; expired, revoked, future, malformed, or unknown
  rows fail closed (`src/lib/access.ts:126-148`).
- PDF tests passed locked-bank denial before signing/quota consumption and
  exhausted-quota `429` behavior without returning assets; entitled export
  consumed exact asset/question counts (`src/app/api/pdf/sign/ib-economics-production.test.ts:44-67`).
- The SQL preparation migration registers Economics IDs with `active=false`
  and contains no `price_...` identifiers (`supabase/migrations/20260911010000_add_ib_economics_candidate.sql:29-33`).
  No migration or database command was run, so remote migration/application
  state is intentionally outside this local-only review. Repository evidence
  supports an unapplied preparation candidate, not a claim about an external
  database.
- Rights remain `unknown_publication_blocking`. User-attested rights are
  treated as a non-blocking release-input condition per scope; no independent
  rights clearance was inferred.

## Verification run

- App focused Vitest set: **12 files, 56 tests passed**.
- `npm run lint`: **passed**.
- `npx tsc --noEmit`: **passed**.
- Source focused validators: **37 passed**.
- Source mutation-heavy gate: **80 passed**.
- `./.venv/bin/python scripts/verify_foundation.py`: passed; 132 documents,
  66 pairs, SHA verification true.
- Full source `pytest -q` did **not** produce a pass result: the long-running
  process was terminated with exit `-15` after partial progress (output had
  reached the 36% progress marker). It is recorded as incomplete, not passed.

### Required before approval

Run a fresh independent re-review of the corrected tree and close the
local-preview blocker only if that review independently verifies the repair.
Production still requires the separately documented external storage readback,
rights, and release gates; this review does not approve production enablement.

## Repair status — pending independent closure

The minimal repair now passes `localPreview` from `QuestionExplorer` into each
`QuestionCard`, then explicitly passes it to the answer-loading signer. The
paid path remains the default when the prop is false; no paid auth, signing, or
quota code was weakened.

Self-check evidence on the current dirty tree:

- The new `QuestionExplorer` regression first reproduced the paid signer call
  and answer error, then passed after the prop plumbing change. It asserts the
  question image and all three official mark-scheme pages.
- `QuestionExplorer` plus signed-asset tests passed **31/31**; local-preview
  route, gate, containment, and HL/SL integration tests passed **18/18**.
- The complete Vitest suite passed **404/404 tests in 85 files**; `npx tsc
  --noEmit` and `npm run lint` also passed.
- Native arm64 Node was **v22.22.3** on `arm64 darwin`; the dev server health
  check returned HTTP 200 and the local-preview index returned HTTP 200.
- Real Ego browser checks in one reused task space loaded the HL and SL 2021
  question fixtures, clicked **Show answer**, received HTTP 200 from
  `/api/local-preview-assets/sign` (not `/api/assets/sign`), and decoded the
  question plus all three answer pages for each level.
- The real SL PDF button produced and saved a 30-page PDF through the normal UI
  path without a fetch shim; PyMuPDF opened it and read the first-page text.
- Disabled-gate and forwarded-header spoof cases remain covered by the route
  tests. A fresh independent review must still re-read the corrected tree and
  decide closure; this self-check does not change the BLOCKED decision.
