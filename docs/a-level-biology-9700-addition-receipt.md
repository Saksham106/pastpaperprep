# A Level Biology 9700: addition receipt (19 November 2026)

The owner asked for the Biology PR ("go ahead and build the biology pr") and approved the 9700 R2 upload in the 9700 content session, which ran it against this branch's manifest. The crops are uploaded and read back and the runtime is finalized. Nothing is migrated or published, and the catalog entry stays hidden (`pendingStorage: true`, listed in `src/lib/held-banks.mjs`). It is built on `main` at 0d6777a8 (#498), the same way Chemistry 9701 was added there.

## Source
- Workspace `cambridge-a-level-biology-9700-topic-practice` at commit 1c68c4d: the 314703b data plus the reviewed secondary-subtopic overlay (see below); commits in between only record the upload and free copy. Receipts there: `docs/coverage-receipt.md` (PASS, byte-identical rebuild including all 7,006 crops), `docs/classification-receipt.md`, `docs/segmentation-receipt.md`, `docs/acquisition-receipt.md`.
- Generator `scripts/generate-a-level-biology-9700-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic (two runs, same seals).
  - Inputs: segmentation, final labels, taxonomy, canonical manifest, paper facts, source and acquisition manifests, held questions (exactly `9700-2025-s-44-q2`), crop revisions (asserted empty), transcript corrections, the secondary-subtopic overlay (`2057e9bf…`), and the 85 blind-results files pinned together (`5c0681cd…`).
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
| Subtopics | The primary subtopic first, then the reviewed further sections (`secondarySubtopics`) in syllabus order: every current secondary topic has at least one (501 pairs), plus materially assessed further sections of the primary topic on 242 structured questions. 500 rows carry 772 further sections. See "Review fixes". |
| Candidate seal | `71f39318165df84df5e6dac7c60c91ab67a8937632481be975e0cee230992a8d` (blanked-v1); the first candidate was `102ff947…`, which names the storage prefix |

Paper tabs: All papers · Multiple choice · AS structured · A Level structured. The bank opens on Multiple choice and the choice is remembered per browser, as in 9701 and 9702. A Level subjects are listed Mathematics, Chemistry, Physics, Biology.

## Storage (uploaded with owner approval, 19 November 2026)
- Prefix `a-level-biology-9700/releases/full2680-v1-102ff947f0aa/`, private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-biology-9700.manifest.json`, **6,994 WebP objects, 122,994,092 bytes**. This is the 7,006 segmented crops minus the 12 of the held question and the 3 discounted items.
- Dry run: `data/storage/a-level-biology-9700.dry-run.json`. Every local file was re-hashed: 6,994/6,994 match the manifest and the segmentation record, 0 mismatches, 0 R2 writes.
- The 9700 content session checked every manifest entry against its local crops (0 mismatches), then ran the upload through a temporary Cloudflare Worker (`ppp-asset-upload`, deleted afterwards; its URL returns 404). Tool: `research/ppp-tools/r2-upload-worker/`.
  - Every put was create-only and SHA-256-checked by R2, then read back and re-hashed. One transient edge 404 on the fresh workers.dev URL after 14 objects; the upload resumed from the log.
- Results: **6,994 of 6,994 verified, 0 failed, 0 already present**.
  - Log: `docs/a-level-biology-9700-r2-upload-log.jsonl` (`5fcd8721…`).
  - Receipt: `data/storage/a-level-biology-9700.receipt.json` (`verified_readback`, `60bb70f9…`).
- This session re-checked independently:
  - the receipt covers exactly the manifest keys, with no failures;
  - every log row is `verified`, not pre-existing, and matches its manifest SHA-256 and size;
  - the log and manifest seals hold;
  - 3 random objects fetched from R2 with wrangler hash to their manifest values and sizes.
- **Finalized:** `generate-igcse-release.mjs --finalize a-level-biology-9700`.
  - All 2,680 rows are now production/classified.
  - Seals at first finalize: runtime `a927e851…`, manifest `e35de697…`, receipt `60bb70f9…`, against candidate `102ff947…`. Re-finalized after the review fixes; see below. The release test reconstructs the current candidate from the finalized runtime.

