# Reviewed IB answer-crop repairs (sciences and Economics)

Exact cohort: `ib-chemistry-sl` `2025-may-tz1-sl-p2-q4`, `ib-chemistry-hl` `2023-may-tz2-hl-p2-q6`, and the nine IB Economics questions listed below (13 bank entries). The file keeps its original `ib-science` name and namespace; the mechanism is bank-generic.

## ib-chemistry-sl 2025-may-tz1-sl-p2-q4

Found in the review of PR #295 (2026-10-14).

Pinned official mark scheme PDF SHA-256: `71231276b8148286c7f6ab1c3098fcd49dcd05fa7ce123132e4c083d41257e19` (`../ib-chemistry-topic-practice/data/raw/2025-may-tz1-sl-p2-markscheme.pdf`).

- The first answer crop, `markschemes/2025-may-tz1-sl-p2-q4-page-7.webp` (SHA-256 `9b8492c8bad6c8b9434de6ab5c01e1123aa0f9ffd4d226bfd59501f35176de8a`), starts inside the 4(a)(i) row and omits both catalyst marking points. Segmentation anchored the crop on the row's question label, which this table centres vertically, so the crop began 37 points below the row rule.
- Repair: move the top boundary from 366.006 to 326 PDF points, just above the row rule at 328.92, keeping the width and bottom boundary. Exactly 70 source-owned raster rows are added at the bank's existing 1.75 pixel/point grid (rows 570–639). Every previously decoded RGB pixel is preserved, verified pixel-for-pixel, and the result is saved losslessly. Grid alignment was checked against a fresh render: mean absolute difference 0.21 at offset 0 versus 3.8 or more at ±1 row.
- The page-8 and page-9 crops are unchanged. All three original objects were read from production R2 and matched by full SHA-256 and exact key.
- The candidate, its PNG preview and `candidate.json` (bounds, grid rows and hashes) are kept in `../research/ib-chem-sl-q4-ms-head/`.

## ib-chemistry-hl 2023-may-tz2-hl-p2-q6

Found while writing the 2023 explanations (2026-10-21). Pinned official mark scheme PDF SHA-256: `1380cac4e39c439b4e193f4419e775d18f6a6398943730ff89d5aa7bffc31399` (`../ib-chemistry-topic-practice/data/raw/2023-may-tz2-hl-p2-markscheme.pdf`).

- The page-13 answer crop, `markschemes/2023-may-tz2-hl-p2-q6-page-13.webp` (SHA-256 `52c2fc3453a3e39796db6b23b8bad95fd784c55327ae57f33eb1b521ea368f33`), ends at 526.255 points, above 6(d)(ii)'s final marking line (ΔH «= 4731 – 5994» = −1263 «kJ mol−1», 532.3–545.8 points). Students never saw the third mark.
- Repair: move the bottom boundary to 553 points, just below the row rule at 551.5–552.0, keeping the top and width. Exactly 47 source-owned raster rows are added on the existing 1.75 pixel/point grid (rows 921–967). Every previously decoded RGB pixel is preserved, verified pixel-for-pixel, and the result is saved losslessly. Grid alignment against a fresh render: mean absolute difference 0.115 at offset 0 versus 4.76 at ±1 row.
- The page-14 crop (`…-page-14.webp`, SHA-256 `5156935ea5c7d2e15750e6602d7ce6a99cd5fef5c2f21bafdb3e637b8ed0e1c8`) holds only the page header and the table header above Q7, with no Q6 content, so the repair drops it. The public index answer-image count goes from 3 to 2. The page-12 crop is unchanged.
- All three original objects were read from production R2 and matched by full SHA-256 and exact key. The builder (`build.py`, deterministic), the R2 originals, the candidate, its PNG preview and `candidate.json` are kept in `../research/ib-chem-hl-2023-q6-ms/`.

## IB Economics mark-scheme continuation audit

