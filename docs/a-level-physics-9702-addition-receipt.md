# A Level Physics 9702: addition receipt (17 November 2026)

The owner asked for the Physics app PR on 2026-11-17 ("Yes, build Physics PR"). Nothing is uploaded, migrated or published: the catalog entry is hidden (`pendingStorage: true`) and the runtime is an unfinalized candidate. The branch is stacked on PR #496 (A Level board, 9709).

## Source
- Workspace `cambridge-a-level-physics-9702-topic-practice` at commit 67b80c6 (local git, clean). Receipts there: `docs/coverage-receipt.md`, `docs/classification-receipt.md`, `docs/segmentation-receipt.md`; plan `research/a-level-scoping/PLAN-9702.md`.
- Generator `scripts/generate-a-level-physics-9702-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic.
  - Inputs: segmentation, final labels, taxonomy, canonical manifest, paper facts, source and acquisition manifests, held questions and crop revisions (both asserted empty), and 83 blind-results files pinned together (`ab088ffe…`).
- Papers: 147 sourced (bestexamhelp.com; the May/June 2026 P21 mark scheme is the one documented Exam Easy exception), 132 canonical. The 15 alias papers' 184 question ids resolve through `src/data/question-id-aliases.json`.

## Runtime
| | |
|---|---|
| Questions | **2,627**: Paper 1 multiple choice 1,920 · Paper 2 AS structured 324 · Paper 4 A Level structured 383 (none held) |
| Papers / years | 132 canonical papers, 2020–2026 (Papers 3 and 5 out of scope; Oct/Nov 2026 not yet published) |
| Topics | 1–25 in syllabus order (subtopic = the label's `primary_subtopic`), then 9 named "(earlier syllabus)" topics for content the 2022 revision removed, only on 2020–2021 papers; every topic used; no generic bucket |
| MCQ letters | 1,920 official keys, each read two ways in the source (mark-scheme text and rendered view) and equal; served as `answer` + official `answerProvenance` through `mcq-answer-letters.ts` (Paper 1 components 11–14) |
| Free | 2020–2021: 773 questions |
| Not sat | May/June 2020: 164 questions |
| Calculator | allowed on every paper: all 147 QP covers print "You may use a calculator"; 2025–2027 syllabus §6 Mathematical requirements |
| Data and formulae | 2022+: Cambridge's 2025–2027 syllabus pp. 58–59; 2020–2021 questions: the 2019–2021 syllabus pp. 68–69 (no longer on Cambridge's site; the pinned bestexamhelp copy) |
| Candidate seal | `625c919f2ca5373a21be622a07c2c420656d5df2eda3e3f5b13bd82120874099` (blanked-v1) |

Paper tabs: All papers · Multiple choice · AS structured · A Level structured, opening on Multiple choice and remembered per browser (same mechanism as 9709).

## Storage plan (not uploaded)
- Prefix `a-level-physics-9702/releases/full2627-v1-625c919f2ca5/`, private bucket `pastpaperprep-assets`.
- `data/storage/a-level-physics-9702.manifest.json`: **6,056 WebP objects, 57,224,250 bytes**, all new keys.
- `data/storage/a-level-physics-9702.dry-run.json`: 0 R2 writes; every file re-hashed, 6,056/6,056 match the segmentation record.

## Billing
`bank_a_level_physics_9702`: single bank on the shared single-bank prices, Build Your Plan, All Access and Lifetime; no pair bundle. Migration `20261117000000_a_level_physics_9702_release.sql` copies the latest definitions (9709's migration) with the product and slug added; **not applied**. A catalog fix makes subject-named pair bundles IB-only, so A Level Physics never inherits `bundle_ib_physics`.

## Still owner-gated
1. R2 upload of the 6,056 crops (ask the owner in the session that runs it), read-back receipt, then `generate-igcse-release.mjs --finalize a-level-physics-9702`.
2. Production migration `20261117000000` (after 9709's `20261114000000`).
3. Switching the bank on (drop `pendingStorage`); explanations are exempt by name until written.
4. Merge, after #496 and never back-to-back with another build.

## Existing banks unchanged
Every other bank's raw and normalized rows were hashed on the #496 branch head (21eb0623) and on this branch: all 23 banks identical (45,735 rows, including A Level Maths 9709).

| Bank | Rows | Raw SHA | Normalized SHA |
|---|---:|---|---|
| igcse | 4,174 | `65b89684ed59` | `35cacec9d596` |
| igcse-additional | 1,656 | `6ca23bfd5439` | `1a82fa331d4a` |
| igcse-biology-0610 | 5,211 | `6606b21ce241` | `f80b51d6b330` |
| igcse-economics-0455 | 1,862 | `7f9ec89bf5bc` | `11ca94d50214` |
| igcse-chemistry-0620 | 5,129 | `a531a0ba21ca` | `989653a713fb` |
| igcse-physics-0625 | 5,789 | `fc5d222dd140` | `b23e889d1927` |
| igcse-coordinated-sciences-0654 | 4,721 | `d2e3517d35cc` | `fa99ff74aef6` |
| igcse-computer-science-0478 | 847 | `d650264d2d3e` | `8107648efa3a` |
| ib-hl | 893 | `42c0f770ccbe` | `561326c3cfa0` |
| ib-sl | 596 | `491ca5a84e86` | `42d834b24ccb` |
| ib-ai-hl | 484 | `25f6eab9d8c2` | `5da2ec1889a0` |
| ib-ai-sl | 386 | `fdb7cdb44043` | `65b5ec4b809a` |
| ib-chemistry-hl | 2,036 | `687fc132de74` | `ca2351cd10f0` |
| ib-chemistry-sl | 1,521 | `b16e364b1a17` | `993dfbd799e1` |
| ib-physics-hl | 2,028 | `8f98d19eb05e` | `4d90204605b4` |
| ib-physics-sl | 1,413 | `09494c0301f5` | `268c865f2c37` |
| ib-biology-hl | 2,071 | `06a06c71d6ec` | `9a9723b82502` |
| ib-biology-sl | 1,671 | `12ce9865be9e` | `a7301b6d61c9` |
| ib-computer-science-hl | 506 | `f976e7e5b290` | `6d130d7eabe1` |
| ib-computer-science-sl | 391 | `edca6d26e4bb` | `22a383043f1b` |
| ib-economics-hl | 128 | `e14d3572aef8` | `6c5e30730f28` |
| ib-economics-sl | 104 | `aa54701ced11` | `dabc96226ce0` |
| a-level-maths-9709 | 2,118 | `f3a82062613c` | `555c5c47847d` |
