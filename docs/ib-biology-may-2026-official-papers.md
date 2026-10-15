# IB Biology May 2026: official papers

October 2026. Branch `feat/ib-biology-may-2026`. **Nothing is uploaded yet**: the crops and PDFs below need the owner's approval first.

## What was added

| | HL | SL |
| --- | ---: | ---: |
| Papers (TZ1 to TZ3, Papers 1A, 1B, 2; each with its official mark scheme) | 9 | 9 |
| Questions | 161 | 123 |
| Multiple-choice letters (Paper 1A) | 120 | 90 |
| Bank after | 2,072 questions, 93 papers | 1,671 questions, 96 papers |

There is no Paper 3 in the 2025 syllabus. No paper was excluded: all 18 question papers pair with an official mark scheme.

## Sources and checks

- **Source:** `papers.xtremepape.rs` mirror of the IB release (`Experimental%20sciences` folder). SHA-256, bytes and pages are pinned in the source lane's `data/source-manifest-2026.json`; no PDF is committed.
- **Identity:** every PDF's subject, level, paper, time zone and May 2026 session were checked against its own text and the IB InDesign/Word metadata.
- **Watermarks:** `scripts/scan-source-watermarks.py` found no xtremepape.rs stamp. It flags four SL question papers only for printed image-credit URLs on the References page; those are part of the IB original.
- **Crops:** 284 questions, 335 question crops and 343 mark-scheme crops (678 in all, 27.5 MB). Every crop and its mark-scheme crop was viewed; mark-scheme ownership is row-level on shared pages; the seven TZ3 SL Paper 2 mark-scheme crops were re-cut after review. `validate_2026_lane.py`: 0 errors in 74 checks.
- **MCQ keys:** 210 letters (HL 3 x 40, SL 3 x 30) read two independent ways with identical results; the 32 HL/SL twin questions carry the same key; every letter equals the row's own mark-scheme transcript. Imported with `scripts/import-reviewed-mcq-answer-letters.mts`; source file `docs/ib-biology-may-2026/mcq-answer-letters-2026.json`, receipt in `docs/reviewed-mcq-answer-letters.md`.

## Tagging

- **Drex** (`drex-v1.1` requests, answered by `drex-v1.5`) was used for triage only: 284 calls, 1,015,081 tokens in, 264,678 out.
- **Primary pass** from the crop and official mark scheme; **blind pass** by separate reviewers from sealed evidence without the primary labels or Drex scores.
- **Agreement:** primary code 276 of 284, full labels 253 of 284. All 31 differing rows were adjudicated from the two immutable files.
- Labels use the repo's controlled taxonomy (2025 syllabus codes, four topics, existing student-facing groups). `src/lib/taxonomy.ts` is untouched.
- The reviewed labels are in `docs/audits/ib-biology-may-2026-review.json`.

## App changes

- `scripts/add-ib-biology-2026.mjs` appends the rows to `src/data/raw/ib-biology-{hl,sl}.json` (mirrored byte for byte in `production/`). It reads the earlier rows from the pinned base commit and refuses to run if any row, paper or header field would change; `--check` proves a rebuild is byte-identical. The append is recorded in `may2026Release`.
- `src/data/ib-biology-official-subtopics/` gains 284 reviewed rows (3,459 to 3,743); the earlier 3,459 are unchanged. `scripts/generate_ib_biology_official_subtopics.py` reads the review manifest for the new rows and checks the earlier rows against its reviewed snapshot.
- Catalog: HL 2,072 questions and 93 papers, SL 1,671 and 96, years 2016-2026.
- Full past papers: `docs/ib-biology-may-2026/archive-inventory.json` (rebuilt with `scripts/build-ib-biology-2026-archive-inventory.mjs`) feeds `scripts/build-whole-paper-archives.mts`. Each bank gains 9 papers; all 171 earlier entries are byte-identical. Papers 1A and 1B are self-markable; Paper 2 stays held ("Optional question choices need review"), like earlier Paper 2s.
- The 2016-2019 science candidate seal keeps verifying the sealed runtime: `sealedRuntimeBytes()` in `scripts/ib-science-receipt-contract.mjs` removes the 2026 append and must give the sealed hashes back.

## Upload plans (not executed)

| Bucket | Plan | Objects | Bytes |
| --- | --- | ---: | ---: |
| `pastpaperprep-assets` | `docs/ib-biology-may-2026/r2-upload-plan-assets.json` | 678 (HL 383, SL 295) | 27,482,258 |
| `pastpaperprep-free` | `docs/ib-biology-may-2026/r2-upload-plan-free-papers.json` | 36 PDFs | 54,691,269 |

- Both plans list key, SHA-256 and source path; every key is new. `scripts/plan-ib-biology-2026-uploads.mts --check` re-hashes the sources and proves the crop keys equal the app's own 2026 asset paths.
- **Crops:** create-only `wrangler r2 object put --remote`, `image/webp`, `private, max-age=31536000, immutable`, read back by SHA-256 and size.
- **PDFs:** `scripts/publish-added-free-papers.mts upload` then `verify`; `verify` is what rewrites `src/data/paper-archive-readback.json`.
- IB Biology has no 2026 free-preview year, so no Supabase preview objects are needed.

## Owner decisions

1. Approve the two uploads above.
2. After upload, run `verify` and commit the refreshed `src/data/paper-archive-readback.json`.
3. No worked explanations exist for the 2026 ids.
