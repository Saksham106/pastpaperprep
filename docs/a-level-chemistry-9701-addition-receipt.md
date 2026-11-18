# A Level Chemistry 9701: addition receipt (18 November 2026)

The owner approved the 9701 R2 upload in the 9701 content session. This branch adds the app side, with nothing uploaded, migrated or published. It holds the runtime candidate, the release-lane registration and the create-only upload plan, and the catalog entry stays hidden (`pendingStorage: true`). The branch is stacked on PR #497 (Physics 9702).

## Source
- Workspace `cambridge-a-level-chemistry-9701-topic-practice` at commit 7023841 (local git, clean). Receipts there: `docs/coverage-receipt.md` (PASS), `docs/classification-receipt.md`, `docs/segmentation-receipt.md`, `docs/acquisition-receipt.md`; plan `research/a-level-scoping/PLAN-9701.md`.
- Generator `scripts/generate-a-level-chemistry-9701-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic (two runs, same seals).
  - Inputs: segmentation, final labels, taxonomy, canonical manifest, paper facts, source and acquisition manifests, held questions (exactly `9701-2025-s-42-q5`), crop revisions (asserted empty), and 67 blind-results files pinned together (`c9302e4c…`).
- Papers: 147 sourced, 123 canonical. The 381 alias question ids (24 alias papers, one partial: s26 P43 keeps its edited Q4) resolve through `src/data/question-id-aliases.json`.

## Runtime
| | |
|---|---|
| Questions | **2,220**: Paper 1 multiple choice 1,720 · Paper 2 AS structured 201 · Paper 4 A Level structured 299 |
| Held | `9701-2025-s-42-q5` (12 marks): Cambridge's published MS has no row for 5(c). Left out of the runtime and the upload plan (its 4 crops). |
| Papers / years | 123 canonical papers, 2020–2026 (Papers 3 and 5 out of scope; Oct/Nov 2026 not yet sat) |
| Topics | 1–37 in syllabus order (AS 1–22, A Level 23–37), then 9 named "(earlier syllabus)" topics, only on 2020–2021 papers. The 3 empty earlier-syllabus topics are left out. |
| Topic labels | The syllabus reuses 13 AS titles for A Level topics (for example 5 and 23 are both "Chemical energetics"). Those A Level topics say "(A Level)" because the app keys topics by label. |
| MCQ letters | 1,720 official keys, each read two ways in the source and equal. Served as `answer` + official `answerProvenance` (Paper 1 components 11–14). |
| Section B | 2020–2021 Paper 1 items 31–40 (120 items): the first question crop is the shared key box, so it renders above the item. It is also named in `sharedStimulusImages`. |
| Withdrawn part | w25 P21 and P22 Q1: Cambridge withdrew 1(c)(iii). The rows keep their printed marks and list `removedParts`, and the MS row says the part was removed. |
| Free | 2020–2021: 619 questions |
| Not sat | May/June 2020: 154 questions |
| Durations | `paperFacts`: Paper 1 is 75 min, or 60 min for 2020–2021 (`durationMinutesByEra`). Paper 2 is 75 min and Paper 4 is 120 min. The course guide says the same. |
| Calculator | Allowed on every paper. All 147 QP covers print "You may use a calculator" (5 have a font-shifted text layer, read decoded). |
| Data / Periodic Table | The bank links the syllabus Data section: 2022+ is the 2025–2027 syllabus p. 80; 2020–21 is the 2019–2021 Data Booklet p. 78, via the pinned bestexamhelp copy. **The existing Periodic Table button is not turned on**, because it shows the IGCSE table (Li 7, B 11) and 9701 prints masses to one decimal place (Li 6.9, B 10.8). |
| Candidate seal | `1c9b6408fce87d5ccdbdf15e3f141ca70b58b70b1093b54bf22e130a64a7c9e4` (blanked-v1) |

Paper tabs: All papers · Multiple choice · AS structured · A Level structured. The bank opens on Multiple choice and the choice is remembered per browser, as in 9702.

## Storage plan (not uploaded)
- Prefix `a-level-chemistry-9701/releases/full2220-v1-1c9b6408fce8/`, private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-chemistry-9701.manifest.json`, **5,751 WebP objects, 59,839,372 bytes**. This is the 5,755 segmented crops minus the held question's 4.
- Dry run: `data/storage/a-level-chemistry-9701.dry-run.json`. Every local file was re-hashed: 5,751/5,751 match the manifest and the segmentation record, 0 mismatches, 0 R2 writes.
- Next (owner-approved in the content session): the create-only Worker upload, `research/ppp-tools/r2-upload-worker/upload.mjs --repo <this worktree> --bank a-level-chemistry-9701`. Then this branch checks the receipt and log and runs `generate-igcse-release.mjs --finalize a-level-chemistry-9701`.

## Billing
`bank_a_level_chemistry_9701` is sold on the shared single-bank prices, and is included in Build Your Plan, All Access and Lifetime. There is no pair bundle: subject-named pair bundles are IB-only, so it never inherits `bundle_ib_chemistry`. Migration `20261118000000_a_level_chemistry_9701_release.sql` copies Physics's `20261117000000` definitions and adds the product and slug after 9702. It is **not applied**.

## Still owner-gated
1. The R2 upload (approved; run from the content session), then read-back check and finalize here.
2. Free-year (2020–2021) crops to the public free bucket, before switch-on.
3. Production migration `20261118000000`, after 9702's `20261117000000`.
4. Switching the bank on (drop `pendingStorage`). Explanations are exempt by name until written.
5. Merge, after #497 and never back-to-back with another build.

## Follow-up
- A native A Level Periodic Table (one-decimal masses from the 9701 syllabus p. 91) for the in-app dock. Until then, the Data section link shows Cambridge's own page.

## Existing banks unchanged
Against the Physics branch head (d603787d), nothing under `src/data`, `public` or `data` changed except the new 9701 files and the added `a-level-chemistry-9701` block in `question-id-aliases.json`. Every other bank's alias map and every other field in that file are identical.
