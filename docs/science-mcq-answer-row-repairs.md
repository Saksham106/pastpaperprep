# Source-owned IGCSE science MCQ answer rows

This release projects only reviewed Chemistry 0620, Physics 0625, and Co-ordinated Sciences 0654 MCQ answer paths. It does not rewrite source runtimes, classifications, question images, original storage seals/receipts, the Biology 99-row repair, or the worksheet exporter.

## Exact scope

| Bank | Current MCQ records | Confirmed overinclusive crops repaired | Held unchanged |
|---|---:|---:|---:|
| Chemistry 0620 | 4,038 | 3,838 | 200 |
| Physics 0625 | 4,239 | 4,200 | 39 |
| Co-ordinated Sciences 0654 | 3,279 | 3,240 | 39 |

Every repaired old crop includes independently keyed answers belonging to other question numbers. New clips retain the owned question number, A–D answer and printed mark in the actual source table row, with no neighboring owned answer. Active runtime refs are joined to exact storage object keys, source paths, SHA, byte size and raster dimensions, then to pinned source PDF hashes and recorded bounds. Unsupported layouts/source ownership stay held; no answer is invented.

The source audit scripts/reports and before/after evidence are durable under `research/crop-repair-20261002/next-family/` outside this repository. All 11,278 candidates were rebuilt twice byte-identically and separately checked for file SHA agreement. Representative source rows and existing full-table crops in each bank were independently reviewed. This is not a written-answer, blank-QP, all-bank or every-crop visual review.

## Immutable upload

Byte-identical row WebPs share a content-addressed object within the bank's existing storage namespace; question identities and per-replacement source provenance remain separate. This reduces 11,278 logical repairs to 3,810 immutable objects (2,851,076 bytes), rather than uploading duplicate question-named copies. Create-only PUT and full remote GET SHA/size/content-type verification succeeded for every object. The separate receipt seals the unchanged manifest bytes. The temporary bucket-scoped write token was revoked and its private credential file removed; original production read tokens remain active.

## Application contract

The existing reviewed-mark-scheme helper enforces exact old paths and hash-shaped replacement paths. It is reached through canonical production normalization used by viewer and PDF authorization. Unknown/held IDs and other banks keep their old paths. Existing free-preview access and paid entitlements are unchanged. The native public-index generator updates answer-image counts where multiple full-table pages become one owned row; classification and all other public metadata remain unchanged. The Chemistry classification test reconstructs the prior immutable public index by undoing only answer-image counts and verifies its original hash, rather than weakening historical seals.

Next's actual production build produced 38 browser JavaScript chunks; none contains any of the three repair-audit namespace markers. The repair map is used server-side, not added to the browser bundle.

## Gates and rollback

44 focused tests, TypeScript, scoped ESLint, diff check and production build passed. Full candidate suite: 1,217/1,219 pass; pristine pinned parent: 1,209/1,211 pass. Exactly the same two pre-existing mobile toolbar style tests fail on both; there are zero introduced failures. Historical source runtime digests, whole-bank IDs and unrelated metadata are asserted by the new actual-cohort tests.

Rollback reverts this science projection/helper branch and its derived public-index counts. Original objects and source runtimes remain intact. Publication and exact-merge production browser/PDF readback are separate gates, not established by these local checks.
