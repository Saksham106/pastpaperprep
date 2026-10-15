# IB Chemistry May 2026: official papers

October 2026. Branch `feat/ib-chemistry-may-2026`. **Storage uploads are done (owner-approved, 2026-10-15; see Storage).**

## What was added

| | HL | SL |
| --- | ---: | ---: |
| Papers (TZ1 to TZ3, Papers 1A, 1B, 2; each with its official mark scheme) | 9 | 9 |
| Questions | 144 | 109 |
| Multiple-choice letters (Paper 1A) | 120 | 90 |
| Bank after | 2,016 questions, 93 papers | 1,521 questions, 93 papers |

There is no Paper 3 in the 2025 syllabus (174 probes for TZ0/TZ4, Paper 3 and combined files all returned 404). No paper was excluded: all 18 question papers pair with an official mark scheme.

## Sources and checks

- **Source:** `papers.xtremepape.rs` mirror of the IB release (`Experimental%20sciences` folder). SHA-256, bytes and pages are pinned in the source lane's append-only `data/acquisition-2026/receipt.jsonl`; no PDF is committed.
- **Identity:** every PDF's subject, level, paper, time zone and May 2026 session were checked against its own text. The two TZ1 Paper 1A mark schemes (HL, SL) print "Paper 1" on their cover (the exam codes 2226-4216M and 2226-4219M match the Paper 1A question papers), so each carries a hash-bound identity review case (`docs/ib-chemistry-may-2026/identity-review-case.json`, evidence in `research/ib-may-2026-chem-identity-evidence/`).
- **Watermarks:** `scripts/scan-source-watermarks.py` flagged 0 of 36 PDFs: no xtremepape.rs stamp or vector footer.
- **Crops:** 253 questions, 360 question crops and 337 mark-scheme crops (697 in all, 22.7 MB). Every crop and its mark-scheme crop was viewed by a reviewer. Blank "Please do not write on this page" pages are dropped from question crops, the IB disclaimer footer is cut, and mark-scheme crops split at the detected table row border on shared pages. 236 crop-verified transcript corrections (stacked fractions, exponents, charges, bond symbols, the standard-state sign, "6½ O2") are applied through the source lane's `text-overrides.json`. `validate_2026_lane.py`: 0 failures in 2,594 checks.
- **MCQ keys:** 210 letters (HL 3 x 40, SL 3 x 30) read three independent ways (the mark-scheme text layer, a blind visual read of the key pages, and a reviewer reading the served answer crop) with identical results; the 64 HL/SL twin questions carry the same key. Imported with `scripts/import-reviewed-mcq-answer-letters.mts`; source file `docs/ib-chemistry-may-2026/mcq-answer-letters-2026.json`, receipt in `docs/reviewed-mcq-answer-letters.md`.

## Tagging

- **Drex** was used for triage only: 253 calls requested as `drex-v1.1` (answered by `drex-v1.5`; 798,705 tokens in, 264,548 out), then the 58 adjudication rows re-asked on the pinned `drex-v2.0` (195,029 in, 60,628 out). The smoke test asserted that the transmitted state contained the question text.
- **Primary pass** from the question text, official mark scheme and crops; **blind pass** by separate reviewers from sealed evidence without the primary labels or Drex scores.
- **Agreement:** primary subtopic 233 of 253, secondaries 230, official codes 206, full labels 195. All 58 differing or low-confidence rows were adjudicated from the two immutable files (203 rows keep the primary label, 39 merged, 11 take the blind label); the 67 HL/SL questions with identical text carry identical labels.
- Labels use the repo's controlled taxonomy (2025 syllabus areas, ten topics, existing subtopic names). `src/lib/taxonomy.ts` is untouched.
- The reviewed labels are in `docs/audits/ib-chemistry-may-2026-review.json`.

## App changes

- `scripts/add-ib-chemistry-2026.mjs` appends the rows to `src/data/raw/ib-chemistry-{hl,sl}.json` (mirrored byte for byte in `production/`). It reads the earlier rows from the pinned base commit and refuses to run if any row, paper or header field would change; `--check` proves a rebuild is byte-identical. The append is recorded in `may2026Release`.
- Catalog: HL 2,016 questions and 93 papers, SL 1,521 and 93, years 2016-2026.
- Full past papers: `docs/ib-chemistry-may-2026/archive-inventory.json` (rebuilt with `scripts/build-ib-chemistry-2026-archive-inventory.mjs`) feeds `scripts/build-whole-paper-archives.mts`. Each bank gains 9 papers; all 84 earlier entries per bank are byte-identical. Every 2026 paper is self-markable (no optional questions).
- The 2016-2019 science candidate seal keeps verifying the sealed runtime: `sealedRuntimeBytes()` in `scripts/ib-science-receipt-contract.mjs` removes the 2026 append and must give the sealed hashes back.
- `src/data/private-index/ib-chemistry-*.json` (a 2016-2019 extension-era artifact no code reads) is not regenerated.

## Storage (done) and plans

| Bucket | Plan | Objects | Bytes |
| --- | --- | ---: | ---: |
| `pastpaperprep-assets` | `docs/ib-chemistry-may-2026/r2-upload-plan-assets.json` | 697 (HL 409, SL 288) | 22,740,878 |
| `pastpaperprep-free` | `docs/ib-chemistry-may-2026/r2-upload-plan-free-papers.json` | 36 PDFs | 25,433,575 |

- Both plans list key, SHA-256 and source path; every key is new. `scripts/plan-ib-chemistry-2026-uploads.mts --check` re-hashes the sources and proves the crop keys equal the app's own 2026 asset paths.
- **Crops:** create-only `wrangler r2 object put --remote`, `image/webp`, `private, max-age=31536000, immutable`, read back by SHA-256 and size.
- **PDFs:** `scripts/publish-added-free-papers.mts upload` then `verify`; `verify` is what rewrites `src/data/paper-archive-readback.json`.
- IB Chemistry has no 2026 free-preview year, so no Supabase preview objects are needed.

- **Result:** 697/697 crops verified by SHA-256 and size and equal to the plan (none pre-existing); log `docs/ib-chemistry-may-2026/r2-upload-log-assets.jsonl`. The 36 PDFs are public; `verify` re-read all 5,020 approved PDFs and rewrote `src/data/paper-archive-readback.json`. (Two earlier verify runs each hit one transient curl exit 56 on a different object; the third run was clean.)

## Owner notes

1. No worked explanations exist for the 2026 ids.
