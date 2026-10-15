# IB Physics May 2026: official papers

October 2026. Branch `feat/ib-physics-may-2026`. **Nothing is uploaded yet**: the crops and PDFs below need the owner's approval first.

## What was added

| | HL | SL |
| --- | ---: | ---: |
| Papers (TZ1 to TZ3, Papers 1A, 1B, 2; each with its official mark scheme) | 9 | 9 |
| Questions | 153 | 99 |
| Multiple-choice letters (Paper 1A) | 120 | 75 |
| Bank after | 2,028 questions, 93 papers | 1,413 questions, 93 papers |

There is no Paper 3 in the 2025 syllabus. No paper was excluded: all 18 question papers pair with an official mark scheme.

## Sources and checks

- **Source:** `papers.xtremepape.rs` mirror of the IB release (`Experimental%20sciences` folder). SHA-256, bytes and pages are pinned in the source lane's `data/may-2026/source-manifest.json`; no PDF is committed.
- **Identity:** every PDF's subject, level, paper, time zone and May 2026 session were checked against its own text and metadata (`identity-report.json`).
- **Watermarks:** `scripts/scan-source-watermarks.py` flagged 0 of 36 PDFs (`data/may-2026/watermark-scan.txt` in the source lane).
- **Crops:** 252 questions, 352 question crops and 301 mark-scheme crops (653 in all, 23.8 MB). The 96 contact sheets (every question's QP beside its MS) were each viewed, and the labelling passes opened every crop; the segmentation audit (uncovered ink, row-level MS ownership, part labels against MS rows, marks against printed totals and the printed paper maxima, MCQ key letters) reports 0 findings. Review fixes, all through overrides: furniture-only "do not write on this page" pages dropped from 17 question crops, and 8 mark-scheme crops trimmed of the next question's table-header strip.
- **MCQ keys:** 195 letters (HL 3 x 40, SL 3 x 25) read two independent ways (PDF text geometry, and a letter-by-letter visual read of the rendered key page) with identical results; the 41 HL/SL twin questions carry the same key; every letter equals the row's own mark-scheme transcript. Imported with `scripts/import-reviewed-mcq-answer-letters.mts`; source file `docs/ib-physics-may-2026/mcq-answer-letters-2026.json`, receipt in `docs/reviewed-mcq-answer-letters.md`.

## Tagging

- **Drex** (`drex-v2.0`, text only; pinned and asserted in the request and the response) was used for triage only: 252 calls, 450,261 tokens in, 225,891 out. An earlier run on `drex-v1.1` (answered by `drex-v1.5`, 232 of 252 rows) was superseded and is kept in the source lane beside the record. Its top-1 subtopic equals the final primary for 209 of 252 rows (top-3: 239).
- **Primary pass** from the crop and official mark scheme (image-checked transcriptions); **blind pass** by separate reviewers from sealed evidence without the primary labels or Drex scores.
- **Agreement:** primary subtopic 236 of 252, primary code 241, full labels 201. All 51 differing rows were adjudicated from the two immutable files with the mark scheme (28 blind, 16 primary, 7 neither). 8 final rows are low confidence (multi-topic 20-mark questions with no dominant block).
- Labels use the repo's controlled Physics taxonomy (2025 syllabus codes). `src/lib/taxonomy.ts` is untouched. The reviewed labels are in `docs/audits/ib-physics-may-2026-review.json`.

## App changes

- `scripts/add-ib-physics-2026.mjs` appends the rows to `src/data/raw/ib-physics-{hl,sl}.json` (mirrored byte for byte in `production/`). It reads the earlier rows from the pinned base commit and refuses to run if any row, paper or header field would change; `--check` proves a rebuild is byte-identical. The append is recorded in `may2026Release`.
- Catalog: HL 2,028 questions and 93 papers, SL 1,413 and 93, years 2016-2026. Bank index, asset manifest and expected asset counts follow.
- Full past papers: `docs/ib-physics-may-2026/archive-inventory.json` (rebuilt with `scripts/build-ib-physics-2026-archive-inventory.mjs`) feeds `scripts/build-whole-paper-archives.mts`. Each bank gains 9 papers; all 84 earlier entries are byte-identical. 16 of the 18 new papers are accepted as usual. The TZ3 HL and SL Paper 1A are reports only ("Printed question maxima do not reconcile"): in those two mark-scheme PDFs one key letter (HL Q39, SL Q24, the nuclear power plant question) is placed last in the text stream although it is printed in its row, so the builder's text-order key check misses it. The key itself is read correctly by geometry and by eye. Fixing the extractor would touch every bank, so it is left for a separate change.
- The 2016-2019 science candidate seal keeps verifying the sealed runtime: `sealedRuntimeBytes()` in `scripts/ib-science-receipt-contract.mjs` removes the Physics 2026 append and must give the sealed hashes back.

## Source defect

`2026-may-tz1-hl-p2-q4(c)` refers to a graph of maximum kinetic energy against frequency for two metals that the official question paper PDF does not print (checked on the original pages 9 to 11; the mark scheme answers it). The row is served as printed; the owner may want to hold it back.

## Upload plans (not executed)

| Bucket | Plan | Objects | Bytes |
| --- | --- | ---: | ---: |
| `pastpaperprep-assets` | `docs/ib-physics-may-2026/r2-upload-plan-assets.json` | 653 (HL 395, SL 258) | 23,799,354 |
| `pastpaperprep-free` | `docs/ib-physics-may-2026/r2-upload-plan-free-papers.json` | 36 PDFs | 32,540,941 |

- Both plans list key, SHA-256 and source path; every key is new. `scripts/plan-ib-physics-2026-uploads.mts --check` re-hashes the sources and proves the crop keys equal the app's own 2026 asset paths.
- **Crops:** create-only `wrangler r2 object put --remote`, `image/webp`, `private, max-age=31536000, immutable`, read back by SHA-256 and size.
- **PDFs:** `scripts/publish-added-free-papers.mts upload` then `verify`; `verify` is what rewrites `src/data/paper-archive-readback.json`.
- IB Physics has no 2026 free-preview year, so no Supabase preview objects are needed.

## Owner decisions

1. Approve the two uploads above.
2. After upload, run `verify` and commit the refreshed `src/data/paper-archive-readback.json`.
3. Decide whether to hold back `2026-may-tz1-hl-p2-q4` (missing graph in the source).
4. No worked explanations exist for the 2026 ids.
5. This branch edits lines that the Biology (and other) May 2026 branches also edit (`catalog.ts`, `asset-retention.ts`, `bank-index-manifest.ts`, `ib-science-receipt-contract.mjs`, `reviewed-mcq-answer-letters.json`, `page.test.tsx`, `banks.test.ts`). Expect conflicts when merging more than one; the bank index and MCQ overlay are regenerated, not hand-merged.
