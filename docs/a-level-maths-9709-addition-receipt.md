# A Level Mathematics 9709: addition receipt (14 November 2026)

The owner approved folding the real 9709 questions into this PR in chat ("Yes, fold in", relayed by the coordinating session). Nothing has been uploaded, migrated or published: the catalog entry stays hidden (`pendingStorage: true`) and the runtime is an unfinalized candidate.

## Source
- Workspace: `cambridge-a-level-mathematics-9709-topic-practice` at commit 5c9254a (local git, clean). Receipts there: `docs/coverage-receipt.md`, `docs/classification-receipt.md`.
- Generator: `scripts/generate-a-level-maths-9709-runtime.mjs`. Every input is SHA-256 pinned and the run is deterministic (two runs, identical bytes):
  - `segmentation.json`, `final-labels.json`, `taxonomy.json`, `canonical-manifest.json`, `held-questions.json`, `paper-facts.json`, `source-manifest.json`, `acquisition-manifest.json`
  - the 95 blind-results files, pinned together (`e605c685…`); their transcripts are the accessible text.
- Papers: 276 sourced (bestexamhelp.com, identity-checked), 256 canonical. The 20 alias papers reprint another variant of the same series; their 149 question ids resolve to the canonical questions through `src/data/question-id-aliases.json`.

## Runtime
| | |
|---|---|
| Questions | 2,118 (2,119 canonical, minus held `9709-2024-s-33-q11`: Cambridge's mark scheme omits it) |
| Papers | 256 (Paper 1: 502, Paper 2: 239, Paper 3: 477, Paper 4: 321, Paper 5: 307, Paper 6: 272 questions) |
| Years | 2020-2026 (all series; Oct/Nov 2026 not yet published) |
| Sections | 38 official sections 1.1-6.5 (`9709:2020:<code>`), every one used; labels never leave the question's own paper |
| Free | 2020-2021: 636 questions |
| Not sat | May/June 2020: 138 questions, labelled "Not sat" (source exam status `released_not_sat`) |
| Paper facts | totals and durations from the syllabus assessment table (`paper-facts.json`), in the runtime and `assessment-guides.ts` |
| Candidate seal | `191db74b1cb400a1a095ee61cc3b3f033d47edaff6c1936e4d13f9f2e7351d22` (blanked-v1, recomputed from content) |
| Files | `src/data/production/a-level-maths-9709.json`, `src/data/private-index/a-level-maths-9709.json`, `src/data/a-level-maths-9709-taxonomy.json` |

Topics are the official section titles; the paper tab equals the paper number, and a paper tab lists that paper's sections in syllabus order.

## Storage plan (not uploaded)
- Release lane: `scripts/igcse-release.mjs` bank `a-level-maths-9709`, prefix `a-level-maths-9709/releases/full2118-v1-191db74b1cb4/` in the private bucket `pastpaperprep-assets`.
- Create-only plan: `data/storage/a-level-maths-9709.manifest.json`, **6,496 WebP objects, 84,547,318 bytes**, every key new under the prefix.
- Dry run: `data/storage/a-level-maths-9709.dry-run.json`. 0 R2 writes; every file re-hashed locally, and all 6,496 hashes match the segmentation record.
- The source holds 6,498 crops; the 2 not in the plan are the held question's QP crops (`9709-2024-s-33/questions/q11-16-1.webp`, `q11-17-2.webp`).

## Still owner-gated
1. **R2 upload** (after approval): `WRANGLER=<bin> node scripts/upload-computer-science-wrangler.mjs --bank a-level-maths-9709`. Per object: absent check, put, read-back SHA-256 and size. It writes `docs/a-level-maths-9709-r2-upload-log.jsonl` and `data/storage/a-level-maths-9709.receipt.json`.
2. **Finalize** (needs that receipt): `PASTPAPERPREP_A_LEVEL_MATHS_SOURCE_ROOT=<workspace> node scripts/generate-igcse-release.mjs --finalize a-level-maths-9709`. Then repin the finalized runtime and drop `pendingStorage`.
3. **Production migration** `20261114000000_a_level_maths_9709_release.sql` (products row, catalog rows copied from `bank_igcse`, slug and product lists).
4. **Stripe**: none needed. Single bank uses the shared single-bank prices; All Access and Lifetime cover every bank.
5. **Merge.**
6. Before release, decide the held question, and run explanations (the article-claim test re-arms when `pendingStorage` comes off).

## Existing banks unchanged
For every other bank, raw and normalized rows were hashed on `origin/main` (cdb1fe2a) and on this branch. All 22 banks are identical (43,617 rows), and the bank-index manifest changes only the 9709 entry.

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
