# Chemistry 0620 whole-paper workspace — local QA

## Scope

Branch: `feat/free-paper-preview`; isolated worktree `.worktrees/free-paper-preview`.
Review URL: `http://127.0.0.1:3107/past-papers/igcse-chemistry-0620`.
Development-only opt-in, loopback server. No commit, push, storage upload, sitemap publication or deployment.
Original-PDF redistribution rights remain unresolved; this is not a public archive release.

## Coverage and source evidence

- 314 unique paired paper IDs, 628 original PDFs; all paired cover identities and hashes reconciled with zero identity failures.
- 290 complete self-marking/revision reports. 24 papers remain PDF/timer-only, explicitly labelled, with no self-marking promise or inputs.
- Holds: 22 MCQ runtime papers missing 202 questions, and practical papers `0620-2019-w-53` / `0620-2020-w-53` lacking six question classifications. Exact-ID extension classification/review/queue searches are recorded in the private receipt; missing topics were not guessed.
- 63 archive-only source-mark corrections across 28 papers; production bank data unchanged.
- Original-derived durations: 106 papers at 45 minutes, 53 at 60 minutes, 155 at 75 minutes.
- Ignored evidence: `private/chemistry-paper-archive/archive.json`, `receipt.json`, and source-extraction checkpoints. Client projection excludes source paths, hashes, protected text and answer assets.

## Automated execution

- Full Vitest run: **1,843 passed, 0 failed, 1 skipped**. Machine-readable result: `/Users/sakshamgoel/.hermes/cache/scratch/ppp-whole-bank-full-tests.json`.
- The initial direct Vitest run lacked generated public indexes and used architecture-incompatible Python 3.8. Ran the existing `npm run generate:bank-index`, then selected the native Hermes Python 3.14.7 on PATH and reran the entire suite successfully. No app changes were made to mask those environment failures.
- Full TypeScript passed with the repository 8 GB heap command.
- Full ESLint: zero errors, one existing unused-variable warning in untouched `PricingContent.tsx` (`newSubscriptionNote`). Changed-file lint clean.
- Final optimized webpack production build passed, including TypeScript, static generation and build tracing. `scripts/verify-private-sourcemaps.mjs` passed.
- `git diff --check` passed.

## Real-browser checks (Ego)

- All 314 unique paper links made reachable through real Load more interactions; footer read `Showing 314 of 314 papers`.
- Combined year/session/paper/variant filtering isolated the expected exact paper. Shareable URLs restored selected filters.
- Real theory, MCQ, practical and report-held papers rendered. Correct matching MS switched and loaded.
- MCQ `0620-2026-s-11`: 40 score inputs; one entered zero gave a partial `0 / 1` report with 39 unmarked, not a full paper score, and States of matter handoff.
- Practical `0620-2026-s-62`: real 60-minute timer, pause, QP/MS, four maxima (8,19,7,6), partial `0 / 8` report, device persistence and practical-topic handoff.
- Live practice destination selected `Practical skills and investigations` after hydration. Named test attempts cleared through the real confirmation UI.
- Downloaded `0620-2026-s-62` mark scheme: 1,157,827 bytes, SHA-256 `e8dceac997aed7e893ffd3f5a422c0d928dc2a63be830b181cce7aa6062a23aa`, matched source manifest.
- Held practical `0620-2020-w-53`: QP/MS/timer available; no marking inputs and no misleading Mark this paper link.
- Desktop and mobile/dark layouts inspected; 390 px viewport had 390 px document width, no horizontal page overflow.
- Review URL opened and read back in Hermes desktop preview with correct 314/290 counts.
- Browser verification is representative, not 314 individual manual attempts. Source/hash/maxima reconciliation is bank-wide.

## Production denial

Started the final production build locally on port 3110 with `LOCAL_PAPER_PREVIEW=true` deliberately set. Archive directory and paper page hit Next's `notFound` boundary and exposed no archive payload. These streamed responses have an outer HTTP 200 and embedded `NEXT_HTTP_ERROR_FALLBACK;404`; do not describe them as HTTP 404. Supported/held PDF endpoints both returned actual HTTP 404 with no PDF bytes. Test production server stopped afterward; review server remains on 3107.

## Regenerate local metadata

```sh
PATH=/Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin:$PATH \
npx tsx scripts/build-chemistry-paper-archive.mts
```

The remaining 24 reports require real source-aligned question classification work. Public release separately requires original-PDF distribution rights and permitted storage/delivery, owner approval and normal release gates.
