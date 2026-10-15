# IB Biology May 2026: official papers

October 2026. Branch `feat/ib-biology-may-2026`. **Uploads and readback: DONE** (owner-approved, 15 October 2026): 678 crops to `pastpaperprep-assets` and 36 PDFs to `pastpaperprep-free`, each read back by SHA-256 and size; `verify` re-read all 5,020 approved PDFs. One HL question is withheld from practice because its source is incomplete (see Withheld question).

## What was added

| | HL | SL |
| --- | ---: | ---: |
| Papers (TZ1 to TZ3, Papers 1A, 1B, 2; each with its official mark scheme) | 9 | 9 |
| Questions (served) | 160 | 123 |
| Multiple-choice letters (Paper 1A) | 120 | 90 |
| Bank after | 2,071 questions, 93 papers | 1,671 questions, 96 papers |

There is no Paper 3 in the 2025 syllabus. No paper was excluded: all 18 question papers pair with an official mark scheme. One HL question (of 284) is withheld from practice, below.

## Withheld question

`2026-may-tz1-hl-p1b-q2` (HL TZ1 Paper 1B, Q2, 8 marks): the official question paper, page 5, replaces the graph with a "Removed for copyright reasons" notice, and parts (a)(i)-(ii) (3 marks) need it. A re-upload of the same source cannot fix this. This is the only such notice in the 2026 IB question papers scanned (a literal text screen, not exhaustive visual assurance).

- **Practice:** the row is not served. It follows the existing precedent for source-incomplete questions (`0455-2026-s-11-q26`, `0455-2021-s-22-q1`): left out of `questions` and counted and recorded, with its reason and source binding (QP SHA-256, page 5, crop SHA-256), in `may2026Release.excludedFromPractice`; `sourceQuestionCount` 161 = `addedQuestionCount` 160 + `excludedQuestionCount` 1. Its reviewed labels stay in `docs/audits/ib-biology-may-2026-review.json` (`withheldRows`) and out of the served overlay. Its 3 crops were uploaded before the withhold and stay in storage, not served; nothing was deleted or overwritten.
- **Full past papers:** the report of `biology-2026-may-tz1-hl-p1b-english` is held through `data/paper-archives/report-holds.json`, bound to both PDF hashes. Both PDFs stay downloadable. The paper still prints Q2 [8] and 35 in all; no graph data, automatic credit or reduced maximum was introduced.
- **To release it:** an authorized complete source, or an explicit source-bound scoring policy for the incomplete question. Then remove the exclusion in `scripts/add-ib-biology-2026.mjs` and the hold.

## Sources and checks

- **Source:** `papers.xtremepape.rs` mirror of the IB release (`Experimental%20sciences` folder). SHA-256, bytes and pages are pinned in the source lane's `data/source-manifest-2026.json`; no PDF is committed.
- **Identity:** every PDF's subject, level, paper, time zone and May 2026 session were checked against its own text and the IB InDesign/Word metadata.
- **Watermarks:** `scripts/scan-source-watermarks.py` found no xtremepape.rs stamp. It flags four SL question papers only for printed image-credit URLs on the References page; those are part of the IB original.
- **Crops:** 284 questions, 335 question crops and 343 mark-scheme crops (678 in all, 27.5 MB; 675 are served, 3 belong to the withheld question). Every crop and its mark-scheme crop was viewed; mark-scheme ownership is row-level on shared pages; the seven TZ3 SL Paper 2 mark-scheme crops were re-cut after review. `validate_2026_lane.py`: 0 errors in 74 checks.
- **MCQ keys:** 210 letters (HL 3 x 40, SL 3 x 30) read two independent ways with identical results; the 32 HL/SL twin questions carry the same key; every letter equals the row's own mark-scheme transcript. Imported with `scripts/import-reviewed-mcq-answer-letters.mts`; source file `docs/ib-biology-may-2026/mcq-answer-letters-2026.json`, receipt in `docs/reviewed-mcq-answer-letters.md`.

## Tagging

