# IB Chemistry 2016–2019: verified secondary subtopics

October 2026. Branch `fix/ib-chemistry-extension-secondaries`.

## Problem

`scripts/generate-ib-science-extension-candidate.mjs` maps Chemistry secondaries through `secondary_topic_ids`, which the Chemistry extension does not use (it records `secondary_subtopic_ids`). So all 1,411 IB Chemistry 2016–2019 rows (HL 809, SL 602) serve their primary subtopic only. A 2016–2019 question never appears under a secondary subtopic or topic filter, while the reviewed 2020+ rows do.

## Why not serve the source secondaries as they are

The extension's reconciled results (source `85cae43c`, SHA-256 `af5d0a79…` as pinned by its receipt) propose 1,273 secondary links on 673 rows, plus 52 on the 19 re-included 2019 HL Paper 2 rows that have any. They are noisy:
- 1,245 of the rows came from `auto_rule_match`;
- the extension's own blind QA agreed on secondaries at a mean Jaccard of 0.43;
- they would give 48% of rows a secondary, against about 27% of reviewed 2020+ rows.

## Verification

Four independent text-only reviewers, one per batch of about 173 rows, judged all 1,325 candidate links against the official mark scheme. A link is kept only if a printed part earns at least 1 mark for knowledge in that subtopic beyond the primary. Context, keyword hits, primary-subtopic content and doubtful cases are dropped, and nothing is added.

**Result:** 531 kept and 794 dropped, so 376 rows gain secondaries. Every keep records its part and marks (`docs/audits/ib-chemistry-extension-secondaries-verification.json`).

Checks:
- A sample of 12 keeps was checked against the mark-scheme text: all correct.
- Borderline calls can differ between batches. For example, one batch keeps R1 for half-equations inside fuel-cell parts and another drops them. Doubt resolves to drop, so the effect is fewer secondaries, not wrong ones.
- One batch read only the first part of most mark schemes, so it may have missed some valid links; its keeps still cite parts and marks.

## Delivery

- `node scripts/build-ib-chemistry-extension-secondaries.mjs [--check]` writes `src/data/reviewed-ib-chemistry-extension-secondaries.json` from the pinned reconciled results, taxonomy, 2019 review manifest and verification audit. It refuses any row whose runtime primary does not match its candidate, or whose verdicts do not cover its candidates exactly.
- `src/lib/reviewed-ib-chemistry-secondaries.ts` applies it in `normalizeQuestion`, following the 2020+ convention:
  - `subtopics` lists the primary, then the secondary subtopics;
  - `secondaryTopics` lists the distinct topics of those secondaries, excluding the primary topic.

  Each entry is bound to the row's primary subtopic and fails closed.
- The sealed runtime, storage manifests and candidate seal are byte-identical. No assets change.

## Noted, not changed

Two reviewers flagged primaries that look off for the question content (e.g. `2017-may-tz2-hl-p2-q1` and `2017-may-tz1-hl-p2-q5`, both primary C4). Re-checking 2016–2019 primaries is a separate task.
