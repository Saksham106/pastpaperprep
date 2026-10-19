# Reviewed totals for questions with a removed part

Owner decision, 2026-10-19: when the exam board removes a part but the question paper keeps its printed `[Total]`, the site serves the printed total. The explanation lists the removed part as withdrawn and not marked. `0610-2026-s-43-q5` already works this way. This supersedes the #140 choice to leave `0620-2026-m-32-q3` without a total, which was the only served question in any bank with no marks.

## 0620-2026-m-32-q3

- **Question paper** (SHA-256 `6f96e8fb…`), page 7: prints `[Total: 14]`. Part 3(d)(iv) reads "Due to an issue with Question 3(d)(iv), the question has been removed from the question paper", with no bracket.
- **Mark scheme** (SHA-256 `4483db80…`), page 9: says the same for 3(d)(iv). The remaining parts carry 1 + 2 + 2 + 1 + 2 + 1 + 1 + 3 = 13 marks.
- **Paper total:** with 14, Paper 32 totals the printed 80. The free whole-paper archive already lists 14.

## Mechanism

- `src/data/reviewed-science-removed-part-marks.json` holds the reviewed entry: old `null`, new `14`, 13 assessable marks and the source hashes.
- `removedPartMarks` (`src/lib/reviewed-science-removed-part-marks.ts`) applies it in the loader. The same projection runs in `scripts/generate-bank-index.mjs` and in the explanation publisher. Stale input fails closed.
- The sealed 0620 runtime, the #140 marks receipt (`excludedQuestionId`) and the census are unchanged. Their tests still pin the stored `null`.
