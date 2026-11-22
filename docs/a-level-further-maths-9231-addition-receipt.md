# A Level Further Mathematics 9231: addition receipt (22 November 2026)

The owner approved the app PR and the uploads ("Yes, PR + uploads") and chose to serve the "all candidates were awarded full marks" questions at their printed marks ("Serve them"). The coordinating session started this PR and runs the uploads. The bank stays **hidden**: the catalog entry has `pendingStorage: true` and the slug is listed in `src/lib/held-banks.mjs`. Nothing is migrated or switched on.

It is stacked on Computer Science 9618 (#507), so both banks launch in one build. It follows Mathematics 9709 (#496) for the maths conventions (paper tabs, the MF19 formula-list button, May/June 2020 "Not sat", section titles as topics, linear maths transcripts as accessible text) and 9708/9700 (#500) and 9618 (#507) for everything else. It is the second bank built with the shared ingestion toolkit (`../ppp-ingestion-toolkit`).

## Source
- Workspace `cambridge-a-level-further-mathematics-9231-topic-practice` at commit `f750b6f`. Receipts there:
  - `docs/coverage-tables.md` and `data/coverage-receipt.json`: PASS, 168/168 papers; `ppp-ingest gates` PASS with 0 failed and 0 waived;
  - `docs/acquisition-receipt.md`, `docs/segmentation-receipt.md`, `docs/classification-receipt.md`; `PAUSED.md`.
- May/June 2026 QPs and mark schemes are Cambridge's original files from Exam Easy (32 evidenced host exceptions, owner decision 2026-11-21/22); every other source is the pinned bestexamhelp copy. The 2020 May/June whole PDFs carry a bestexamhelp cover stamp; crops never include covers.
- Independent pixel check in the source: 2,727 of 2,728 crops identical to a fresh render, 1 differs only under a furniture mask, 0 with content masked. Visual review covered 302 of 813 rows, including every QP diagram row; 18 of 18 hidden controls were caught.
- Generator `scripts/generate-a-level-further-maths-9231-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic (two runs, byte-identical output).
  - Pinned inputs: segmentation, final labels, taxonomy, canonical manifest, source and acquisition manifests, held questions (asserted empty), full-marks notes and their reviewed decisions, reviewed MS marks, the secondary-subtopic overlay, the 2026–2027 syllabus PDF, MF19, the coverage receipt (asserted PASS), and the blind-results files pinned together (`ea7f2e38…`).
- Papers: 168 sourced, 116 canonical. Every series repeats one variant: May/June x2 = x1, Oct/Nov x3 = x1 (52 alias papers, proven by equal QP tokens, equal QP pixels and equal MS text and marks). 365 alias question ids resolve one to one through `src/data/question-id-aliases.json`; `reprint-question-aliases.json` gains a 9231 block (52 papers).

## Runtime
| | |
|---|---|
| Questions | **813**: Paper 1 (Further Pure Mathematics 1) 203 · Paper 2 (Further Pure Mathematics 2) 233 · Paper 3 (Further Mechanics) 202 · Paper 4 (Further Probability & Statistics) 175. Every question is structured. 7,250 marks. |
| Held / excluded | None. 0 copyright hits, no withdrawn parts, every question has official MS rows. |
| "All candidates were awarded full marks" | Three Oct/Nov 2023 mark schemes carry the note. All are **served at their printed marks**: the QP prints them and the MS still prints every mark point (owner: "Serve them"). `9231-2023-w-22-q6` (10), `9231-2023-w-32-q1` (4) and `q2` (6), `9231-2023-w-42-q5` (part 5(b); 16). Recorded in `fullMarksAwardedNotes`. |
| MS totals that differ | The QP's printed brackets are served. One reviewed Cambridge blank cell (`9231-2022-w-41-q5`, 5(c)); seven layout effects of the scheme ("Alternative method" blocks, a split "M1"), all in the source's visual review. The generator pins all eight. |
| Papers / years | 116 canonical papers, May/June 2020 to May/June 2026. June and November only (no March series); four variants from 2025. Oct/Nov 2026 is not yet published. |
| Topics | The 24 official sections, one set per paper (1.1–1.7, 2.1–2.6, 3.1–3.6, 4.1–4.5), all used. Each question carries sections of its own paper only (asserted per row), as in 9709. Topic labels are the section titles, as in 9709: 1.4 and 2.2 are both "Matrices", so "All papers" lists one Matrices topic and a paper tab lists its own. |
| Subtopics | The 84 learning outcomes, by their reviewed short labels; 3.6.1 reads "Restitution: definitions" (the source's app note). 77 appear on questions: seven foundational outcomes never earn marks of their own. Primary outcome first, then the reviewed further outcomes. |
| Secondary outcomes | The reviewed overlay (`data/classification/secondary-subtopics.json`): 82 secondary pairs, 407 rows with further primary-section outcomes, 10 reviewed additions; two reads plus adjudication from the crops, a keyword sweep and a 50-row audit. The generator pins it and fails closed, using 9618's rules. |
| Accessible text | The blind transcript (linear maths notation, e.g. `y = ax/(x + 7)`, `v^2`). |
| Free | 2020–2021: 225 questions. |
| Not sat | May/June 2020: 56 questions, labelled "Not sat". |
| Timing and totals | `paperFacts`: Papers 1 and 2 are 2 hours and 75 marks; Papers 3 and 4 are 1 hour 30 minutes and 50 marks. Every QP and MS in scope prints these totals, and each canonical paper's questions sum to them. |
| Course guide | 2026–2027 syllabus pp. 11–12 (the same in 2020–2022 and 2023–2025): Paper 1 is 60% of AS and 30% of A Level; Paper 2 is 30% of A Level (A Level only); Papers 3 and 4 are 40% of AS and 20% of A Level each. AS is Paper 1 with Paper 3 or 4; A Level is all four. |
| Calculator | Allowed on every paper. All 168 QP covers say "You should use a calculator where appropriate", and the syllabus expects a scientific calculator in all examinations. No filter, since only one value occurs. |
| Reference sheet | MF19, the formula list shared with 9709 (the syllabus calls it a combined list), through the existing formula-list button. |
| Candidate seal | `89c4fe2cbc19ba4c9ddf6d2d76635ffc30f1c5f4cd8c1c6e8c3ac485cc4db7de` (blanked-v1) |

**Paper tabs:** All papers · Further Pure 1 · Further Pure 2 · Further Mechanics · Further Probability & Statistics. The bank opens on Further Pure 1, which every candidate sits, and remembers the choice per browser. Each tab scopes the topic list and hides the Papers filter. Four tabs wrap like 9708's.

A Level subjects are listed Mathematics, Further Mathematics, Chemistry, Physics, Biology, Economics, Computer Science.

## Storage
- Prefix `a-level-further-maths-9231/releases/full813-v1-89c4fe2cbc19/`, private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-further-maths-9231.manifest.json`, **2,728 WebP objects, 32,628,068 bytes**: every segmented crop, since nothing is held or excluded.
- Dry run: `data/storage/a-level-further-maths-9231.dry-run.json`. Every local file was re-hashed: 2,728/2,728 match the manifest and the segmentation record, 0 mismatches, 0 R2 writes.
- Upload: pending. The coordinating session runs it with the owner's approval through the create-only R2 Worker, then this branch is finalized.

## Billing
`bank_a_level_further_maths_9231` is sold on the shared single-bank prices and is included in Build Your Plan, All Access and Lifetime. There is no pair bundle, and Mathematics 9709 does not reach it. Migration `20261122000000_a_level_further_maths_9231_release.sql` copies Computer Science's `20261121000000` definitions verbatim (a test checks this), carries 9618 forward in every list and adds the product and slug after it. It is **not applied**.

## Still owner-gated
1. Production migrations `20261121000000` (9618), then `20261122000000` (9231).
2. Switching the bank on: drop `pendingStorage`, take it off `held-banks.mjs`, regenerate the bank index. Explanations are exempt by name until written.
3. Merge once, together with 9618, never back-to-back with another build.
