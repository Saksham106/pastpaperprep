# Reviewed Chemistry 0620 and Physics 0625 crop repairs

Follows the Coordinated Sciences 0654 repair (`docs/science-ms-row-repairs.md`): same row reader and the same overlay mechanism. Audit package: `../research/science-ms-crop-audit-20261017/` (`REPORT.md`, `audit_bank.py`, `build_repairs_bank.py`, `qp_audit_bank.py`, `qp-repair/`).

## Audit

Every served written answer (components 3–6, all years) was exported through the app's own loader and checked against its pinned mark-scheme PDF. The May/June 2026 0620 crops were re-rendered from clean PDFs (`docs/papacambridge-watermark-repairs.md`); their geometry is the original crop's and the audit reads the clean PDF. Two ownership rules were added for these banks:

- A merged guidance row printed as "Q2(a) REJECT …" belongs to the question it names.
- An unlabelled heading row (words only, no mark) directly followed by another question's labelled row is that question's heading, such as "Tests on solid G" in the Chemistry practicals. It does not continue the previous question.

Instruction-page tables before question 1 belong to no question. Results: Chemistry 1,091 written, 1,042 complete, 49 repaired. Physics 1,550 written, 1,543 complete, 7 repaired. No question is left unsupported.

## What students were missing

- `0620-2019-w-32-q6`: 6(a)(i) "pH 9" [1] was not shown.
- `0620-2026-s-51-q3`, `0620-2026-s-53-q3`, `0620-2026-s-61-q4` (planning questions): the first line ("any 6 from", the 6 marks and the first guidance line) was cut off.
- `0620-2026-s-41-q1`/`q2`: Q1's guidance note "1(a) to 1(f) ALLOW equations …" was missing, and Q2's "Q2(a) REJECT …" guidance was shown with Q1 instead of Q2.
- 43 Chemistry practical questions, 2019–2021 (Papers 5x/6x): a "Tests on solid/solution X" heading was missing from its own question, and often shown at the end of the previous question's crop. These rows carry no marks.
- `0625-2020-s-53-q4`, `0625-2020-s-63-q4`: Q4's MP1–MP6 (6 marks) were shown only inside Q3's crop.
- `0625-2026-s-42-q8`/`q9`: Q8's last line "(Q =) It OR (Q =) 3.2 × 120 C1" was shown at the top of Q9's crop.
- `0625-2020-m-62-q3`: also showed Q4's first row.

## Repair

Each repaired answer is the question's own table rows: rows that touch on one page become one table-width crop, rendered at the release scale (1.5) as lossless WebP and named by content SHA-256. Every replacement was re-audited against the paper's full row inventory with the same ownership rules (every own row covered, no other question's row). Two independent builds were byte-identical. 0620: 49 answers, 82 crop references, 78 files. 0625: 7 answers, 13 files.

One question-paper crop is also repaired. In `0625-2020-w-52-q1`, the page-3 crop now ends at 797.0 pt instead of 791.4 pt, so 1(c)'s "[4]" is included. That mark is printed against the page footer (baseline 795.4 pt). The footer text has baseline 805.0 pt, and the builder checks that the crop's bottom rows left of the "[4]" are blank.

- `scripts/build-science-crop-repairs-0620-0625.mjs <research dir> [--check]` writes `src/data/reviewed-science-crop-repairs-0620-0625.json` and `data/storage/science-crop-repairs-0620-0625.manifest.json` (92 objects, 1,023,956 bytes, namespace `repairs/science-ms-rows-v2-dc6a0224e1781263`). Old paths are the raw runtime lists. The builder checks that projecting them through the earlier overlays gives exactly the crops served today.
- `reviewedMarkschemePaths` checks both row overlays first, so they replace whatever earlier overlay served (4 Chemistry questions from the 2026-10-02 written-answer repair). `reviewedScienceQuestionPaths` is innermost in the question-path chain. Stale paths throw.
- The public bank index changes only answer-image counts for 0625 (the 0620 counts are unchanged).

## Upload (owner approval)

`scripts/upload-reviewed-science-crop-repairs-0620-0625.mjs` (scoped token or `--via-wrangler`) uploads create-only, re-reads every object in full and writes `data/storage/science-crop-repairs-0620-0625.receipt.json`. As for 0654, the receipt comes from a Wrangler readback (SHA-256 and size checked; stored Content-Type unobserved, `contentTypeObserved: false`). Re-run with `--readback-only` and a scoped read token to record the type. 13 repaired 0620 questions are free-year (19 files). They were copied to `pastpaperprep-free` with `../research/ppp-tools/publish-free-science-crops-0620-0625.mjs` (create-if-absent from the private object, bucket and public readback, log next to it).

## Explanations to re-check after merge

Live explanations written against the old crops: 0620-2026-s-41-q1, s-41-q2, s-51-q3, s-53-q3, s-61-q4; 0625-2026-s-42-q8, s-42-q9. The 2019–2021 questions have no explanations yet.
