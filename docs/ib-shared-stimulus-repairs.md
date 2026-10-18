# Reviewed IB shared-stimulus question-crop repairs

Found 2026-10-18 while writing explanations: `ib-biology-sl` `2020-november-tz0-sl-p1-q1` and `-q2` ask about a micrograph that was not in their crops. 2020 is that bank's free-preview year. Package: `../research/ib-shared-stimulus-audit-20261018/` (audits, `repair/build_repairs.py`, two byte-identical builds).

## Defect

The segmenter starts each crop 8 pt above its question number. A stimulus printed above the first question it serves, with a caption such as "The diagram of a membrane refers to question 3 and question 4", or a Paper 3 data block, then lands in no crop, or only in the crop of the question before it.

| Bank | Paper | Served before | Questions repaired |
|---|---|---|---|
| ib-biology-sl | 2020-november-tz0-sl-p1 | micrograph in no crop | q1, q2 |
| ib-biology-sl, ib-biology-hl | 2017-november-tz0-{sl,hl}-p1 | *Paramecium* image in no crop | q1, q2 |
| ib-biology-sl | 2017-november-tz0-sl-p1 | membrane diagram only in q3's crop | q3, q4, q5 |
| ib-biology-hl | 2017-november-tz0-hl-p1 | membrane diagram only in q2's crop | q2, q3, q4 |
| ib-biology-sl | 2022-november-tz0-sl-p1 | organism diagram only in q1's crop | q1, q2, q3 |
| ib-biology-hl | 2021-may-tz1-hl-p1 | red-blood-cell images at the end of q1's crop; hormone graph only in q23's crop | q1, q2, q3, q23, q24, q25 |
| ib-chemistry-hl, ib-chemistry-sl | 2017-may-tz1-{hl,sl}-p3 | titration data, table and graph in no crop | q1 |
| ib-biology-hl | 2017-may-tz2-hl-p1 | q22 crop stops after its first line (diagram, question and options missing) | q22 |

## Audit

Two read-only checks ran over every IB Biology, Chemistry and Physics question paper with served crops: 2016–2026, base, extension and May 2026 registries.

- `audit_uncovered.py` lists printed text, images and vector drawings on a question page that no served crop covers, ignoring running headers and footers.
- `audit_shared_captions.py` finds every "refers to question(s) N" caption and checks that each named question's crop includes it.

The only other hits are page-header masks, footer barcodes and the 2026 acknowledgements pages. Physics has none.

## Repair

Each stimulus is one crop, full page width, rendered like the segmenter (rotation baked in, 1.75 px/pt). It runs from 6 pt above its caption, or 10 pt above a boxed data block, to the served top of the first question it serves. It is prepended to every question it serves. A crop that held only the stimulus is dropped from the question before it. 2021 q1 is re-cut to end above the stimulus, and 2017 q22 is re-cut down to the top of q23. The builder asserts each boundary against the PDF text: caption or data block inside, no other question number inside, dropped crops hold only header and stimulus. Every kept crop is today's served object, and its hash was recorded from a read-only R2 GET. New crops are lossless WebP, so rebuilds are byte-identical.

- `scripts/build-reviewed-ib-shared-stimulus-repairs.mjs <package> [--check]` writes `src/data/reviewed-ib-shared-stimulus-repairs.json` and `data/storage/ib-shared-stimulus-repairs.manifest.json`. The manifest has 12 objects, 695,450 bytes, under `repairs/ib-shared-stimulus-v1-d53ab265e7e81518`.
- `reviewedIbQuestionPaths` applies the overlay for the banks it lists. It is bound to the exact raw path list, so stale paths throw. The bank index changes only `questionImageCount` for these 23 questions.
- The source workspaces are unchanged. Re-segmenting them would bring the defect back, so this overlay stays authoritative until the segmenter attaches captioned stimuli itself.

## Upload (owner approval)

`scripts/upload-reviewed-ib-shared-stimulus-repairs.mjs` (scoped token or `--via-wrangler`) uploads create-only, re-reads every object in full and writes `data/storage/ib-shared-stimulus-repairs.receipt.json`. With Wrangler the stored Content-Type is not observable and is recorded as such.

## Follow-up

Regenerate the held explanations for `ib-biology-sl` `2020-november-tz0-sl-p1-q1` and `-q2` against the repaired crops. No other repaired question has a published explanation.
