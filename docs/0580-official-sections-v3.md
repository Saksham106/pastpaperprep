# 0580 additive official sections — v3

## Scope

The 2025–2027 official backbone contains nine existing topic names and 72 separately selectable sections in teaching order. All 51 existing finer filters remain selectable; each retains its exact served question-ID set. The combined legacy indices/surds filter still returns 180 questions. No question IDs, source text, images, primary topics, marks, access rules, billing or PDF behavior are changed. All 18 non-target bank indexes must remain byte-identical.

This is a conservative additive projection, not exhaustive semantic classification closure. The overlay assigns current sections to 2,794 of 3,967 questions; the remaining 1,173 retain their topic and finer-label retrieval. Evidence is attached **per link**: 106 source-reviewed links, 951 exact label/directive correspondences and 2,739 sample-calibrated model links. A source-reviewed part never upgrades other model-derived links on that question.

## Calibration and source checks

The original 30 source-adjudicated development cases are reused as a minimum supported-link reference, not an independent accuracy estimate. A separate 12-case risk-stratified Drex QP/MS review was independently produced, then corrected against source originals and official criteria in a separate adjudication artifact. Its 17 model links at the 0.95 threshold were supported; lower thresholds added questionable links. This small sample is **not** a whole-bank precision guarantee. Reviewed links can bypass the conservative threshold; unpromoted candidates do not.

Further original-image checks cover explicit calculator tasks and Core multipart numeric/algebraic indices. The maximum unreviewed Drex surd suggestion inspected (2018 November 43 Q4, 0.8753) remained held: a given cube-root parameter is not a requested surd simplification/rationalisation task. Original reviews remain immutable in the research workspace.

## Retrieval reconciliation

`node scripts/reconcile-0580-sections-v3.mjs` verifies every source ID, every old fine-filter ID set and all non-classification public fields. It writes the exact per-section ID sets and per-question link provenance to `docs/0580-section-reconciliation-v3.json`.

The narrower official index-family union (1.7, 2.4, 1.18) contains 99 questions, including 69 of the old combined set. The remaining 111 old IDs are explicitly unresolved for that official split; they are **not removed** or declared irrelevant. All remain available through the old 180-question filter. Do not describe this as exhaustive indices-family recovery or inflate counts with unsupported tags.

## Gates

- Exact served legacy filter seal: `docs/0580-section-legacy-filter-seal-v3.json`.
- Pre-change public metadata: `docs/0580-section-public-baseline-v3.json`.
- Source/registry/part-tier and per-link evidence guards in the shared projector.
- Runtime/public-index classification parity, exact old-filter sets, official-parent ownership, and no source-evidence laundering in focused tests.
- Separate lint, TypeScript, deterministic index generation, pristine differential suite, production build, independent review and hydrated browser/readback gates.
- Four pristine test failures are recorded separately: two mobile-toolbar CSS contract tests and two Node26 storage-dependent analytics tests. Only identical baseline failures may be waived.

Historical public-index image counts can count duplicate MS references twice (for example 2026 June 22 Q12); those pre-existing counts are preserved, not silently repaired in this classification change.

## Reproducibility

The approved overlay is immutable release data. Its source raw SHA, syllabus PDF SHA and each row's input fingerprint are pinned. Application indexes and reconciliation regenerate without paid model calls. Full scoring receipts, part-level adjudication and `build_accepted_retrieval.py` remain under the durable research workspace `pastpaperprep-math-aware-repair-20261001/0580-full-coverage-v2/release-v3`. These records distinguish source decisions from model proposals; they are not shipped as protected question text in browser metadata.

0606 remains unchanged and is the next separate bank, not part of this release.
