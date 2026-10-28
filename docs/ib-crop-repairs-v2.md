# Crop repairs v2 (IB Chemistry, IB Physics, 0606), 2026-10-27

Found while writing explanations: 41 held explanations pointed at crops that were cut off or missing context. Each defect was confirmed against the source PDF (scoping notes: `/tmp/crop-scope/notes.md`, to be moved to `../research/ib-crop-repairs-v2/`). The owner approved the full scope. **Storage upload is not done and needs owner approval.**

## Defects and repairs

| Family | Defect | Repair | Questions | New objects |
|---|---|---|---:|---:|
| IB Chemistry rotated mark schemes | The 2017–2019 mark schemes store landscape pages with `/Rotate 90`. The extension lane normalised them with `show_pdf_page`, which shrank each page to 70.69 % and clipped its left third. Every answer crop lost the Question column and the start of the Answers column. | Every affected crop is re-cut from the original PDF after `Page.remove_rotation()`, as the Biology segmenter does. The source engine's own anchor and region rules are re-run in display coordinates, at 1.75 px/pt and full page width. | 387 (HL 230, SL 157) on 26 papers | 600 |
| IB Chemistry shared stimuli | A stimulus printed above the questions it serves was in no crop, or only in the crop of the question before it. | Same rules as `docs/ib-shared-stimulus-repairs.md`. 2017 May TZ1 Paper 3 Q2–Q5 reuse the v1 data-block object, so no new object is needed. Stimuli for 2019 Nov P1 (HL Q14–15, SL Q13–14) and 2017 May TZ2 P1 (HL Q18–19, SL Q16–17) are new crops. The question before each one is re-cut, or its stimulus-only crop is dropped. | 20 | 6 |
| IB Physics Paper 1 boundaries | The next question's anchor was taken from an option-label line, so option D (or B–D) appeared at the top of the next question. | Both crops on the boundary page are re-cut at the real anchor − 8 pt. Marks are unchanged (1 each). | 14 (7 pairs) | 14 |
| 0606 continuation rows | 2019 Nov 23 Q6 lacked the final 6(ii) A1, which is printed on page 6. 2017 June 21 Q9 lacked its 9(i) rows on page 5, which the source-grid repair dropped. | The missing rows are added as one new crop, in the bank's 150 dpi style. Every served crop is kept. | 2 | 2 |

The 2019 May TZ2 HL Paper 2 mark scheme was already re-cut (`docs/ib-chemistry-hl-2019-p2.md`). In 49 Chemistry questions a continuation strip held only the running header and column headings, so the re-cut drops it, as the original run did. The bank index answer-image count changes for those questions.

## Build and checks

- `python3 -I scripts/ib-crop-repairs-v2/build_crops.py <worktree> <projects root> <package dir>` writes `repairs.json` and `objects/<object key>`. Inputs are read-only: the raw runtime, the verified IB science upload manifests (old hashes), and the sibling workspaces' PDFs and registries. Images are lossless WebP. Two builds were byte-identical.
- Builder assertions:
  - Chemistry: on every rotated paper, each answer-table text line sits in exactly one question's crop. No crop edge cuts a text line. Every crop is 1,474 px wide with both table edges inked. The first crop shows the question's own number. The re-derived bounds map onto the old shrunk-frame bounds within 1 pt.
  - Stimuli: the caption is unique, no question number falls inside a stimulus, and a dropped crop held only the header and the stimulus.
  - Physics: the band that moves holds option labels and no question number.
  - 0606: the slice holds the expected rows and nothing from the neighbouring question.
- `node scripts/build-reviewed-ib-crop-repairs-v2.mjs <package dir> [--check]` writes four overlays and four storage manifests. Each old path is bound to the raw runtime and its verified hash, and each new object to its bytes.
- Visual review covered a stratified sample of 44 Chemistry crops (every paper, HL and SL, P2 and P3, all held questions) and every stimulus, Physics and 0606 crop.

## Runtime

| Overlay | Applied by |
|---|---|
| `src/data/reviewed-ib-chemistry-rotated-ms-repairs.json` | `rotatedChemistryMarkschemePaths`, inside `reviewedMarkschemePaths` (never the same question as `reviewed-ib-science-crop-repairs.json`) |
| `src/data/reviewed-ib-shared-stimulus-repairs-v2.json` | `reviewedIbQuestionPaths` (with v1; a v2 entry may reuse a v1 object by hash) |
| `src/data/reviewed-ib-question-boundary-repairs-v2.json` | `reviewedIbBoundaryPaths` / `reviewedIbBoundaryMarks` (with v1; the Physics banks join `IB_QUESTION_BOUNDARY_BANKS`) |
| `src/data/reviewed-0606-ms-continuation-repairs.json` | `reviewed0606ContinuationPaths`, applied after the right-edge overlay, plus print geometry for the added crop |

All four are bound to exact old paths, so stale input fails closed. `scripts/generate-bank-index.mjs` projects the same counts. The IB objects are R2-only (`isR2OnlyObjectPath`).

The explanation tooling now reads the served marks: `scripts/explanations/served-marks.mjs` is used by both `prepare-batch.mjs` and `publish.mjs`. It applies the Biology historical and printed-marks overlays too, so `0610-2019-s-31-q3`, `s-61-q1` and `s-61-q2` resolve to 10, 19 and 21. `src/lib/explanations-served-marks.test.ts` checks the projection against the loader for every bank.

Before upload, `PPP_REPAIR_STAGE=<package dir> node scripts/explanations/prepare-batch.mjs …` reads the repair crops from the package, so held explanations can be re-checked now.

## Storage (needs owner approval)

| Manifest | Objects | Private R2 `pastpaperprep-assets` | Public `pastpaperprep-free` (`images/<key>`) | Supabase `question-assets` |
|---|---:|---:|---:|---:|
| `data/storage/ib-chemistry-rotated-ms-repairs.manifest.json` | 600 | 600 | 600 (all 2017–2019, free years) | — |
| `data/storage/ib-shared-stimulus-repairs-v2.manifest.json` | 6 | 6 | 6 | — |
| `data/storage/ib-question-boundary-repairs-v2.manifest.json` | 14 | 14 | 14 | — |
| `data/storage/0606-ms-continuation-repairs.manifest.json` | 2 | 2 | 1 (2017) | 2 |

Uploads are create-only under new content-addressed keys. Nothing is replaced or deleted, and superseded objects stay in the bucket unreferenced. No upload script or receipt exists yet.

## Explanations to re-check after upload

- Held: the 41 from the scoping report, except `0625-2019-s-62-q2` and `0654-2020-summer-31-q9`. Those are official-scheme issues, not crop issues.
- Live explanations on changed crops:
  - Chemistry answer crops: HL 204, SL 151.
  - Chemistry stimuli: HL 9, SL 8.
  - Physics boundaries: HL 6, SL 7.
