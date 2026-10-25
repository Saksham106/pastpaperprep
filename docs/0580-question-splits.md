# Reviewed 0580 question split: 0580-2020-june-41 Q6/Q7

Found 2026-10-25 while checking the 0580 2020 explanations. The Q6 explanation needs 10 marks, but the runtime row says 3. An earlier math-aware audit had already recorded the same defect from the original PDF (`research/pastpaperprep-math-aware-repair-20261001/final-closure-v4/0580-2020-june-41-q6-pdf-parent-adjudication.json`), but the crop was never repaired.

## Defect

On question-paper page 11, the 6(c) grid's y-axis label "7" sits in the question-number column (x≈61). The crop builder took it as the Question 7 heading, which caused two errors:

- **Q6** (`questions/0580-2020-june-41-q6.webp`) stopped part-way down the 6(c) grid and was served with 3 marks.
- **Q7** (`questions/0580-2020-june-41-q7.webp`) began with the rest of 6(c) and all of 6(d), and was served with 24 marks.

The paper still totalled 130, which is why the marks census did not catch it. The real Question 7 heading is at the top of page 12 (y = 60.62). The question paper (SHA-256 `53144f65…a710`, Best Exam Help, the manifest's pinned source) prints:

- Q6 as [1] + [2] + [5] + [2] = 10;
- Q7 as [3] + [3] + [3] + [2] + [3] + [3] = 17.

The mark-scheme crops were already split correctly: Q6 covers rows 6(a)–6(d), and Q7 starts at 7(a).

A census of every 0580 transcript that opens with a number other than its own question number found no other boundary error of this kind. The four other hits begin with text-layer page numbers or diagram labels ahead of the heading.

## Repair

The source repository (`igcse-0580-topic-practice`, branch `fix/0580-2020-june-41-q7-boundary`) adds one reviewed entry to `data/crop-boundary-overrides.json` that pins Question 7 to page 12, y = 60.62. Rebuilding that paper changes only:

- the Q6 and Q7 question crops (1070×3078 and 1070×3079, pages 10–11 and 12–13);
- their transcripts in `data/papers/0580-2020-june-41.json`.

The other 18 crops of the paper are reused byte-for-byte.

`scripts/build-reviewed-0580-question-splits.mjs <source checkout> [--check]` writes:

- `src/data/reviewed-0580-question-splits.json`;
- `data/storage/0580-question-splits.manifest.json`: 2 objects, 213,532 bytes, under `repairs/0580-question-split-v1-4cb1bf3ffe1503f9`.

The overlay is bound to the raw paths, marks and text hash, and is applied in four places:

- question paths, marks and text in `src/lib/questions.ts`;
- print geometry in `src/lib/print-geometry.ts`;
- marks in the public index (`scripts/generate-bank-index.mjs`);
- the explanation publisher's marks check.

The raw bank, the historical print geometry and every sealed 0580 receipt are unchanged. The superseded objects stay in the bucket, unreferenced.

## Upload (owner approval)

`scripts/upload-reviewed-0580-question-splits.mjs --source <checkout> --via-wrangler` uploads create-only, re-reads both objects in full and writes `data/storage/0580-question-splits.receipt.json`.

## Follow-up

- After this ships, clear `needs_review` on the held Q6 and Q7 explanations, re-verify them against the re-cut crops and publish them.