Found while writing the 2021–2023 Economics explanations (2026-10-21). `../research/ib-economics-ms-continuation-audit/audit.py` maps every served Economics answer crop (210 questions, 76 official mark-scheme PDFs; 2021–2025 from the source workspace's `economics-official-ms-image-manifest.json`, May 2026 from its `may-2026` segmentation manifest) to its source page and bounds. It splits each PDF into consecutive question spans and requires every text line in a span to sit wholly inside one of that question's crops. Page numbers, reference codes and the section headings above the next question ("Section B", "Macroeconomics") are not answer rows. Diagrams are not checked, only text lines.

Nine questions had answer rows students never saw:

| Question | Banks | Gap | Repair |
|---|---|---|---|
| `2021-may-none-hl-p2-q01` | HL | page 7: 1(d) negative impacts list and "Any reasonable evaluation" | add page 7 crop |
| `2021-november-none-hl-p3-q01` | HL | page 7: part (i) [4] and its level descriptors | add page 7 crop |
| `2021-november-none-sl-p2-q01` | SL | page 7: rest of the final evaluation part's costs of subsidies, and "Any reasonable evaluation" | add page 7 crop |
| `2022-may-none-hl-p2-q01` | HL | page 12: rest of the final evaluation part, including the whole "Costs of trade with Japan" list | add page 12 crop |
| `2022-may-none-sl-p2-q01` | SL | page 12: rest of the final evaluation part's list of costs of EU membership | add page 12 crop |
| `2024-may-tz2-hlsl-p2-q01` | HL, SL | page 8: last line cut by the crop's bottom edge | extend bottom |
| `2025-may-tz1-hlsl-p2-q02` | HL, SL | pages 18 and 23: last line cut by the bottom edge | extend both |
| `2025-may-tz3-hlsl-p2-q02` | HL, SL | page 25: last line cut by the bottom edge | extend bottom |
| `2026-may-tz3-hlsl-p2-q02` | HL, SL | page 18: last line cut by the bottom edge | extend bottom |

- Cause: segmentation ended a question on the page before the next question's first page, dropping a continuation above the next question, and fixed answer-crop bottoms at 804 points while some pages print to about 813.
- `build.py` (deterministic) renders repairs with the source pipeline's exact settings (scale 2, full page width, no alpha). A fresh render of an existing crop reproduces the served bytes' pixels exactly.
- Extended crops move only the bottom edge, 4 points below the cut line. The old crop's pixels are verified identical at the top of the new one.
- Added pages run from the pipeline's 42-point top margin to the next question's first crop (or 4 points below the last missing line).
- All 76 distinct old crops (122 objects across both banks) were read from production R2 and match the source manifests' SHA-256. HL and SL copies of each shared crop are identical.
- Candidates, `plan.json`, `report.json` and the R2 originals are kept in `../research/ib-economics-ms-continuation-audit/`.
- Each served Economics row lists its crops in both `markschemeImages` and `officialMarkscheme.images`. The repair binds to the de-duplicated list the runtime serves, and the public index generator now de-duplicates the same way.

## Runtime and storage

`src/data/reviewed-ib-science-crop-repairs.json` is an exact old-path-bound projection keyed by bank. Stale paths fail closed. Runtime normalization applies it only to the banks it lists (`IB_SCIENCE_CROP_REPAIR_BANKS`), so question images and every other question and bank keep their paths. For the SL cohort the public index answer-image count is unchanged (3).

The immutable manifest (one object per replaced crop, with each cohort's provenance) and the full-GET SHA/size receipt are `data/storage/ib-science-crop-repairs.*.json`. Upload (`scripts/upload-reviewed-ib-science-crop-repairs.mjs`, scoped token or `--via-wrangler`) is create-only, re-reads every object in full and never replaces or deletes source objects. It needs owner approval.

Further IB science crop repairs are added to the same file under their bank. New objects share the namespace: keys are content-addressed (`<bank>/repairs/…/<sha256>.webp`), so they cannot collide, and the uploader skips objects already present but still re-reads every one in full.
