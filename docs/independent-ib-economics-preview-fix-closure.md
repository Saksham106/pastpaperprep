# Independent IB Economics preview-fix closure

**Captured:** 2026-09-10 21:24 EDT
**Verdict: PASS LOCAL CANDIDATE ONLY. Production remains blocked.**

This is a fresh read-only review of the corrected dirty tree. The builder-authored self-report and the previous independent-review document were treated as evidence to inspect, not as acceptance. No repository code, candidate data, SQL, upload, deployment, commit, or external system was changed by this review.

## Corrected path verified

- `QuestionExplorer` carries `localPreview` into each `QuestionCard`.
- Question-image hydration, answer hydration, and PDF asset hydration pass the explicit mode through `fetchSignedAssets` / `fetchPdfAssets`.
- Local mode requests `/api/local-preview-assets/sign` and `/api/local-preview-assets/pdf`.
- The paid defaults remain `/api/assets/sign` and `/api/pdf/sign`; paid-signer validation rejects local-preview URLs.
- The preview gate is exact: `NODE_ENV === "development"` plus `PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true"`.
- The gate denies unset, empty, `test`, `staging`, `preview`, and `production` values even when the flag is true.
- The local asset reader resolves the mounted root, asset root, and candidate with `realpath` before invoking `readFile`/the reader. The outside-target symlink regression proves the reader is not called.
- Only derived `.webp` assets under the mounted Economics asset root are accepted. Traversal, raw PDF, and encoded external-preview targets are denied.

## Focused verification

Native runtime:

```text
Node v22.22.3
arm64 / darwin
/Users/sakshamgoel/.hermes/node/bin/node
```

Focused command:

```text
./node_modules/.bin/vitest run \
  src/components/QuestionExplorer.test.tsx \
  src/lib/signed-assets.test.ts \
  src/lib/local-preview.test.ts \
  src/lib/local-preview-asset-security.test.ts \
  src/lib/local-preview-route.test.ts \
  src/lib/ib-economics-local-preview.test.ts \
  src/lib/ib-economics-production-integration.test.ts \
  src/app/api/pdf/sign/ib-economics-production.test.ts \
  src/lib/pdf-export.test.ts
```

Result: **9 files passed, 65 tests passed**. `./node_modules/.bin/tsc --noEmit` passed. `npm run lint` passed.

The focused tests cover the disabled gate matrix, header spoofing, pre-read symlink containment, paid/local signer separation, local PDF asset authorization, HL/SL runtime scope, entitlement denial, and explicit PDF-selection behavior.

## Real Ego browser checks

One reused Ego task space (`spaceId=6`) was used. No fetch shim, cache override, or monkeypatch was used. The temporary Next server used native arm64 Node and was finally bound to `127.0.0.1:3100`:

```text
NODE_ENV=development
PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW=true
PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice
.../node ./node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 -p 3100
```

The browser used `http://localhost:3100`, which resolves to that loopback listener. A first `127.0.0.1` browser page stayed SSR-only under the browser's local-network policy; repeating the checks in the same task space on `localhost` hydrated normally. That workaround did not alter application requests or responses.

### HL

- Route: `/banks/ib-economics-hl`.
- Real UI **Show answer** click on `2025 May / Paper 1 / Question 1 / TZ1`.
- Question image decoded: `complete=true`, `1191x182`.
- All three official mark-scheme pages decoded after scrolling them into view: `1191x1455`, `1191x1525`, `1191x1525`.
- Browser resource requests included `/api/local-preview-assets/sign` only; no `/api/assets/sign` request occurred.

### SL

- Route: `/banks/ib-economics-sl`.
- Real UI **Show answer** click on `2025 May / Paper 1 / Question 1 / TZ1`.
- Question image decoded: `complete=true`, `1191x156`.
- All three official mark-scheme pages decoded after scrolling them into view: `1191x1455`, `1191x1525`, `1191x1525`.
- Browser resource requests included `/api/local-preview-assets/sign` only; no `/api/assets/sign` request occurred.

## Normal UI PDF verification

The PDF checks used the normal UI selection, dialog, **Build PDF** button, browser download event, and downloaded bytes. The selected IDs were captured from the actual `/api/local-preview-assets/pdf` POST body; page totals were calculated from the runtime's question and mark-scheme image arrays and then checked with PyMuPDF.

The earlier four-page artifacts represented a different single-question selection: one question image plus three answer images. The 30-page result below is not inferred from that artifact and does not assume four selected questions.

### HL 30-page selection

Selected IDs, in request order:

1. `2022-november-none-hl-p3-q02` — 11 question pages + 6 answer pages = **17**.
2. `2021-may-none-hl-p3-q01` — 7 question pages + 6 answer pages = **13**.

The browser POST contained exactly those two IDs with `content: "both"`. Download failure was `null`. PyMuPDF verified **30 pages**, nonempty image objects on every page, page 17 as the first selection's final answer page, page 18 as the second selection's first question page, and page 30 as the final answer page.

### SL 30-page selection

Selected IDs, in request order:

1. `2025-may-tz1-hlsl-p2-q01` — 4 question pages + 13 answer pages = **17**.
2. `2022-may-none-sl-p2-q02` — 4 question pages + 9 answer pages = **13**.

The browser POST contained exactly those two IDs with `content: "both"`. Download failure was `null`. PyMuPDF verified **30 pages**, nonempty image objects on every page, the same page-17/page-18 selection boundary, and the final answer on page 30.

Private machine-readable evidence and both downloaded PDFs are in:

`/Users/sakshamgoel/privateQAevidence/independent-ib-economics-preview-fix-closure/`

## Loopback HTTP and denial checks

With the explicit development flag enabled, the temporary server returned:

- HL local index: `200`.
- SL local index: `200`.
- Valid mounted asset with spoofed `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`: `200`; spoofed headers did not change the server-side decision.
- Traversal asset: `404`.
- Raw PDF path: `404`.
- Encoded `https://evil.example/...` preview target: `404`.

No second persistent server was claimed. The temporary review server was stopped after evidence capture.

## Candidate safety boundary

- Default production catalog remains **12 banks**; Economics is absent.
- Production enablement flags were not set for the review server. No production route or entitlement was enabled.
- Candidate SQL remains unapplied. Its three Economics product rows are explicitly `active=false`; it contains no `price_` identifiers. Candidate migration SHA-256: `54f901c9b8b0cabcccc98cf8cd552a0311f6a69c13fa372420e164c4bff10924`.
- Rights remain `unknown_publication_blocking`.
- No database apply, upload, deploy, commit, push, or publication authorization occurred.

## Files

Created by this review:

- `docs/independent-ib-economics-preview-fix-closure.md`

Private QA evidence, outside the repository:

- `privateQAevidence/independent-ib-economics-preview-fix-closure/evidence.json`
- `privateQAevidence/independent-ib-economics-preview-fix-closure/ib-economics-hl-selected-30-page.pdf`
- `privateQAevidence/independent-ib-economics-preview-fix-closure/ib-economics-sl-selected-30-page.pdf`

The repository's other dirty files were pre-existing candidate work and were not modified by this review. Local preview is accepted for development-only candidate use; production remains blocked pending the separate rights, storage, product, and release gates.
