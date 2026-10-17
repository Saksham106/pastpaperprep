# Reviewed Coordinated Sciences 0654 mark-scheme row repairs

## Defect

Some 0654 written-paper answer crops (components 3–6) stop part-way through a mark-scheme table row, or leave out a row that continues on the next page. Students see the answer without its later marking points. The original segmentation ended a crop at the row's first text block. The 2026-10-02 source-grid repair (`docs/science-written-answer-source-repairs.md`) held these questions back: a second table on the same page repeats the "Question | Answer | Marks" header, and its detector read that header as an ambiguous owner.

## Audit

Every served 0654 written answer, all years, was exported through the app's own loader (all overlays applied) and checked against the pinned mark-scheme PDF. Audit package: `../research/0654-ms-crop-audit-20261017/` (`table_rows.py`, `audit.py`, `build_repairs.py`).

- A row is the band between two table-wide rules. Its owner is the number printed in the Question column. An unlabelled row continues the previous owner. Repeated header rows are owned by nobody. May/June 2020 pages are rotated and lighter-ruled; both are handled. Printed label typos (`3d(ii)`, `88(c)`) are logged and kept in question order.
- Served crop geometry comes from the release geometry registry (checked against the storage manifest SHA-256) and, for questions already repaired on 2026-10-02, from the source-grid records. Every source PDF is SHA-pinned.
- Result: 1,442 written questions; 1,208 complete, 234 with missing rows, 0 unsupported. No served crop contains another question's row. All 714 questions repaired on 2026-10-02 are complete.
- The 234 by year: 2020 67, 2021 30, 2022 32, 2023 21, 2024 40, 2025 44. By paper: 3x 78, 4x 104, 5x 27, 6x 25. They miss 243 rows: 239 shown in part, and 4 continuation rows on a page with no served crop (`0654-2020-summer-63-q2`, `0654-2022-march-62-q4`, `0654-2022-summer-53-q4`, `0654-2022-winter-62-q3`).

Pinned inputs: runtime `b0973510a204…`, served export `d94f4e5eabe0…`, audit `11201e0c9d29…` (full hashes in the overlay's `source` and the package).

## Repair

Each repaired question gets new crops of its own table rows: rows that touch on one page become one crop at table width, rendered at the release scale (1.5) as lossless WebP and named by content SHA-256. Each replacement was re-audited (every own row covered, no other question's row), and two independent builds were byte-identical. 234 questions, 442 image references, 402 unique objects, 4,046,612 bytes.

- `scripts/build-science-ms-row-repairs.mjs <repairs.json> [--check]` writes `src/data/reviewed-science-ms-row-repairs.json` (exact old paths → new paths, with SHA-256) and `data/storage/science-ms-row-repairs.manifest.json`. It checks that every old path is the runtime's current answer list and the released object, and that no question is already in the 2026-10-02 overlay.
- `reviewedMarkschemePaths` applies the overlay after the 2026-10-02 one. Stale old paths throw. The runtime dataset, question images and every other question are unchanged.
- The public bank index changes only `markschemeImageCount`, for the 4 questions whose crop count changed. Emptying the overlay reproduces the previous index hash (`c3e40d0dc8ba`).

## Upload (owner approval)

`scripts/upload-reviewed-science-ms-row-repairs.mjs` (scoped token or `--via-wrangler`) uploads create-only under `repairs/science-ms-rows-v1-1bcc1003fd8374fe/`, re-reads every object in full and writes `data/storage/science-ms-row-repairs.receipt.json`. Existing objects are never replaced or deleted.

30 repaired questions (59 new crops) are in the free years, so after the private upload re-run `scripts/publish-free-assets.mts` (see `docs/free-public-assets.md`) to copy them to `pastpaperprep-free`. Until then the bank page falls back to signed links for those questions.

## Question-paper crops

`qp_audit.py` (same package) checked every served written question crop against its pinned question paper: all 8,616 printed mark brackets "[n]" lie inside exactly one question's crops, none outside and none shared, and each question's covered brackets equal its marks (two planning questions print only "[Total: 7]", also inside the crop). No question-paper repair is needed. This checks marked parts, not every figure or line of stem.

## Not covered

- Chemistry 0620 and Physics 0625 held 603 and 572 written answers on 2026-10-02 for the same detector reason. They are not audited here.
- The 29 held 0654 explanations were written against the cut-off crops; re-check them once this is live.
