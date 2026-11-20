# A Level Economics 9708: addition receipt (19 November 2026)

The owner asked to "continue what needs to be done" after the 9708 content build finished; the coordinating session started this app PR. The crops are uploaded (owner-approved, run by the coordinating session) and read back, the free-year crops are in the free bucket, and the runtime is finalized. After the owner's review of #500 (2026-11-20) the bank is **switched on** for the joint launch with Biology 9700: no `pendingStorage`, and `src/lib/held-banks.mjs` is empty. Nothing is migrated or merged. It is built the way Chemistry 9701 (#498) and Biology 9700 (#499) were added, including #499's review fixes (per-topic subtopic grouping in `taxonomy-router`).

## Source
- Workspace `cambridge-a-level-economics-9708-topic-practice` at commit `88d95f8`: the `e6d88fe` data plus the reviewed secondary-subtopic overlay (see below). Receipts there: `docs/coverage-receipt.md` (PASS, byte-identical rebuild including all 7,426 crop SHA-256s; 43 tests), `docs/classification-receipt.md`, `docs/segmentation-receipt.md`, `docs/acquisition-receipt.md`, `docs/structure-verification.md`.
- Independent pixel check in the source: 0 content masked. MCQ keys: mark-scheme text and rendered view agree on 2,760/2,760; examiner-report key tables agree on 1,467/1,468.
- Generator `scripts/generate-a-level-economics-9708-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic (two runs, byte-identical output).
  - Inputs: segmentation, final labels, taxonomy, canonical manifest, paper facts, source and acquisition manifests, held questions (exactly the source's 16; one more is held in the generator, see below), crop revisions (asserted empty), MCQ key corrections (exactly one), the secondary-subtopic overlay (`1579d638…`), and the 94 blind-results files pinned together (`6e2d8ac9…`).
- Papers: 197 sourced, 183 canonical. The 14 alias papers are May/June Paper 33 = 31 and Paper 43 = 41 in every year. 250 alias question ids resolve through `src/data/question-id-aliases.json`. The 251st alias, `9708-2025-s-43-q1`, points at a held question, so it is left out.

## Runtime
| | |
|---|---|
| Questions | **3,207**: Paper 1 (AS multiple choice) 1,492 · Paper 2 (AS data response and essays) 215 · Paper 3 (A Level multiple choice) 1,260 · Paper 4 (A Level data response and essays) 240 |
| Held (17) | 15 data-response Q1s whose published QP prints "Content removed due to copyright restrictions." in material a part needs (two readers agreed on every case; every mirror has the same removal): `2020-w-42`, `2021-m-22`, `2022-w-42`, `2023-m-22`, `2023-w-42`, `2025-m-22` (held in the app, owner review of #500), `2025-m-42`, `2025-s-21`, `2025-s-24`, `2025-s-41`, `2025-s-42`, `2025-w-22`, `2025-w-23`, `2026-s-22`, `2026-s-23`. Two MCQ items: `9708-2023-w-13-q24` (item misprint, ½ vs 1½) and `9708-2025-w-13-q17` (key B contradicts the definition; no examiner report). The rest of each affected paper is served. |
| Excluded (6) | Multiple-choice items Cambridge removed from the paper, with no key: `2023-s-11` Q22 and Q30, `2024-s-12` Q4, Q6 and Q8, `2025-s-14` Q2. Not rows and not in the upload plan; listed in `excludedQuestionIds`. |
| Papers / years | 183 canonical papers, 2020–2026 (Oct/Nov 2026 not yet sat). There is no practical or coursework component: the syllabus assesses Papers 1–4 only. |
| Topics | 1–11 in syllabus order (AS 1–6, A Level 7–11), then 4 named "(earlier syllabus)" topics, used only on 2020–2022 papers. A Level topics 7–11 reuse the titles of AS topics 2–6, so they say "(A Level)". Two A Level sections reuse AS section titles ("Exchange rates", "Government macroeconomic policy objectives") and say "(A Level)" too, so a subtopic filter never mixes AS and A Level questions. |
| MCQ letters | 2,752 official keys (Papers 1 and 3, components 11–14 and 31–34), served as `answer` + official `answerProvenance`. One correction: `9708-2020-w-12-q25` is served **C** from Cambridge's examiner report key table; the mark scheme prints B and its crop still shows B. The reviewed-letters file adds a note for that row so the answer chip explains the difference (`docs/a-level-economics-9708-mcq-key/`). |
| Essay choice | All 379 essays carry `choiceGroup` and `choiceRequired` from the paper's rubric: 2020–2022 Paper 2 Section B (answer one of three, 63 rows), 2020–2022 Paper 4 Section B (answer two of six, 25 marks each, 108 rows), and 2023+ Papers 2 and 4 Sections B and C (answer one of two each, 208 rows). Section A data response is compulsory and has no group. No whole-paper mode counts them yet; one that adds it must count the answered essays only. |
| Levels tables | 2023+ essay mark-scheme crops end with the generic levels-of-response tables (Table A/Table B): 420 crops, always last in the mark scheme. Three May/June mark schemes refer to the tables without printing them, so they take them from a sibling variant (2023-s-41 and 2023-s-43 from 2023-s-42, 2026-s-41 from 2026-s-42; `data/review/levels-table-sources.json` in the source). 2023-s-43 is an alias of 2023-s-41, so the served copies are the 16 under 2023-s-41 and 2026-s-41, each stored under the question's own paper. |
| Withdrawn parts | None. No `removedParts`, and `reviewed-science-removed-part-marks.json` has no 9708 entries. |
| Subtopics | The primary subtopic first, then the reviewed further sections (`secondarySubtopics`) in syllabus order: every current secondary topic has at least one (326 pairs in the runtime; the 327th belongs to the held `2025-m-22-q1`), plus materially assessed further sections of the primary topic. 377 rows carry 668 further sections. See "Secondary sections". |
| Accessible text | The blind transcript (no corrections needed). |
| Free | 2020–2021: 918 questions |
| Not sat | May/June 2020: 176 questions |
| Timing and totals | `paperFacts` per syllabus era: Papers 1 and 3 are 60 and 75 minutes, 30 marks, throughout. Papers 2 and 4 are 120 minutes and 60 marks from 2023; in 2020–2022 Paper 2 was 90 minutes / 40 marks and Paper 4 was 135 minutes / 70 marks. Each row's `maxMarks` is its own era's total. The May/June 2023 Paper 2 and 4 mark schemes print the old maximum (40/70) on the cover; the QP totals are the syllabus's, as the source records. |
| Course guide | 2026–2028 syllabus assessment overview (p. 11; same in 2023–2025): weightings 33%/67% of AS for Papers 1/2; 17%, 33%, 17%, 33% of A Level for Papers 1–4. |
| Calculator | Allowed on every paper. All 197 QP covers say "You may use a calculator" (193 in the text layer; the 4 image-only covers, 2025-w-22/23 and 2026-s-22/23, read from a render). The 2023–2025 and 2026–2028 syllabuses say "Calculators may be used for all papers." |
| Reference sheet | None: "Formulae are **not** given in the question papers" (syllabus). No periodic table or formula list. |
| Candidate seal | `264205541ced6de96ea479d18441317a01a0661833ca8e1119b7b60882351ccd` (blanked-v1); the first candidate was `a51a32c5…`, which names the storage prefix |

**Paper tabs:** All papers · AS multiple choice · AS written · A Level multiple choice · A Level written. These are ordered the way students sit them: AS first (Papers 1 and 2, often in one series), then A Level (Papers 3 and 4), multiple choice before written in each. The bank opens on AS multiple choice, the paper most candidates take first, and the choice is remembered per browser. Each tab scopes the topic list. The five tabs wrap on narrow screens, as 9709's do.

A Level subjects are listed Mathematics, Chemistry, Physics, Biology, Economics.

## Storage
- Prefix `a-level-economics-9708/releases/full3208-v1-a51a32c54f4e/`, private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-economics-9708.manifest.json`, **7,347 WebP objects, 81,059,370 bytes**. That's the 7,426 segmented crops minus the crops of the 16 held and 6 excluded questions.
- Dry run: `data/storage/a-level-economics-9708.dry-run.json`. Every local file was re-hashed: 7,347/7,347 match the manifest and the segmentation record, 0 mismatches, 0 R2 writes.
- Upload (owner-approved, 19 November 2026): run against this branch's manifest through the temporary create-only R2 Worker (`ppp-asset-upload`). Every put was SHA-256-checked by R2, then read back and re-hashed.
- Results: **7,347 of 7,347 verified, 0 failed, 0 already present**.
  - Log: `docs/a-level-economics-9708-r2-upload-log.jsonl` (`a24dc79f…`).
  - Receipt: `data/storage/a-level-economics-9708.receipt.json` (`verified_readback`).
