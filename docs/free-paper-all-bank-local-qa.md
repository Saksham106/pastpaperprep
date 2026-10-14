# Free whole-paper workspace — all-bank local QA

## Release boundary

All 19 canonical banks have validated, compact whole-paper manifests and use one shared directory, PDF reader, timer, self-marking and revision-report implementation. This is a **local implementation / PR candidate**, not a production publication. Original PDFs, source paths, extracted text, review images and private receipts remain outside Git. No original-PDF storage upload, production activation or merge is included.

## Exact generated coverage

- 2,463 paired-paper memberships; 4,926 document memberships and 4,910 distinct local PDF files.
- 2,043 complete self-marking/revision reports; 420 explicitly held reports. Held papers remain readable with a timer only where its duration is verified.
- Every promoted original passed a full byte-length, SHA-256 and exact `%PDF-` header readback.
- Two complete generated public-manifest rebuilds were byte-identical.
- Seven candidate pairs remain withheld: three IB Biology schemes with unsupported binary prefixes, three 2020 November legacy HL option papers needing further identity review, and one 0654 paper with an unresolved cover-label anomaly.
- The private source inventory separately records 11 unpaired source entries and eight runtime-paper entries without candidate pairs. These are different coverage axes, not additional report-hold counts.
- Independent bounded exception review checked 22 exact QP/MS pairs with 48 source-hash-bound rendered images. This is not an exhaustive semantic or answer review. Source-bound adjudications preserve literal cover/running-code anomalies privately; they do not invent timings, maxima or classifications.

| Bank | Paired papers | Reports | Report held | Candidate pair withheld |
|---|---:|---:|---:|---:|
| `ib-ai-hl` | 48 | 47 | 1 | 0 |
| `ib-ai-sl` | 38 | 38 | 0 | 0 |
| `ib-biology-hl` | 83 | 32 | 51 | 1 |
| `ib-biology-sl` | 85 | 33 | 52 | 2 |
| `ib-chemistry-hl` | 84 | 62 | 22 | 0 |
| `ib-chemistry-sl` | 84 | 63 | 21 | 0 |
| `ib-economics-hl` | 42 | 5 | 37 | 0 |
| `ib-economics-sl` | 32 | 0 | 32 | 0 |
| `ib-hl` | 98 | 98 | 0 | 3 |
| `ib-physics-hl` | 84 | 63 | 21 | 0 |
| `ib-physics-sl` | 84 | 64 | 20 | 0 |
| `ib-sl` | 58 | 58 | 0 | 0 |
| `igcse` | 216 | 179 | 37 | 0 |
| `igcse-additional` | 145 | 122 | 23 | 0 |
| `igcse-biology-0610` | 316 | 294 | 22 | 0 |
| `igcse-chemistry-0620` | 314 | 290 | 24 | 0 |
| `igcse-coordinated-sciences-0654` | 237 | 236 | 1 | 1 |
| `igcse-economics-0455` | 98 | 43 | 55 | 0 |
| `igcse-physics-0625` | 317 | 316 | 1 | 0 |

## Actual browser verification

Ego local anonymous-session QA enumerated all 19 directories through load-more and reconciled all 2,463 unique per-bank paper links with the generated manifests. The hub counts matched the generated totals. This proves directory reachability, not that every PDF was visually inspected.

Representative flow checks:
- IB AI HL May 2025 Paper 1: original QP and scheme rendered; continuous page navigation, Focus, timer start/pause and browser download worked. Download SHA matched the pinned original.
- A five-of-six mark on one question produced a partial report with fourteen unmarked questions, not a fabricated full-paper score. The Geometry and trigonometry link targeted the correct bank/free preview. The saved mark survived reload; QA marks were explicitly cleared.
- Additional Mathematics 2026 Paper 11: visually readable QP/scheme despite unusable native cover text; no scoring promise or invented duration/maximum. Mobile Chromium at 390 px had no document overflow; dark-theme and held-state checks were bounded browser checks, not real iOS/PWA assurance.
- Chemistry 0620 winter 2023 Paper 42 rendered through the shared bank route, with 16 QP pages and correct metadata. Retired Chemistry-specific pages cannot shadow the shared manifests or production gate.

The browser pass caught a real Webpack PDF.js export-runtime collision. The reader now loads the unchanged, self-hosted upstream ESM API with `webpackIgnore`, alongside its matching worker. A byte-parity regression binds both public JS assets to the locked installed package. Both are library code, not original exam assets.

## Rebuild and verification

With the private source inventory and reviewed image evidence present:

```sh
npx tsx scripts/build-whole-paper-archives.mts \
  --inventory <private-inventory.json> \
  --identity-review private/paper-archives/identity-review.json
```

The identity-review input is optional, private and operator-controlled. It requires exact bank/paper/QP/MS hashes and both hash-verified source images; stale sources, changed images and duplicate adjudications fail closed. It only adjudicates document identity, never scoring or topic labels.

Required final gates: full lint, TypeScript, full Vitest report, deterministic generation, `git diff --check`, production build, source/privacy tracing and production-denial readback. Current machine-readable results and reviewed SHA are reported in the PR; private audit material is deliberately not committed.

## Known feature limits

Optional-choice papers and incomplete source/topic/maxima evidence stay report-held. IB Economics SL currently has readable timed papers but no complete automated self-marking report manifest. Blank scores mean unmarked; topic recommendations are question-level review priorities, not exact topic accuracy, AI grading or predicted grades. Existing paid signing, quotas, taxonomy runtimes, billing and sitemaps are unchanged.
