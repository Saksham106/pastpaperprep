# Physics 0625 printed marks repair

Physics 0625 written-paper question totals (Papers 3–6, 2019–2026) are now the totals printed on the question papers. Before this repair, 1,143 of the 1,550 written questions had a different stored total: 1,128 too low and 15 too high.

**Cause.** Segmentation recorded one mark per mark-scheme row, so a part whose scheme credits several points was counted as 1, and question totals inherited the shortfall. The overstatements are scraping errors: summed rows, plus one row stored as 875 instead of 12. Students saw the wrong totals on question cards and in worksheet totals. MCQ papers (components 1x/2x) print no per-question totals and are unaffected.

**Evidence.** `scripts/census-0625-printed-totals.py` reads each question paper's PDF text layer from `../igcse-physics-0625-topic-practice/data/{raw,raw-extension}/` and attributes every printed `[Total: N]` to its question. A question number must sit in the left margin and follow the previous one in sequence. A single-part question with no printed total (Paper 5/6 Q4) uses its printed part mark.
- Two anchor rules are tried. A paper is accepted only when its totals sum exactly to the printed paper maximum (80 for Papers 3/4, 40 for Papers 5/6) with the stored question count. All 211 papers reconcile.
- Independent cross-check: 1,469 of 1,469 questions whose stored transcript contains `[Total: N]` agree with the PDF reading. The other 81 are the single-part questions.
- The frozen result, with each paper's question-paper SHA-256, is `scripts/data/0625-printed-marks-census.json`.

**Repair.** `scripts/reseal-0625-printed-marks.mjs` is a marks-only descendant of the MCQ retrieval reseal (#124, runtime `1a7f251d…`).
- It changes only `marks`/`maxMarks` on the 1,143 rows and keeps the private index in step.
- It records `printedMarksRepair` in the runtime artifact and reseals it (runtime `b46722a9…`, content `fc5d222d…`).
- `--check` replays the published files byte for byte.
- `assert0625PrintedMarksRepair` in `src/lib/igcse-runtime.ts` runs at load time. It pins the chain, rejects any content drift, and requires every written paper to sum to its maximum. The earlier practical-role and MCQ seals accept the new content once the marks repair is present.
- No assets, crops, classifications or storage objects change.
