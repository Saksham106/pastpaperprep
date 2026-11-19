# A Level Biology 9700: addition receipt (19 November 2026)

The owner asked for the Biology PR ("go ahead and build the biology pr") and approved the 9700 R2 upload in the 9700 content session. This branch adds the app side, with nothing uploaded, migrated or published. It holds the runtime candidate, the release-lane registration and the create-only upload plan, and the catalog entry stays hidden (`pendingStorage: true`, listed in `src/lib/held-banks.mjs`). It is built on `main` at 0d6777a8 (#498), the same way Chemistry 9701 was added there.

## Source
- Workspace `cambridge-a-level-biology-9700-topic-practice` at commit 314703b (local git, clean; HEAD 3407615 only edits `PAUSED.md`). Receipts there: `docs/coverage-receipt.md` (PASS, byte-identical rebuild including all 7,006 crops), `docs/classification-receipt.md`, `docs/segmentation-receipt.md`, `docs/acquisition-receipt.md`.
- Generator `scripts/generate-a-level-biology-9700-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic (two runs, same seals).
  - Inputs: segmentation, final labels, taxonomy, canonical manifest, paper facts, source and acquisition manifests, held questions (exactly `9700-2025-s-44-q2`), crop revisions (asserted empty), transcript corrections, and the 85 blind-results files pinned together (`5c0681cd…`).
- Papers: 147 sourced, 141 canonical. The 60 alias question ids (6 alias papers: P43 = P41 in every Oct/Nov 2020–2025) resolve through `src/data/question-id-aliases.json`.

## Runtime
| | |
|---|---|
| Questions | **2,680**: Paper 1 multiple choice 1,957 · Paper 2 AS structured 294 · Paper 4 A Level structured 429 |
| Held | `9700-2025-s-44-q2`: Cambridge's published QP prints "Content removed due to copyright restrictions." in place of Fig. 2.1 (a pedigree), and part (b) needs it. Every mirror has the same removal. Left out of the runtime and the upload plan (its crops). |
| Excluded | 3 multiple-choice items Cambridge marked "Question discounted", with no key: `9700-2021-w-13-q7`, `9700-2023-w-11-q27`, `9700-2023-w-11-q35`. Not rows, not in the upload plan; listed in the runtime's `excludedQuestionIds`. |
| Papers / years | 141 canonical papers, 2020–2026 (Papers 3 and 5 out of scope; Oct/Nov 2026 not yet sat) |
| Topics | 1–19 in syllabus order (AS 1–11, A Level 12–19), then 8 named "(earlier syllabus)" topics, only on 2020–2021 papers. The 2 empty earlier-syllabus topics are left out. No A Level topic reuses an AS title. |
| MCQ letters | 1,957 official keys, each read two ways in the source and equal. Served as `answer` + official `answerProvenance` (Paper 1 components 11–14). |
| Section B essay choice | 2020–2021 Paper 4 Q9 and Q10 (15 marks each; candidates answer one): 24 rows, 12 papers, served as normal questions with `choiceGroup: "section_b_answer_one"`. The A Level banks have no whole-paper mode yet; one that adds it must count one essay per paper. |
| Withdrawn parts | None. No `removedParts`, and `reviewed-science-removed-part-marks.json` has no 9700 entries. Two MS rows have blank Marks cells (2020-w-22 Q5(c), 2023-w-22 Q3(c)(i)); the QP brackets are served, as reviewed in the source. |
| Accessible text | The blind transcript, with the source's 5 reviewed α/β corrections applied (`transcript-corrections.json`: "a-glucose" → "α-glucose" and the like). The generator re-derives each corrected transcript from the blind one and fails if it differs from the source's. |
| Free | 2020–2021: 763 questions |
| Not sat | May/June 2020: 168 questions |
| Durations | `paperFacts`: Paper 1 is 75 min, or 60 min for 2020–2021 (`durationMinutesByEra`). Paper 2 is 75 min and Paper 4 is 120 min. The course guide says the same, with the 2025–2027 syllabus weightings (p. 10). |
| Calculator | Allowed on every paper. All 147 QP covers print "You may use a calculator" (text layer, checked 2026-11-19). |
| Reference sheet | **None, unlike 9701/9702.** 9700 papers have no data page outside the questions: when a formula is needed (Lincoln index, Simpson's index, Hardy–Weinberg, RQ, stomatal index), the question prints it, so the crop already holds it. The syllabus says the same ("When needed, candidates will be provided with this information", 2025–2027 p. 65). The Periodic Table button stays off. |
| Candidate seal | `102ff947f0aa8db777cc049e663c5d348dbf498a2ee2115e617ce3f59b63df8a` (blanked-v1) |

Paper tabs: All papers · Multiple choice · AS structured · A Level structured. The bank opens on Multiple choice and the choice is remembered per browser, as in 9701 and 9702. A Level subjects are listed Mathematics, Chemistry, Physics, Biology.

## Storage plan (not uploaded)
- Prefix `a-level-biology-9700/releases/full2680-v1-102ff947f0aa/`, private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-biology-9700.manifest.json`, **6,994 WebP objects, 122,994,092 bytes**. This is the 7,006 segmented crops minus the 12 of the held question and the 3 discounted items.
- Dry run: `data/storage/a-level-biology-9700.dry-run.json`. Every local file was re-hashed: 6,994/6,994 match the manifest and the segmentation record, 0 mismatches, 0 R2 writes.
- Next (owner-approved in the content session): the create-only Worker upload, `research/ppp-tools/r2-upload-worker/upload.mjs --repo <this worktree> --bank a-level-biology-9700`, and the free-year copy (1,968 crops for the 763 free questions). Then this branch checks the receipt and log and runs `generate-igcse-release.mjs --finalize a-level-biology-9700`.

## Billing
`bank_a_level_biology_9700` is sold on the shared single-bank prices, and is included in Build Your Plan, All Access and Lifetime. There is no pair bundle: subject-named pair bundles are IB-only, so it never inherits `bundle_ib_biology`. Migration `20261119000000_a_level_biology_9700_release.sql` copies Chemistry's `20261118000000` definitions verbatim (a test checks this) and adds the product and slug after 9701. It is **not applied**.

## Still owner-gated
1. The R2 upload and the free-year copy (approved; run from the content session), then read-back check and finalize here.
2. Production migration `20261119000000`.
3. Switching the bank on (drop `pendingStorage`, empty `held-banks.mjs`). Explanations are exempt by name until written.
4. Merge, never back-to-back with another build.

## Existing banks unchanged
Against `main` at 0d6777a8, nothing under `src/data`, `public` or `data` changed except the new 9700 files and the added `a-level-biology-9700` block (and its sentence in `note`) in `question-id-aliases.json`. All 20 other `src/data/production` runtimes are byte-identical, every other bank's alias map is identical, and `src/lib/bank-index-manifest.ts` is unchanged (9700 is held, so no static index is published for it).