- **Drex** (`drex-v1.1` requests, answered by `drex-v1.5`) was used for triage only: 284 calls, 1,015,081 tokens in, 264,678 out.
- **Primary pass** from the crop and official mark scheme; **blind pass** by separate reviewers from sealed evidence without the primary labels or Drex scores.
- **Agreement:** primary code 276 of 284, full labels 253 of 284. All 31 differing rows were adjudicated from the two immutable files.
- Labels use the repo's controlled taxonomy (2025 syllabus codes, four topics, existing student-facing groups). `src/lib/taxonomy.ts` is untouched.
- The reviewed labels are in `docs/audits/ib-biology-may-2026-review.json`.

## App changes

- `scripts/add-ib-biology-2026.mjs` appends the rows to `src/data/raw/ib-biology-{hl,sl}.json` (mirrored byte for byte in `production/`). It reads the earlier rows from the pinned base commit and refuses to run if any row, paper or header field would change; `--check` proves a rebuild is byte-identical. The append is recorded in `may2026Release`.
- `src/data/ib-biology-official-subtopics/` gains 283 reviewed rows (3,459 to 3,742); the earlier 3,459 are unchanged. `scripts/generate_ib_biology_official_subtopics.py` reads the review manifest for the new rows, checks the earlier rows against its reviewed snapshot, and requires every new row's manifest codes to equal its raw `officialTopicCodes` (A1.1 cannot become A1.2).
- Catalog: HL 2,071 questions and 93 papers, SL 1,671 and 96, years 2016-2026.
- Full past papers: `docs/ib-biology-may-2026/archive-inventory.json` (rebuilt with `scripts/build-ib-biology-2026-archive-inventory.mjs`) feeds `scripts/build-whole-paper-archives.mts`. Each bank gains 9 papers; all 171 earlier entries are byte-identical. Papers 1A and 1B are self-markable, except HL TZ1 Paper 1B (report held for the withheld question, above); Paper 2 stays held ("Optional question choices need review"), like earlier Paper 2s. A reviewed hold now names its reason even when the withheld question also leaves the runtime inventory short.
- The 2016-2019 science candidate seal keeps verifying the sealed runtime: `sealedRuntimeBytes()` in `scripts/ib-science-receipt-contract.mjs` removes the 2026 append and must give the sealed hashes back.

## Uploads (DONE, owner-approved, verified)

| Bucket | Record | Objects | Bytes |
| --- | --- | ---: | ---: |
| `pastpaperprep-assets` | `docs/ib-biology-may-2026/r2-upload-plan-assets.json`, `r2-upload-log-assets.jsonl` | 678 (HL 383, SL 295; 675 served) | 27,482,258 |
| `pastpaperprep-free` | `docs/ib-biology-may-2026/r2-upload-plan-free-papers.json`, `src/data/paper-archive-readback.json` | 36 PDFs | 54,691,269 |

- Both plans list key, SHA-256 and source path. `scripts/plan-ib-biology-2026-uploads.mts --check` re-hashes the sources and proves the crop keys equal the app's own 2026 asset paths plus the withheld question's crops. It does not trust its PDF input: it re-derives the newly approved PDFs from the base and head manifests and compares every key, hash, size and download name, so a same-count substitution is rejected.
- **Crops (done):** each key checked absent, then `wrangler r2 object put --remote` (`image/webp`, `private, max-age=31536000, immutable`), then read back by SHA-256 and size, serialized. This is check-absent, put, read-back: wrangler has no conditional put, so it is not an atomic create, and a concurrent writer between the check and the put cannot be ruled out.
- **PDFs (done):** `scripts/publish-added-free-papers.mts upload` (same check-absent, put, read-back sequence) then `verify`, which rewrote `src/data/paper-archive-readback.json` after all 5,020 approved PDFs matched.
- IB Biology has no 2026 free-preview year, so no Supabase preview objects are needed.

## Owner decisions

1. The 2026 uploads and the readback are done; nothing further is needed for storage.
2. Decide how to complete the withheld question (a complete source or a scoring policy), then lift its exclusion and report hold.
3. No worked explanations exist for the 2026 ids.