- This session re-checked independently:
  - the receipt covered exactly the manifest keys, with no failures, and its manifest seal held;
  - the log seal holds; every one of the 7,347 log rows is `verified`, not pre-existing, and matches its manifest SHA-256 and size;
  - 3 random objects fetched from R2 with wrangler (`9708-2020-m-12` MS Q25, `9708-2025-s-14` MS Q14, `9708-2026-s-14` QP Q19) hash to their manifest values and sizes.
- **Finalized:** `generate-igcse-release.mjs --finalize a-level-economics-9708`. All rows are production/classified. First finalize: runtime `72f2e0fa…` against candidate `a51a32c5…`; re-finalized after the overlay and again after the review fixes (below). The test reconstructs the current candidate from the finalized runtime.

## Free years in the public bucket (owner approval, 19 November 2026)
- The coordinating session copied the 2020–2021 crops to the public free bucket (`free.pastpaperprep.com/images/`) with the repo's unchanged `scripts/free-copy-worker` (allowlist, create-only; the Worker is deleted). The list came from the upload manifest's 2020–2021 keys, because the bank was not wired yet.
- Results: 1,947/1,947 copied and 1,947/1,947 re-hashed from the public URL, 0 failures. Logs and receipt: `docs/a-level-economics-9708-free-copy/`.
- This session re-checked on the wired, finalized branch:
  - `listFreePublicAssets` over the production normalization of the runtime returns exactly the copied 1,947 paths (938 question + 1,009 mark-scheme crops for the 918 free questions; no explanations), with none missing and none extra;
  - every copy-log hash and size equals the upload manifest, every verify-log row is OK and matches its copy, and both log seals match the receipt (`a109ee51…`, `7e5f90d5…`);
  - 2 random files fetched from free.pastpaperprep.com hash to their manifest values.

