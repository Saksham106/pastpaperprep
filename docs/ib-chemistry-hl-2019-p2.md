# IB Chemistry HL: 2019 Paper 2 questions re-included

October 2026. Branch `feat/ib-chemistry-hl-2019-p2`. **Storage upload done (owner-approved).** Follows `docs/ib-paper-count-gaps-2026-10-21.md`.

## What was added

| | Questions | Marks |
| --- | ---: | ---: |
| 2019 May TZ1 HL Paper 2 | 7 | 90 |
| 2019 May TZ2 HL Paper 2 | 6 | 90 |
| 2019 November HL Paper 2 | 7 | 90 |
| Bank after | 2,036 questions, 93 papers | |

The three papers were already in the runtime paper list with no questions. The 2016–2019 extension had excluded them as "store-truncation: Section B tail (~5 marks) missing from both QP and MS" (`ib-chemistry-topic-practice/data/classification-extension/classification-contract.json`). That does not hold for the pinned PDFs:
- this syllabus has no Section B;
- each question paper runs to printed page 24 of 24 and its question marks sum to 90;
- each mark scheme ends on the paper's last question.

## Sources and crops

- **Inputs:** the source lane at `2eb267c3` (`data/papers-extension/2019-*-hl-p2.json`, `data/segmentation-extension/{question,official-markscheme}-images.json`, `data/classification-taxonomy.json`), each pinned by SHA-256 in `scripts/add-ib-chemistry-hl-2019-p2.mjs`. PDFs: IB Docs, as for every 2016–2019 row.
- **Crop review:** two independent reviewers viewed every crop: 69 question crops and 60 mark-scheme crops. No paper is truncated, and every last question is whole with its mark scheme.
- **May TZ2 mark-scheme re-cut:** that mark scheme stores portrait pages rotated 90° for display. The source lane cut its crops in unrotated coordinates, so all 16 crops lost the Question column and the start of the Answers column.
  - They were re-cut from the same page bounds in display orientation, on the bank's 1.75 px/pt grid, as lossless WebP with content-addressed names.
  - Method check: re-rendering the TZ1 crops this way gives identical sizes and only WebP-level pixel differences (mean 0.2/255).
  - Each re-cut was viewed: every question starts at its own first row with the left columns intact.
  - Manifest: `docs/ib-chemistry-hl-2019-p2/tz2-markscheme-recrops.json`; bytes in `research/ib-chem-hl-2019-p2-tz2-ms-recrop/`.
- Some crops keep a blank "Please do not write on this page" sheet or a header-only strip, as the 2016–2019 extension crops do.

## Tagging

- Two independent passes from the question text, official mark scheme and crops, using the extension's own taxonomy (`classification-taxonomy.json`, SHA-256 `98304b2a…`, the hash the extension receipt pins). The blind pass never saw the primary labels.
- **Primary subtopic:** 17 of 20 agreed. The 3 that differed were adjudicated by marks per topic, then per subtopic (`classification_rules`):
  - May TZ1 Q4 → K1;
  - May TZ2 Q2 → K1 (kinetics 11 of 17 marks);
  - May TZ2 Q4 → A3 (a 6–6 periodicity/redox tie, low confidence).
- **Secondaries:** the union of both passes. **Official 2016 codes:** those both passes gave, kept only when valid and in the primary or a secondary topic.
- Final labels and both passes: `docs/audits/ib-chemistry-hl-2019-p2-review.json`.
- Rows have the 2016–2019 extension shape. They serve the primary subtopic only and keep `secondaryTopics` empty, like every extension row. The extension generator drops Chemistry secondaries for all 1,391 earlier rows too: a separate, pre-existing gap.

## App changes

- `node scripts/add-ib-chemistry-hl-2019-p2.mjs [--check]` appends the 20 rows after the May 2026 rows in `src/data/raw/ib-chemistry-hl.json` (mirrored in `production/`). It records the append in `hl2019Paper2Release` and writes the R2 upload plan.
  - It reads the baseline from `2c974874` and refuses to change any earlier row, paper or header field.
  - `--check` proves a rebuild is byte-identical.
- `sealedRuntimeBytes()` (`scripts/ib-science-receipt-contract.mjs`) strips this append before the May 2026 one, so the 2016–2019 candidate seal still verifies the sealed hashes.
- Catalogue: HL 2,036 questions, 93 papers.
- **Full past papers:** `node scripts/build-ib-chemistry-2026-archive-inventory.mjs`, then

  ```bash
  npx tsx scripts/build-whole-paper-archives.mts --inventory docs/ib-chemistry-may-2026/archive-inventory.json --identity-review <identity-review-case.json with absolute evidence paths> --bank ib-chemistry-hl
  ```

  - The three papers move from held ("inventories do not reconcile") to self-markable, giving 74 reports and 19 held.
  - Three May 2026 entries gain a secondary topic the runtime already carried, and one held 2018 Paper 3 entry gets a new version hash: the archive had lagged the runtime.
  - The PDFs were already published, so no PDF upload is needed.
- No worked explanations exist for these ids.

## Storage

`docs/ib-chemistry-hl-2019-p2/r2-upload-plan.json`: 129 objects, 8,230,568 bytes, bucket `pastpaperprep-assets`, create-only, `image/webp`, `private, max-age=31536000, immutable`. Every key is new (`ib-chemistry-hl/questions/2019-…`, `ib-chemistry-hl/markschemes/2019-…`). 2019 is not an IB Chemistry free year, so nothing goes to Supabase or `pastpaperprep-free`.

**Result (owner-approved, 21 October 2026).** `node scripts/upload-ib-chemistry-hl-2019-p2.mjs`: 129/129 objects checked absent, put and read back by SHA-256 and size; none pre-existing. The log `docs/ib-chemistry-hl-2019-p2/r2-upload-log.jsonl` equals the plan key for key and hash for hash.
