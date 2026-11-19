# Marks for questions with a removed part

## Current rule (owner decision, 2026-11-19)

When the exam board removes a part from a question, the site serves **the marks students can actually score**: the printed total minus the removed parts, as awarded by the official mark scheme. The owner's words, in answer to "For withdrawn parts, show the marks students can actually score, across all banks?": "Yes, scoreable everywhere". The decision came from the owner's review of PR #498 (A Level Chemistry 9701).

- The printed total stays in the reviewed entry as provenance. Sealed runtimes are unchanged.
- A paper with a removed part now sums below its printed maximum, for example 79 instead of 80. That's intended: the removed marks are recorded in each entry.
- The explanation still lists the removed part as withdrawn and not marked.

## History
- **#140:** `0620-2026-m-32-q3` was served with no total.
- **2026-10-19 (#355):** the owner chose to serve the printed total, as `0610-2026-s-43-q5` already did. `0620-2026-m-32-q3` got 14.
- **2026-11-19:** superseded by the current rule. The review of #498 found that a student can answer every remaining part and still fall short of the advertised worksheet total.

## Questions (every served question with a removed part, all banks)
| Question | Removed part | Printed total | Served marks | Mark scheme | Paper sum |
|---|---|---:|---:|---|---|
| `0610-2026-s-43-q5` | 5(a), 3 marks | 15 | **12** | pp. 13–14: 3 + 1 + 3 + 5 | 77 of the printed 80 |
| `0620-2026-m-32-q3` | 3(d)(iv), 1 mark | 14 | **13** | p. 9: 1 + 2 + 2 + 1 + 2 + 1 + 1 + 3 | 79 of 80 |
| `0654-2022-summer-43-q11` | 11(b)(ii), 4 marks | 11 | **7** | pp. 13–14: 2 + 1 + 2 + 2 | 116 of 120 |
| `9701-2025-w-21-q1` | 1(c)(iii), 2 marks | 20 | **18** | pp. 7–8 | 58 of 60 |
| `9701-2025-w-22-q1` | 1(c)(iii), 2 marks | 10 | **8** | p. 7 | 58 of 60 |

In each mark scheme the removed part reads "Due to an issue with question …, the question has been removed from the question paper". The entries carry the QP and MS SHA-256s and the evidence.
- The 0610, 0620 and 0654 entries were reviewed by hand against the source PDFs, re-read on 2026-11-19.
- The 9701 entries are derived by `scripts/generate-a-level-chemistry-9701-runtime.mjs --write-removed-part-marks` from the pinned source segmentation. It checks the MS notice and N/A, the remaining MS rows, and that the QP brackets exceed the MS rows by exactly the removed part's marks.

**Searched and not served:** whole questions the board removed are not in any bank, so they need no entry. These are 0580 Nov 2025 P33 Q20 and Q27, 0455 Nov 2021 P11–13 Q22, 0455 Mar 2022 P12 Q22, 0455 May/June 2025 P11 Q10, 0625 May/June 2024 P21 Q14, and 9701 May/June 2025 P42 Q5 (held for a different reason). The search covered:
- every runtime's question text for board wording;
- every source workspace's data for "Due to an issue with question …";
- the 9709 and 9702 segmentations, which have none.

## Mechanism
- `src/data/reviewed-science-removed-part-marks.json` (schema v2) holds one entry per question. Each entry has:
  - `old`, the sealed runtime value, which must match or the load fails closed;
  - `printedTotal`, `assessableMarks` and `removedParts`;
  - the source hashes, mark-scheme pages and evidence.
- `printedTotal − Σ removedParts.marks = assessableMarks` is asserted everywhere the entry is read.
- `removedPartMarks` (`src/lib/reviewed-science-removed-part-marks.ts`) applies it in the loader. The question index, the paper builder's exact-marks totals, the PDF cover and worksheets all read the loader's marks.
- The same projection runs in:
  - `scripts/generate-bank-index.mjs`;
  - `scripts/explanations/served-marks.mjs`, used by the prepare and publish tools;
  - the free whole-paper archive loader (`withAssessableMarks` in `src/lib/whole-paper-archive.ts`), which lists the question's assessable marks and lowers the paper maximum by the removed marks.
- Tests: `src/lib/reviewed-science-removed-part-marks.test.ts` covers the cohort, the provenance, the loader, the index, the explanation tools, the paper sums, fail-closed behaviour and the archive. `src/lib/a-level-chemistry-9701.test.ts` covers the index, builder and PDF cover for both 9701 rows.

## Follow-ups (not in this change)
- **Published explanations** for `0610-2026-s-43-q5`, `0620-2026-m-32-q3` and `0654-2022-summer-43-q11` were written against the printed totals. Re-publishing them with the served totals is an explanations-session task and needs R2 writes, which are owner-gated.
- **0610 May/June 2026 Paper 43's whole-paper report** was held "until a scoring policy for withdrawn parts is agreed". The policy is now agreed. Releasing the report means rebuilding that archive entry.