## Secondary sections (the #499 review fix, applied before review)
- The owner's review of #499 found that a subtopic filter missed questions awarding marks in a secondary topic's section. 9708 gets the same fix up front.
- The 9708 content session built a reviewed overlay at `bbd10f4` (`data/classification/secondary-subtopics.json`, `a7b4a90c…`; receipt `docs/secondary-subtopics-receipt.md` there):
  - 327/327 current secondary pairs (54 with two or more sections), plus primary-topic extras on 218 written questions;
  - two independent reads (94.2% secondaries / 87.3% primary extras), 75 rows adjudicated, a 50-row audit with all 7 differences reviewed and kept;
  - rule (the 9700 owner decision): a section is listed only when the mark scheme gives it marks, and a further section only when it earns ≥ 2 marks (≥ 1 on a question worth ≤ 3).
- The generator pins the overlay and fails closed: every current secondary topic needs a section, only the question's own topics are allowed, and the primary subtopic is never repeated. Its inputs must equal the pinned labels, taxonomy and segmentation.
- Example: `9708-2020-m-22-q1` (primary "International economic issues") is now found under Protectionism ((a)(ii), (d)) and "Exchange rates (A Level)" ((b)(ii) Marshall–Lerner), not under AS "Exchange rates".
- Labels and crops are unchanged. As for 9700, the candidate was re-pinned and the runtime re-finalized from the unchanged upload log:
  - the manifest's asset list (keys, SHA-256, sizes) and prefix are identical; only its `originalCandidateRuntimeSha256`/`contentSha256` and the receipt's `assetManifestSha256` changed;
  - new seals: runtime `ba28eb40…`, receipt `fd5b4c78…`;
  - the dry-run file still records the first candidate it ran against.

