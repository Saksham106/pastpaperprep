# IB maths: mark-scheme rows served to the wrong question

**Date:** 2026-10-24. Banks: `ib-hl` (AA HL) and `ib-ai-hl` (AI HL). Found by the read-only row-ownership audit in
`research/ib-hl-ms-crop-audit-20261024/`.

## Defect

In two schemes the segmenter (`normalize_and_build_crops.py` in the IB maths workspaces) read a **subscript** as a
question heading. This is the same mechanism as the Biology P3 repair in `docs/ib-question-boundary-repairs.md`.

| Question | Served today | Cause |
|---|---|---|
| `ib-hl` `2021-may-tz1-p1-q1` | `…q1-page-8.webp` (`ceaa9ac3…`, 1042×149): only Q2's last row, `u1 = -6, d = 2 A1A1 [5 marks]` | An earlier anchor pass read the "1" of u₁ (page 8, y 737.589) as Q1's heading. Its top is that y less 8pt. |
| `ib-hl` `2021-may-tz1-p1-q2` | `…q2-page-8.webp` (`b804ae98…`, 1042×1347): all of page 8, Q1 included | Same pass. |
| `ib-ai-hl` `2024-may-tz1-p3-q1` | Pages 7–10, stopping at page 10 y 147.3: loses the (h) hypotheses, p-value and conclusion, and all of (i) | The "2" of µ₂ (page 10, x 130) read as Q2's heading. |
| `ib-ai-hl` `2024-may-tz1-p3-q2` | Pages 10–14, starting mid-sentence with Q1's (h) and (i) rows | Same. |

Both source PDFs are correct: `M21/5/MATHX/HP1/ENG/TZ1/XX/M` (26 pages, SHA-256 `774a9e21…`) and
`2224 – 7203M` May 2024 AI HL Paper 3 (14 pages, `70102883…`). For ib-hl the workspace manifest already has the right
bounds. The shipped WebPs are stale because the segmenter only renders a missing file. The ib-hl transcripts and
the four published explanations were written from the PDF, not the crops.

## Audit

`scripts/build-ib-maths-ms-row-repairs.py` reads the printed question labels in the left margin (x < 50, body size, so
subscripts never qualify). It gives every other line to the label before it, judged by the line's middle. Every line
must lie inside its owner's crops and inside no other question's crops. Today's crops fail exactly here (line counts):

- ib-hl p8: 32 Q1 lines outside Q1's crop and inside Q2's; 9 Q2 lines inside Q1's.
- ib-ai-hl p10: 67 Q1 lines and p11: 15 Q1 lines, outside Q1's crops and inside Q2's.

The repaired crops pass. The printed part marks inside each repaired answer sum to the question's marks: 5, 5, 26, 29.

## Repair

Crops follow the segmenter's own rules with the true labels: full page width, the start page from 8pt above the
label, continuation pages from 45pt, and the page bottom at height − 28 (these pages have no footer furniture), at
1.75x. That renderer reproduces all 10 correctly bounded served crops, and the stale ib-hl Q1 crop, byte for byte
from the pinned PDFs (q90 WebP). A crop whose bounds are already right is kept. New crops are lossless WebP.

| Question | New answer images |
|---|---|
| `ib-hl` `2021-may-tz1-p1-q1` | p8 102.269–529.159 → `b31d56c0…` 1042×749 |
| `ib-hl` `2021-may-tz1-p1-q2` | p8 529.159–814.04 → `0313b980…` 1042×499 |
| `ib-ai-hl` `2024-may-tz1-p3-q1` | p7–p9 kept; p10 45–814.04 → `6948dd38…`; p11 45–814.04 → `eef7ce66…` (4 → 5 images) |
| `ib-ai-hl` `2024-may-tz1-p3-q2` | p12 76.661–814.04 → `7c2a7bd1…`; p13–p14 kept (5 → 3 images) |

- Package: `research/ib-maths-ms-row-repair-20261024/` (`served/` holds today's R2 objects as read back with
  wrangler; `build-a` and `build-b` are two byte-identical builds; `preview/` has PNGs of the new crops).
  Python 3 with pymupdf and pillow:
  `python -I scripts/build-ib-maths-ms-row-repairs.py research/all-bank-crop-repair-20261002/ib-maths/source-cache <package>/served <package>/build-a`
- `node scripts/build-ib-maths-ms-row-repairs.mjs <package> [--check]` writes
  `src/data/reviewed-ib-maths-ms-row-repairs.json` and `data/storage/ib-maths-ms-row-repairs.manifest.json`: 5 objects,
  139,734 bytes, under `repairs/ib-maths-ms-rows-v1-34ef8561fff49920`. Each entry is bound to the raw paths and to
  the SHA-256 of the object R2 serves today.
- `reviewedMarkschemePaths` checks this overlay before the sealed `ib-boundary-batch-v1` (ib-hl) and
  `ib-matrix-head-v1` (ib-ai-hl) overlays, which it never shares a question with. Stale paths or hashes throw. The
  index generator projects the same counts. The sealed overlays, manifests and receipts are unchanged; their tests
  skip these four IDs.

## Upload (owner approval)

`WRANGLER_BIN=<wrangler> node scripts/upload-reviewed-ib-maths-ms-row-repairs.mjs <package>` (`--dry-run` checks
locally). It is create-only, uses the single-writer lock, re-reads every object in full and writes
`data/storage/ib-maths-ms-row-repairs.receipt.json`. Premium IB maths assets sign from R2, and 2021/2024 are not
free years (ib-hl 2017, ib-ai-hl 2021), so nothing goes to Supabase or the public bucket. The superseded objects
stay in place.

Result (2026-10-24, owner approved, wrangler 4.151.0 logged in): **5 created (each key absent at its check), 0
already present; 5/5 readback match**, 139,734 bytes. The writer lock was held for every row and released. The
superseded objects stay in place: `ib-hl/markschemes/2021-may-tz1-p1-q{1,2}-page-8.webp` and
`ib-ai-hl/markschemes/2024-may-tz1-p3-q1-page-10.webp`, `…-q2-page-{10,11,12}.webp`.

## Follow-ups

- The ib-ai-hl transcripts have the same misassignment. Q1's `markschemeTranscript` stops inside (h), and Q2's
  starts with Q1's (h) remainder and (i). The crops are what students see; the transcripts are not changed here.
- Re-check the two ib-ai-hl explanations against the repaired schemes once the crops are live.
