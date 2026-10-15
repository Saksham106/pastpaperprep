# IB Economics May 2026 official papers (gated extension)

October 2026. Candidate only: nothing is uploaded, merged to the sealed runtime, or live.

## What was added

- **Sources.** The official May 2026 papers and mark schemes from papers.xtremepape.rs (IB release mirror): 10 pairs, Paper 1 HL/SL x TZ1-3, the shared HL/SL Paper 2 x TZ1-3, HL Paper 3. All 20 PDFs are IB originals; the watermark scan found no third-party stamps (4 question papers only carry IB's own reference credits). Identity (subject, level, paper, time zone, May 2026, printed totals) passed for every pair. There are no MCQs.
- **Questions.** 26 unique questions: HL 17 (7 papers), SL 15 (6 papers); the 6 shared Paper 2 questions appear in both banks. Marks reconcile with the printed totals (Paper 1: 25 per question; Paper 2: 40; Paper 3: 30 + 30 = 60). Paper 2 stimulus (Texts A-E, tables, figure) stays attached to both questions.
- **Crops.** 197 lossless WebPs (58 question, 139 mark-scheme) from the source lane `ib-economics-topic-practice` branch `feat/may-2026-official`. All were viewed in contact sheets; every printed part label is in its crops. Mark-scheme text keeps stacked fractions and exponents readable through reviewed text overrides.
- **Tagging.** Primary pass, a separate blind Sonnet pass, adjudication from the two immutable files (20 of 26 primaries agree, mean label-set overlap 0.76; 6 primaries and the secondary sets were adjudicated and the decisions recorded per question). Drex was triage only: the full run was served as `drex-v1.5` (the retired `drex-v1.1` alias, 104 requests), then `drex-v2.0` re-scored the disagreements as an extra signal only (32 requests; a sibling pilot found 2.0 no more accurate than 1.5). A flag changed a label only after the question and mark scheme were re-read. No label changes `src/lib/taxonomy.ts` or the taxonomy (`75527e47...`).

## How it is wired

The sealed 2021-2025 rows are untouched (`node scripts/verify-ib-economics-2026-may-addition.mjs` proves 15 frozen files byte-identical to `origin/main`). The 2026 rows are separate files that `src/lib/economics-runtime.ts` appends only when `PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED=true` on top of the production Economics flags. Default off: HL stays 111 questions / 42 papers and SL 89 / 32; on: HL 128 / 49, SL 104 / 38 (catalog counts and the static bank index follow the flag). The free cohort (2021) is unchanged. Local preview data is unchanged.

- Rows: `src/data/production/ib-economics-{hl,sl}-2026-may.json` (sealed in `ECONOMICS_MAY_2026_SEALS`), metadata index `src/data/private-index/ib-economics-{hl,sl}-2026-may.json`.
- Regenerate/check: `PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=<source worktree> node scripts/generate-ib-economics-2026-may.mjs [--check]`.
- Receipt `docs/ib-economics-2026-may-addition.json`; crop upload plan `docs/ib-economics-2026-may-r2-upload-plan.json` (287 objects, 13,969,840 bytes: HL 159, SL 128, create-only, `executed: false`); per-bank manifests in `docs/ib-economics-asset-manifests/`.
- Full past papers: `docs/ib-economics-2026-may-papers/` holds the inventory and candidate archives (HL +7, SL +6 entries, existing entries byte-identical). They are not applied to `src/data/paper-archives/` because the committed readback guard rejects entries whose PDFs are not live. The PDF plan `docs/ib-economics-2026-may-free-papers-upload-plan.json` lists 20 content-addressed objects (11,031,644 bytes) for `pastpaperprep-free`. All 13 entries are report-held (the builder holds optional-choice papers; HL P3 reconciles once the 2026 rows are in the sealed runtime).

## Owner steps (each needs fresh approval)

1. Upload the crops create-only (HEAD each key first) and read every object back by SHA-256 and size; then set `PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED=true`.
2. Extend the user-attested rights decision to the May 2026 papers (the 2026-09-09 attestation covers the sealed 2021-2025 corpus).
3. Upload the 20 PDFs (`scripts/publish-added-free-papers.mts`), then copy the candidate archives into `src/data/paper-archives/` and let `verify` write `src/data/paper-archive-readback.json` (expected 5,004 objects).
4. To fold the rows into the sealed runtime, finalize with a storage receipt (not done here).