## Review fixes (owner review of #500, 2026-11-20)
- **Held `9708-2025-m-22-q1`.** The published QP (p. 3) prints "Content removed due to copyright restrictions." in place of Fig. 1.2 (EU olive oil production, 2017–2023), and Q1(c) asks "With reference to Fig. 1.2" (4 marks). The mark scheme (p. 9) still marks (c), so this is missing stimulus, not a cancellation.
  - It is held in the generator (`APP_HELD`, fail-closed if the source changes); its marks are unchanged and nothing was re-uploaded.
  - Its 5 crops were already in the private bucket. They stay there, unserved: the manifest now plans the 7,342 current objects, and the receipt lists the 5 under `readbackProvenance.supersededKeys`, as 9709 did for its replaced crops. It is a 2025 question, so nothing was in the free bucket.
  - Tests: absent from the runtime, the private index, the emitted bank index and the hydrated rows; never picked by the worksheet builder for an exact 20-mark AS written 2025 request (200 seeds).
- **Copyright sweep of every 9708 QP.** A text search of all 197 QPs (the 4 image-only covers have text on every other page) found "Content removed due to copyright restrictions." in 17 Q1s and nowhere else. 14 were already held, `2025-m-22-q1` is now held, and two stay served:
  - `2022-s-22-q1` (p. 2): part of the article is removed; Table 1.1 and Fig. 1.1, which the prompts name, are printed, and (d) quotes the facts it needs. Both source readers found every part answerable.
  - `2025-s-23-q1` (p. 2): part of the article is removed; no prompt names a figure or table, and the parts quote what they need ('a series of typhoons', 'suggested retail price'). Both source readers found every part answerable.
- **AD/AS sections.** The content session's overlay update (`88d95f8`, `1579d638…`, 16 reviewed additions) adds "Aggregate Demand and Aggregate Supply analysis" to `9708-2021-w-21-q1` (Q1(d), MS p. 6, 6 marks) and `9708-2022-s-22-q1` (Q1(c), MS p. 7, 6 marks), keeping their primaries. Its sweep of explicitly required tools (AD/AS, PPC, elasticities, surplus, MSC/MSB, cost curves and others) judged 104 candidates with two readers and added 14 more, each with part and marks. A test finds both questions under that section in the emitted AS written index.
- **Re-pinned and re-finalized** from the unchanged upload log: candidate `26420554…`, runtime `fd7f12b9…`, receipt `2f2dfa43…`. The free list is unchanged (1,947 files, 918 questions), and the emitted free index points only at copied files.
- **Switched on:** `pendingStorage` dropped, `held-banks.mjs` empty, bank index regenerated.

## Billing
`bank_a_level_economics_9708` is sold on the shared single-bank prices and is included in Build Your Plan, All Access and Lifetime. There is no pair bundle: subject-named pair bundles are IB-only, so it never inherits `bundle_ib_economics`. Migration `20261120000000_a_level_economics_9708_release.sql` copies Biology's `20261119000000` definitions verbatim (a test checks this) and adds the product and slug after 9700. It is **not applied**.

## Still owner-gated
1. Production migrations `20261119000000` then `20261120000000`.
2. Retarget to `main` (it then contains #499) and merge once, never back-to-back with another build. Explanations are exempt by name until written.
