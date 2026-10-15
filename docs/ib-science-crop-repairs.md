# Reviewed IB science answer-crop repairs

Exact cohort: `2025-may-tz1-sl-p2-q4`, bank `ib-chemistry-sl`. Found in the review of PR #295 (2026-10-14).

Pinned official mark scheme PDF SHA-256: `71231276b8148286c7f6ab1c3098fcd49dcd05fa7ce123132e4c083d41257e19` (`../ib-chemistry-topic-practice/data/raw/2025-may-tz1-sl-p2-markscheme.pdf`).

- The first answer crop, `markschemes/2025-may-tz1-sl-p2-q4-page-7.webp` (SHA-256 `9b8492c8bad6c8b9434de6ab5c01e1123aa0f9ffd4d226bfd59501f35176de8a`), starts inside the 4(a)(i) row and omits both catalyst marking points. Segmentation anchored the crop on the row's question label, which this table centres vertically, so the crop began 37 points below the row rule.
- Repair: move the top boundary from 366.006 to 326 PDF points, just above the row rule at 328.92, keeping the width and bottom boundary. Exactly 70 source-owned raster rows are added at the bank's existing 1.75 pixel/point grid (rows 570–639). Every previously decoded RGB pixel is preserved, verified pixel-for-pixel, and the result is saved losslessly. Grid alignment was checked against a fresh render: mean absolute difference 0.21 at offset 0 versus 3.8 or more at ±1 row.
- The page-8 and page-9 crops are unchanged. All three original objects were read from production R2 and matched by full SHA-256 and exact key.
- The candidate, its PNG preview and `candidate.json` (bounds, grid rows and hashes) are kept in `../research/ib-chem-sl-q4-ms-head/`.

`src/data/reviewed-ib-science-crop-repairs.json` is an exact old-path-bound projection keyed by bank. Stale paths fail closed. Runtime normalization applies it only to the banks it lists (`IB_SCIENCE_CROP_REPAIR_BANKS`), so question images and every other question and bank keep their paths. The public index answer-image count is unchanged (3).

The immutable one-object manifest and the full-GET SHA/size receipt are `data/storage/ib-science-crop-repairs.*.json`. Upload (`scripts/upload-reviewed-ib-science-crop-repairs.mjs`, scoped token or `--via-wrangler`) is create-only, re-reads every object in full and never replaces or deletes source objects. It needs owner approval.

Further IB science crop repairs can be added to the same file under their bank, with a new namespace when the cohort changes.
