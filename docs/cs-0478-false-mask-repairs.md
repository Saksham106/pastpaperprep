# Reviewed CS 0478 false-mask repairs

Found 2026-10-20 while writing the 2019–2022 CS explanations: the served crop for `0478-2022-w-23-q4` showed "Complete the trace table for the algorithm using this input data:" followed by a blank gap. Package: `../research/cs-0478-false-barcode-masks/` (`build_mask_repairs.py`, two byte-identical builds).

## Defect

`segment.py` in `../igcse-computer-science-0478-topic-practice` paints white any text block that `is_barcode()` accepts, to hide the machine-readable strip at the page foot. `is_barcode()` accepts a block when more than half its glyphs are above U+2000. Typographic punctuation is above U+2000 too, so these blocks were painted out:

- curly-quoted input data, `“Y”, “Y”, “Y”, “Y”, “Y”, “Y”, “N”` (14 of 27 glyphs are quotes);
- answer lines drawn with ellipsis leaders (U+2026), including the fill-in sentences and printed marks beside them.

| Question | False masks | What was missing |
|---|---|---|
| 0478-2024-s-12-q5 | 3 | Three lines of the fetch-cycle gap fill ("sent to the …", "…, using the") and the printed [7] |
| 0478-2020-w-12-q5 | 1 | An answer line and the printed [5] |
| 0478-2022-w-23-q4 | 1 | The trace-table input data |
| 0478-2024-m-12-q3 | 8 | Answer lines only |
| 0478-2024-s-12-q6 | 2 | Answer lines only |

Marks were always right, because they come from the text layer, not the image.

## Audit

The builder recomputes every mask inside every served CS question crop, in both source lanes (2023–2026 and 2019–2022): 25 masked blocks. The 10 true barcode strips stay masked. The other 15 are false and fall in the five questions above. A block counts as a true barcode only if it still meets the original test after typographic punctuation U+2010–U+2027 is ignored.

## Repair

Each affected crop is re-rendered exactly as `segment.render` does it (scale 1.5, the segmentation's region bounds, lossless WebP method 6), with only the true masks. For every crop the builder proves two things:

1. Re-rendering with the original masks reproduces the served bytes exactly.
2. The repaired crop differs from the served one only inside the false-mask rectangles.

- `scripts/build-reviewed-cs-0478-mask-repairs.mjs <package> [--check]` writes `src/data/reviewed-cs-0478-mask-repairs.json` and `data/storage/cs-0478-mask-repairs.manifest.json`: 5 objects under `igcse-computer-science-0478/releases/full469-v1-0eb04c612b39/repairs/cs-0478-false-masks-v1-1fbb96033e62ff45/`.
- `reviewedCs0478QuestionPaths` (`src/lib/reviewed-cs-0478-mask-repairs.ts`) applies the overlay in the loader. Each entry is bound to the exact raw paths and hashes, so stale input fails closed. Crop counts and marks are unchanged, so the bank index and the explanation publisher need no projection.
- The source workspace is unchanged. Re-segmenting would bring the defect back, so this overlay stays authoritative until `is_barcode()` ignores typographic punctuation.

## Upload (owner approval)

`scripts/upload-reviewed-cs-0478-mask-repairs.mjs` (scoped token or `--via-wrangler`) uploads create-only, re-reads every object in full and writes `data/storage/cs-0478-mask-repairs.receipt.json`.