## Free years in the public bucket (owner approval, 19 November 2026)
- The 9700 content session copied the 2020–2021 crops to the public free bucket (`free.pastpaperprep.com/images/`).
  - The list came from `listFreePublicAssets` on this finalized branch: 763 free questions, **1,968 files**.
  - It used the repo's unchanged `scripts/free-copy-worker` (allowlist, create-only). The Worker is deleted.
- Results: 1,968/1,968 copied and 1,968/1,968 re-hashed from the public URL, 0 failures. Logs and receipt: `docs/a-level-biology-9700-free-copy/`.
- This session re-checked:
  - both logs list exactly the runtime's 2020–2021 crops;
  - every hash and size equals the manifest;
  - both log seals match the receipt;
  - 2 random files fetched from free.pastpaperprep.com hash to their manifest values.

## Review fixes (owner review of #499, 19 November 2026)
- **Subtopic picker.** Selecting a topic hid its own subtopics: grouping fell through to the legacy helper, which defaults to the IB Maths SL taxonomy. Live Physics 9702 and Chemistry 9701 had the same fault (no topic showed its own sections), and the owner asked to fix both here.
  - `taxonomy-router` now has one A Level branch that maps each topic to its syllabus sections (`BIOLOGY_9700_SUBTOPICS`, `CHEMISTRY_9701_SUBTOPICS`, `PHYSICS_9702_SUBTOPICS`, each tested equal to its bank taxonomy).
  - Tested on every paper tab, on normalized rows and on rows rehydrated from bank-index metadata.
- **Secondary sections.** The filter missed questions that award marks in a secondary topic's section (`9700-2025-s-22-q1`: (d)(ii), 4 marks in 4.2 "Movement into and out of cells").
  - The 9700 content session built a reviewed overlay at 1c68c4d (`data/classification/secondary-subtopics.json`, `2057e9bf…`; receipt `docs/secondary-subtopics-receipt.md` there): 501/501 current secondary pairs, with primary-topic extras on 242 structured questions.
  - Method: two independent reads (98.1% / 97.4% agreement), 146 rows adjudicated, and a 50-row blind audit (40/41 and 49/50 exact; both differences checked and kept).
  - Rule: a section is listed only when the mark scheme gives marks for it. Every section of a topic may be listed only when each earns ≥ 2 marks (≥ 1 on a question worth ≤ 3); the content session recorded this as the owner's decision in its session.
  - The generator pins the overlay and fails closed: every current secondary topic needs a section, only the question's own topics are allowed, and the primary subtopic is never repeated.
  - Labels and crops are unchanged. As for CS 0478 (`561a9ee3`), the candidate was re-pinned and the runtime re-finalized from the unchanged upload log.
    - The manifest's asset list (keys, SHA-256, sizes) is identical, and the storage prefix keeps the first candidate's name. Only the manifest's `originalCandidateRuntimeSha256`/`contentSha256` and the receipt's `assetManifestSha256` changed.
    - New seals: runtime `8f705c91…`, manifest `5cc8fcf7…`, receipt `5a514f10…`.
    - The dry-run file still records the first candidate it ran against.

## Billing
`bank_a_level_biology_9700` is sold on the shared single-bank prices, and is included in Build Your Plan, All Access and Lifetime. There is no pair bundle: subject-named pair bundles are IB-only, so it never inherits `bundle_ib_biology`. Migration `20261119000000_a_level_biology_9700_release.sql` copies Chemistry's `20261118000000` definitions verbatim (a test checks this) and adds the product and slug after 9701. It is **not applied**.

## Still owner-gated
1. Production migration `20261119000000`.
2. Switching the bank on (drop `pendingStorage`, empty `held-banks.mjs`). Explanations are exempt by name until written.
3. Merge, never back-to-back with another build.

## Existing banks unchanged
Against `main` at 0d6777a8, nothing under `src/data`, `public` or `data` changed except the new 9700 files and the added `a-level-biology-9700` block (and its sentence in `note`) in `question-id-aliases.json`. All 20 other `src/data/production` runtimes are byte-identical, every other bank's alias map is identical, and `src/lib/bank-index-manifest.ts` is unchanged (9700 is held, so no static index is published for it).
