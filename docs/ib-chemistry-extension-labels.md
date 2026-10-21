# IB Chemistry 2016–2019: reviewed labels

October 2026. Secondaries: branch `fix/ib-chemistry-extension-secondaries` (#405, #406). Primaries: branch `fix/ib-chemistry-2016-2019-primaries`.

# Part 1: secondary subtopics

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

- `node scripts/build-ib-chemistry-extension-labels.mjs [--check]` writes `src/data/reviewed-ib-chemistry-extension-labels.json` from the pinned reconciled results, taxonomy, 2019 review manifest, secondaries verification audit and primaries review (Part 2). It refuses any row whose runtime primary does not match its candidate, whose verdicts do not cover its candidates exactly, or that the primaries review does not cover.
- `src/lib/ib-chemistry-labels.mjs` applies it in both the question loader (`normalizeQuestion`) and the public bank index (`scripts/generate-bank-index.mjs`), which the bank page filters on, following the 2020+ convention:
  - `primaryTopic` is the reviewed primary's topic;
  - `subtopics` lists the primary, then the secondary subtopics;
  - `secondaryTopics` lists the distinct topics of those secondaries, excluding the primary topic.

  Each entry is bound to the row's sealed primary topic and subtopic and fails closed. A test compares index and loader labels for every Chemistry question.
- The sealed runtime, storage manifests and candidate seal are byte-identical. No assets change.

# Part 2: primaries

## Problem

1,245 of the 1,391 reconciled primaries came from `auto_rule_match` keyword rules, and the extension's own blind QA agreed on the primary exactly for only 82% of its sample. Examples: a free-radical halogenation filed under fuels, a halogen group trend under electron configurations, `2017-may-tz2-hl-p2-q1` (period 3 oxides) under titrations.

## Review (`docs/audits/ib-chemistry-extension-primaries-review.json`)

Text-only, from each question's accessible text and official mark-scheme transcript. The unit is the identity group (1,379 groups covering all 1,411 rows; HL/SL duplicates share a group).
1. **Blind pass.** Eight reviewers chose a primary for every group without seeing the current label: the subtopic earning the most marks, following the taxonomy's ambiguity rules. They disagreed with the current label on 464 groups.
2. **Adjudication.** The 464 disagreements, plus 59 multi-mark groups a blind reviewer had read only in part, were judged with full text. A near-tie keeps the current label. 372 changes were proposed.
3. **Confirmation.** A third reviewer chose between the current and proposed label, shown in random order, or called a tie.

A primary changes only when the adjudicator and the confirmer both choose the new label: **342 groups (349 rows)**. 21 ties and 9 rejections keep the current label. Of 12 random proposed changes checked by hand against the mark schemes, 10 are clearly right. One, an aspirin purity titration moved from medicinal chemistry to titrations, is defensible either way. The last, a biodiesel equation, was a confirmation tie and kept its label.

A changed primary drops out of the verified secondaries. The old primary becomes a secondary only where the adjudicator found it still earns at least 1 mark on its own. Topic totals move only slightly, for example HL Energetics 228 → 221, HL Measurement and practical work 58 → 69.

## Limits

- Text-only: diagrams and garbled symbols were read from the extracted text, so a row whose marks depend on a figure may be misjudged. Borderline rows err toward keeping the current label.
- Reviewers were language models (blind and confirmation on Sonnet), not a chemistry teacher.
