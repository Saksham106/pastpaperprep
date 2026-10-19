# Reviewed IB question-boundary repairs (Biology Q1/Q2)

Found 2026-10-19 while publishing the IB Biology 2024 explanations: `ib-biology-hl` `2024-may-tz1-hl-p3-q1` was served as 3 marks without part (c), and Q2 as 7 marks. Package: `../research/ib-bio-hl-2024-p3-q1-repair/` (`audit_crop_marks.py`, `build_boundaries.py`, two byte-identical builds).

## Defect

The segmenter found each question by its number at the start of a line. In these papers it took the answer-line label "2." inside Question 1's last answer box for the start of Question 2. So Question 1's crops stop inside that box, and Question 2's crops carry the rest of Question 1 before its own page. In 2024 that rest is (c), plus a "Please do not write on this page" page. Runtime marks were computed from the same crops, so a paper's total still added up.

| Bank | Paper | Q1 marks | Q2 marks |
|---|---|---|---|
| ib-biology-hl | 2024-may-tz1-hl-p3 | 3 → 5 | 7 → 5 |
| ib-biology-hl | 2017-november-tz0-hl-p2 | 7 → 15 | 15 → 7 |
| ib-biology-hl | 2017-november-tz0-hl-p3 | 6 | 5 |
| ib-biology-sl | 2017-november-tz0-sl-p3 | 3 → 7 | 9 → 5 |
| ib-biology-sl | 2018-november-tz0-sl-p2 | 13 | 7 |

In the last two rows the crops change but the totals do not, because no printed mark fell below the false anchor.

## Audit

`audit_crop_marks.py` checks every Paper 1B, 2 and 3 question with served crops in IB Biology, Chemistry and Physics, 2016 to 2026 (3,800 questions). It flags three things:

- a crop that holds another question's "(Question N continued)" header;
- a first crop that does not contain the question's own number at the margin;
- printed marks inside the crops that differ from the runtime marks.

Of the 8 hits, 5 are the papers above. The other three are questions whose text is "Removed for copyright reasons", and their crops are correct. Chemistry and Physics have none.

## Repair

For each paper the builder finds the real Question 2 anchor: its number at the left margin, followed by stem text. Question 1 runs from its served start to 8 pt above that anchor, skipping blank "do not write" pages. Question 2 starts there and keeps its served later pages. Pages wholly inside one question use the segmenter's full-page bounds, and rendering matches the segmenter. The new crops are lossless WebP. Marks are the printed [N] brackets inside each new range, and each pair keeps its runtime total.

- `scripts/build-reviewed-ib-question-boundary-repairs.mjs <package> [--check]` writes `src/data/reviewed-ib-question-boundary-repairs.json` and `data/storage/ib-question-boundary-repairs.manifest.json`: 20 objects, 822,000 bytes, under `repairs/ib-question-boundary-v1-b5cd8c02cf13cad9`.
- `reviewedIbBoundaryPaths` and `reviewedIbBoundaryMarks` (`src/lib/reviewed-ib-question-boundaries.ts`) apply the overlay in the loader. The same projection runs in the public index (`questionImageCount`, `marks`) and the explanation publisher. Each entry is bound to the exact raw paths and marks, so stale input fails closed. The asset census drops by 6.
- The source workspace is unchanged. Re-segmenting it would bring the defect back, so this overlay stays authoritative until the segmenter ignores indented answer-line labels.

## Upload (owner approval)

`scripts/upload-reviewed-ib-question-boundary-repairs.mjs` (scoped token or `--via-wrangler`) uploads create-only, re-reads every object in full and writes `data/storage/ib-question-boundary-repairs.receipt.json`.

## Follow-up

The held explanations for `2024-may-tz1-hl-p3-q1` (it needs part (c)) and `-q2` (only its review flag needs clearing) can be finished and published once this ships. None of the other eight questions has a published explanation.
