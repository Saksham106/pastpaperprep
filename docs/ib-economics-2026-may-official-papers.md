# IB Economics May 2026 official papers

October 2026. Folded into the production Economics runtime as an append over the sealed 2021-2025 rows. No env flag.

## What was added

- **Sources.** The official May 2026 papers and mark schemes from papers.xtremepape.rs (IB release mirror): 10 pairs (Paper 1 HL/SL x TZ1-3, the shared HL/SL Paper 2 x TZ1-3, HL Paper 3). All 20 PDFs are IB originals; the watermark scan found no third-party stamps (4 question papers only carry IB's own reference credits). Identity (subject, level, paper, time zone, May 2026, printed totals) passed for every pair. No MCQs.
- **Questions.** 26 unique: HL 17 (7 papers), SL 15 (6 papers); the 6 shared Paper 2 questions appear in both banks. HL is now 128 questions / 49 papers, SL 104 / 38. Marks reconcile with the printed totals (P1 25 per question, P2 40, P3 30 + 30 = 60). Paper 2 stimulus stays attached.
- **Crops.** 197 lossless WebPs (58 question, 139 mark scheme) from the source lane `ib-economics-topic-practice` `feat/may-2026-official`, all viewed in contact sheets; every printed part label is in its crops. Mark-scheme fractions and exponents are readable through reviewed text overrides.
- **Tagging.** Primary pass, a separate blind pass, adjudication from the two immutable files (20 of 26 primaries agree, mean label-set overlap 0.76; decisions recorded per question). Drex was triage only: the run was served as `drex-v1.5` (104 requests), then `drex-v2.0` re-scored the disagreements as an extra signal only (32 requests). New rows are `blind_adjudicated`; the sealed rows keep `semantic_qa_approved`. The taxonomy (`75527e47...`) and `src/lib/taxonomy.ts` are untouched.
- **Rights.** User-attested, not verified: `docs/ib-economics-2026-may-rights-attestation.json` (2026-10-15) extends the 2026-09-09 attestation to the May 2026 papers.

## How it is wired

- `scripts/generate-ib-economics-2026-may.mjs` rebuilds production, private-index and local-preview files, the asset manifests, the combined storage receipt and the seal manifest from the base blobs at `5d0f243` plus the source lane (`--check` proves a byte-identical rebuild). `scripts/verify-ib-economics-2026-may-addition.mjs` proves every 2021-2025 row, paper and asset entry is an unchanged prefix, the sealed receipt, taxonomy and 2026-09-09 attestation are untouched, and all 287 uploads are verified.
- Seals: `ECONOMICS_RUNTIME_SEALS` (combined storage pair), `ECONOMICS_BASELINE_STORAGE_SEALS` (the original pair, kept as evidence) and `ECONOMICS_MAY_2026_SEALS` in `src/lib/economics-runtime.ts`. The runtime checks the baseline prefix against its pinned content hash and each appended row against the 2026 artifact.
- Storage: 287 crops (13,969,840 bytes; HL 159, SL 128) uploaded create-only to `pastpaperprep-assets` and read back by SHA-256 and size (`docs/ib-economics-2026-may-r2-upload-log.jsonl`). The combined receipt `docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt-with-2026-may.json` covers 1,891 objects / 92,803,902 bytes; the original receipt file is unchanged.
- Free cohort stays the 2021 year. Receipt: `docs/ib-economics-2026-may-addition.json`.
- Full past papers: 13 entries (HL +7, SL +6) in `src/data/paper-archives/`, existing entries unchanged; HL Paper 3 now reconciles to its runtime rows (the other 12 are held by the builder's optional-choice rule). The 20 PDFs (11,031,644 bytes) were uploaded to `pastpaperprep-free` (owner-approved, 20/20 present, 0 conflicts) and `publish-added-free-papers.mts verify` read back all 5,004 PDFs from free.pastpaperprep.com and wrote `src/data/paper-archive-readback.json`. Plan: `docs/ib-economics-2026-may-free-papers-upload-plan.json`.
