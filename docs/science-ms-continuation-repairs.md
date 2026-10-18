# Reviewed mark-scheme continuation repairs (Chemistry 0620-2025-w-33)

Follows `docs/science-crop-repairs-0620-0625.md`. Package: `../research/science-ms-crop-audit-20261017/continuation-repair/` (`build_continuation.py`, two byte-identical builds).

## Defect

In the October/November 2025 Paper 33 mark scheme, the tables on pages 9, 10 and 12 continue from the previous page without a repeated header. Three answers were served without their continuation rows:

- `0620-2025-w-33-q4`: 4(e)(ii) to 4(h), 9 of 17 marks.
- `0620-2025-w-33-q5`: 5(d)(i) to 5(g), 13 of 18 marks.
- `0620-2025-w-33-q7`: 7(f), 2 of 8 marks.

The original release had a second crop for each. The 2026-10-02 written-answer repair (`docs/science-written-answer-source-repairs.md`) replaced each answer with one crop of the first page. The 2026-10-17 crop audit did not catch it: its row reader parsed no rows on those pages and reported "labels outside parsed rows" as a paper problem, but the audit still marked the questions complete.

## Check

An independent check (`label_check.py` in the package) finds every printed sub-part label, such as `4(e)(ii)`, in the Question column of every pinned mark scheme. It then requires that label to lie inside one of its own question's served crops, after all reviewed repairs. Chemistry 0620: 5,013 labels, all inside except these 14. Physics 0625: 2,777, none outside. Coordinated Sciences 0654: 3,760, none outside. The audits' other paper problems are "Tests on" headings, guidance lines, and labels printed without the question number. Those rows were assigned correctly.

## Repair

Each answer is served as two crops. The first is today's crop, re-rendered with the same bounds; it is byte-identical to the 2026-10-02 crop. The second is the question's continuation rows: table width, from the table top to the rule under the question's last row, ending above the next question's header. The builder checks that the continuation labels lie inside the crop and that no other question's label does. Mark totals now match the printed paper: q4 8 + 9 = 17, q5 5 + 13 = 18, q7 6 + 2 = 8.

- `scripts/build-science-ms-continuation-repairs.mjs <package> [--check]` writes `src/data/reviewed-science-ms-continuation-repairs.json` and `data/storage/science-ms-continuation-repairs.manifest.json`. The manifest has 6 objects, 65,502 bytes, under namespace `repairs/science-ms-continuation-v1-2d440e4171b256df`.
- `reviewedMarkschemePaths` checks this overlay in the same loop as the other row overlays, bound to the raw runtime paths. Stale paths throw. The bank index changes only `markschemeImageCount` (1 → 2) for these three questions.

## Upload (owner approval)

`scripts/upload-reviewed-science-ms-continuation-repairs.mjs` (scoped token or `--via-wrangler`) uploads create-only, re-reads every object in full and writes `data/storage/science-ms-continuation-repairs.receipt.json`. With Wrangler the stored Content-Type is not observable and is recorded as such.

## Also in this paper

The official scheme prints 2, 2 and 1 marks for 6(b)(i), 6(c)(i) and 6(d). The question paper prints [1], [1] and [2], and its total is 11. The printed paper is primary, so nothing is changed. The explanation follows the printed marks.
