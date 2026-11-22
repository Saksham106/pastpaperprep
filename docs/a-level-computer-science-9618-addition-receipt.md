# A Level Computer Science 9618: addition receipt (21 November 2026)

The owner approved the app PR and the uploads ("Yes, PR + uploads") and chose to serve the two "all candidates were awarded full marks" questions at their printed marks ("Serve them"). The coordinating session started this PR and ran both uploads. The crops are uploaded and read back, the 2021–2022 crops are in the free bucket, and the runtime is finalized. The bank stays **hidden**: the catalog entry has `pendingStorage: true` and the slug is listed in `src/lib/held-banks.mjs`. Nothing is migrated or switched on. It is built the way Economics 9708 and Biology 9700 were added (#500), and it is the first bank built with the shared ingestion toolkit (`../ppp-ingestion-toolkit`).

## Source
- Workspace `cambridge-a-level-computer-science-9618-topic-practice` at commit `df9a1d6`. Receipts there:
  - `docs/coverage-receipt.md`: PASS; `ppp-ingest gates` PASS with 0 failed and 0 waived;
  - `docs/acquisition-receipt.md`, `docs/segmentation-receipt.md`, `docs/classification-receipt.md`, `docs/secondary-subtopics-receipt.md`.
- Independent pixel check in the source is clean. Visual review covered 432 of 750 rows, including every diagram, MS-diagram and code-listing row; 10 of 10 hidden controls were caught.
- Generator `scripts/generate-a-level-computer-science-9618-runtime.mjs`: SHA-pinned inputs, fail-closed checks, deterministic (two runs, byte-identical output).
  - Pinned inputs: segmentation, final labels, taxonomy, canonical manifest, source and acquisition manifests, held questions (asserted empty), full-marks notes and their reviewed decisions, reviewed MS marks, the secondary-subtopic overlay, the 2026 syllabus PDF, the coverage receipt (asserted PASS), and the 36 blind-results files pinned together (`e79743ff…`).
- Papers: 98 sourced, 85 canonical. The 13 alias papers duplicate a canonical variant:
  - May/June 2021: 13 = 11, 23 = 21, and 32 = 33 = 31;
  - Oct/Nov 2021: 13 = 11, 23 = 21 and 32 = 31;
  - May/June 2022 to Oct/Nov 2024: 33 = 31.
  - From 2025 every variant is distinct. Oct/Nov 2021 had no variant 33.
- 124 alias question ids resolve through `src/data/question-id-aliases.json`. May/June 2021 Paper 3 is the only many-to-one case: 32 and 33 both map onto 31.

## Runtime
| | |
|---|---|
| Questions | **750**: Paper 1 (Theory Fundamentals) 254 · Paper 2 (Fundamental Problem-solving and Programming Skills) 238 · Paper 3 (Advanced Theory) 258. Every question is structured: no multiple choice, no essay choice, no levels tables. |
| Held / excluded | None. No content removed for copyright (0 hits), no withdrawn parts, and every question has an official mark scheme. |
| "All candidates were awarded full marks" | Two mark schemes carry this note. Both are **served at their printed marks**, because the QP prints the parts and the MS still prints the answers, so a student can answer and self-mark them (owner: "Serve them"; removed-part marks rule, 2026-11-19). The cases: `9618-2025-s-22-q1` (parts 1(a)(ii) and 1(b)(ii), 14 marks) and `9618-2026-s-32-q10` (part 10(a), 9 marks). They are recorded in `fullMarksAwardedNotes`. |
| Reviewed MS total | `9618-2025-s-12-q7`: the MS leaves the Marks cell for 7(b)(ii) blank (7 vs the QP's 8). The QP's printed [1] is served, as the source reviewed. |
| Papers / years | 85 canonical papers, May/June 2021 to May/June 2026. June and November only (the syllabus sets no March series); Oct/Nov 2026 is not yet published. Paper 4, the practical on a computer, is not in scope. |
| Topics | Syllabus sections 1–20 in order (AS 1–12, A Level 13–20), 44 subsections. A Level section 16 reuses AS section 5's title, so it says "System Software (A Level)"; subsection 19.1 says "Algorithms (A Level)" (9.2 is "Algorithms"). Each paper uses only its own sections: Paper 1 uses 1–8, Paper 2 uses 9–12 and Paper 3 uses 13–20 (asserted per row). There are no earlier-syllabus topics: the 2021–2023, 2024–2025 and 2026 syllabuses share sections 1–20. |
| Secondary subtopics | The reviewed overlay (`data/classification/secondary-subtopics.json`): 236 secondary pairs, 202 rows with further primary-section subsections, and 19 sweep additions. It was built from two reads plus adjudication, with a 50-row audit. The generator pins it and fails closed, using 9708's rules. |
| Accessible text | The blind transcript. |
| Free | 2021–2022: 218 questions. There was no 9618 exam before 2021. |
| Not sat | None: every paper was sat. |
| Timing and totals | `paperFacts`: Paper 1 is 90 minutes, Paper 2 is 120 minutes and Paper 3 is 90 minutes; each is 75 marks. Every QP and MS in scope prints 75, and each canonical paper's questions sum to 75. |
| Course guide | 2026 syllabus assessment overview, p. 11 (identical in 2021–2023 and 2024–2025): Papers 1 and 2 are 50% of AS and 25% of A Level each; Paper 3 is 25% of A Level. |
| Calculator | **Not allowed** on any paper. All 98 QP covers say "Calculators must not be used in this paper" (text layer), and all three syllabuses say "Calculators must not be used in any paper." Rows show a NO CALCULATOR badge; there is no calculator filter, since only one value occurs. |
| Reference sheet | None in the app. Every Paper 2 ships with an Insert of pseudocode built-in functions. No question needs insert-specific material, so linking a reference copy is left as a product decision. |
| Candidate seal | `a456b8f0af531650a0d6b02fce3f1e5f1c1e13062572ab575d92e0eceba2e4b6` (blanked-v1) |

**Paper tabs:** All papers · AS theory · AS problem-solving · A Level theory. These are ordered the way students sit them: AS candidates take Papers 1 and 2 in the same series, then A Level adds Papers 3 and 4. The bank opens on AS theory and remembers the choice per browser. Each tab scopes the topic list. Four tabs fit on one row.

A Level subjects are listed Mathematics, Chemistry, Physics, Biology, Economics, Computer Science.

## Storage
- Prefix `a-level-computer-science-9618/releases/full750-v1-a456b8f0af53/`, private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-computer-science-9618.manifest.json`, **2,397 WebP objects, 40,715,612 bytes**. That is every segmented crop, since nothing is held or excluded.
- Dry run: `data/storage/a-level-computer-science-9618.dry-run.json`. Every local file was re-hashed: 2,397/2,397 match the manifest and the segmentation record, 0 mismatches, 0 R2 writes.
- Upload (owner-approved, 21 November 2026): the coordinating session ran it against this branch's manifest through the temporary create-only R2 Worker (`ppp-asset-upload`), then deleted the Worker. Every put was SHA-256-checked by R2, then read back and re-hashed.
- Results: **2,397 of 2,397 verified, 0 failed, 0 already present**.
  - Log: `docs/a-level-computer-science-9618-r2-upload-log.jsonl` (`b1386c36…`).
  - Receipt: `data/storage/a-level-computer-science-9618.receipt.json` (`verified_readback`).
- This session re-checked independently:
  - the receipt covers exactly the manifest keys, with no failures, and its manifest seal holds;
  - the log seal holds; every one of the 2,397 log rows is `verified`, not pre-existing, and matches its manifest SHA-256 and size;
  - 3 random objects fetched from R2 with wrangler (`9618-2023-s-12` QP Q4, `9618-2023-w-12` MS Q7, `9618-2024-s-21` QP Q3) hash to their manifest values and sizes.
- **Finalized:** `generate-igcse-release.mjs --finalize a-level-computer-science-9618`. All 750 rows are now production/classified; runtime `1e6935a5…`, against candidate `a456b8f0…`. The test reconstructs the candidate from the finalized runtime.
- **Free years (owner-approved):** the coordinating session copied the 2021–2022 crops to the free bucket with `scripts/free-copy-worker` (create-only): **706 files, 11.8 MB, from 26 papers**, each re-hashed from `free.pastpaperprep.com`. Logs: `docs/a-level-computer-science-9618-free-copy/`.
  - Cross-check here: `listFreePublicAssets` over the asset manifest production builds once the bank is served (private asset mode) returns exactly the 706 copied paths, covering 218 questions. The copy and verify log seals match the receipt, every verified row matches its manifest SHA-256 and size, and 2 public fetches re-hash correctly. While the bank is held, the dev preview loads local paths, so the check runs the production normalization directly; the test does the same.

## Billing
`bank_a_level_computer_science_9618` is sold on the shared single-bank prices and is included in Build Your Plan, All Access and Lifetime. There is no pair bundle, and no other Computer Science product (0478, IB HL/SL) reaches it. Migration `20261121000000_a_level_computer_science_9618_release.sql` copies Economics's `20261120000000` definitions verbatim (a test checks this) and adds the product and slug after 9708. It is **not applied**. 9708's migration test now accepts a later release that carries 9708 forward, as 9700's does.

## Other banks unchanged
Against `origin/main` (`c79b23e5`), the only shared-data changes are the new `a-level-computer-science-9618` block in `question-id-aliases.json` (plus its sentence in `note`) and its block in the generated `reprint-question-aliases.json` (13 alias papers; read only for banks with a full-paper library, which 9618 does not have yet). Every other alias block, every other production runtime, `bank-index-manifest.ts` and `public/` are byte-identical.

## Still owner-gated
1. Production migration `20261121000000`, after `20261120000000`.
2. Switching the bank on: drop `pendingStorage`, empty `held-banks.mjs`, regenerate the bank index. Explanations are exempt by name until written.
3. Merge, never back-to-back with another build.
