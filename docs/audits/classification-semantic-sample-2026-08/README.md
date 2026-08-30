# Classification semantic sample — August 2026

This is a deterministic, blind, stratified semantic QA audit of the classifications shipped at production commit `124e5c413c34e601a6e9d976e90a3a37ba96bf7b`.

## Design

- **350 questions across all six banks** (about 5% overall).
- **60% deterministic uniform sample** for an unbiased defect estimate.
- **40% risk-enriched sample** balanced across changed, non-high-confidence, and cross-topic records.
- Minimum topic coverage per bank.
- Blind reviewers saw the question, available official markscheme, and controlled taxonomy, but not production labels or risk flags.
- Every disagreement was freshly adjudicated from the staged source images with production and blind outputs treated only as proposals.
- The initial blind packet accidentally exposed an observed union of valid labels rather than canonical topic-to-skill ownership. This did not expose production answers, but it was too permissive: 66 blind rows used a skill under the wrong selected topic, and every one entered the disagreement queue. Initial adjudication resolved 23, carried 43 forward, and introduced one different ownership error. All 44 final ownership violations were freshly image-reviewed again and repaired against the app's canonical taxonomy; the final report fails closed unless every skill is owned by a selected topic.

## Result

**Overall status: `fail-systemic-review-required`**

- Production defects: **153 / 350**
- Uniform-sample defects: **83 / 211 (39.3%)**
- Blind exact matches: **132**
- Fresh adjudications: **218**
- Canonical-ownership repairs after fresh image review: **44**
- Sampled questions without an official markscheme: **4**; those used the question plus the stored independent solution and remain explicitly flagged.

| Bank | Sample | Production defects | Uniform defect rate (95% Wilson CI) | Status |
|---|---:|---:|---:|---|
| IB Mathematics AI HL | 30 | 6 | 27.8% (12.5%–50.9%) | expand-to-10-percent |
| IB Mathematics AI SL | 30 | 11 | 27.8% (12.5%–50.9%) | expand-to-10-percent |
| IB Mathematics AA HL | 43 | 20 | 53.8% (35.5%–71.2%) | fail-systemic-review-required |
| IB Mathematics AA SL | 30 | 13 | 33.3% (16.3%–56.3%) | expand-to-10-percent |
| Cambridge IGCSE Mathematics 0580 | 135 | 74 | 44.4% (34.1%–55.3%) | fail-systemic-review-required |
| Cambridge IGCSE Additional Mathematics 0606 | 82 | 29 | 34.0% (22.4%–47.8%) | fail-systemic-review-required |

## Interpretation

`pass` means no adjudicated primary-topic or taxonomy-gap defect and a uniform defect rate no higher than 5%. `expand-to-10-percent` means the bank needs a larger confirmatory sample. `fail-systemic-review-required` means the sample found at least two primary-topic defects or taxonomy gaps and the bank needs systematic review rather than random spot fixes.

This audit **does not mutate production classifications**. The final report identifies confirmed defects and determines the next review scope. Staged WebP evidence is not duplicated here; `selection-hidden.json` retains the original evidence paths and hashes for reproducibility.
