# Biology 0610 historical crop repair (owner-approved, 14 October 2026)

The fix covers the 4,913 finalized rows: 2019, 2020, 2021–2025 and February/March 2026. It uses the method merged for May/June 2026 in PR #282.

Source: `igcse-biology-0610-topic-practice`, branch `fix/0610-historical-crops`. The method record is `docs/historical-crop-repairs-2026-10.md`; the ledgers are `data/segmentation/crop-overrides/{2021-2025,extension-2019-2020-2026}.json`; the package is `data/segmentation/historical-crop-repairs/repairs.json`.

## What was wrong

- **Mark-scheme ownership.** On 2021–2025 written and practical rows, the mark-scheme crop is a whole-page band. On a page shared by two questions it shows the neighbour's rows. The gate flagged 329 of 641 rows, and every one was confirmed on contact sheets. 325 rows held a neighbour's rows. The other 4 (`0610-2022-s-51-q1`, `2022-s-61-q1`, `2023-s-52-q1`, `2023-s-62-q1`) were missing MS page 8, where 1(d) or 1(b) continues.
- **Extension mark schemes.** The 2019, 2020 and February/March 2026 written rows served one-line slivers: only the anchor line of each part, not the answer. Every structured row is rebuilt with the same page-band method. On shared pages the 122 flagged rows are split by row ownership; the rest keep the default band.
- **Cut-off questions.** 20 rows: 8 from 2021–2025 and 12 extension rows.
  - In 19 of them the next question starts mid-page. Each crop now gains the band above that question's anchor.
  - `0610-2020-s-42` is different: Q3's anchor was the axis label `3 hours` on page 6. Q2 now runs over pages 4–10, minus the blank page 10, and Q3 starts on page 11.
- **Also fixed in the same pass:**
  - `0610-2019-s-32-q6`: the answer `6 (g) ;` was read as a row, so Q6's mark scheme also showed Q9's page.
  - `0610-2023-w-31-q2`: a split had cut off the drawn 2(c) answer. Splits now close at the row's own table rule.

## Marks and text

Marks change for one row only. The repaired `0610-2019-s-31-q3` crop shows 3(b)–(c) and the printed `[Total: 10]`, but the bank stored 4. The overlay serves 10, and the paper now sums to 80, the same as the mark scheme. So the old "QP 74 vs MS 80" exception was an artifact of the cut-off.

The `paperException` header in the finalized runtime is historical and unchanged. The other 19 cut-off rows already stored their printed totals.

`accessibleText` and summaries of the 20 cut-off rows still lack the cut-off parts. This text is not changed; it needs owner judgment.

## Delivery: a reviewed overlay

I chose an overlay over rebuilding the runtime. The 4,913 rows are a frozen, finalized baseline. Their runtime, the storage manifest/receipt pair and the private-index prefix are pinned by the May/June addition proof, by the Pollution and secondaries reseals, and by the written-answer repair test. The overlay leaves all of them byte-identical, as the written-answer repair did.

- `src/data/reviewed-biology-historical-crop-repairs.json`: for each question it maps the exact live crop list to the repaired list. Kept crops keep their released key. New crops use `repairs/historical-crops-v1-08cb6b182b98620f/<sha256>.webp`, where the namespace is taken from the package SHA-256.
- `src/lib/reviewed-biology-historical-crops.ts` applies it in `normalizeQuestion`, so the viewer, signer, PDF export, asset manifest and free index all use it:
  - question crops, after the BLANK PAGE and furniture projections;
  - mark schemes, through `reviewedMarkschemePaths`;
  - marks.
- `scripts/generate-bank-index.mjs` mirrors the image counts and marks.
- It fails closed on any other old list, on a hash-shaped mismatch, or if a question also has a written-answer repair.
- The 182 rows already served by the written-answer repair keep it. All 163 of its 2021–2025 rows were among the 329 flagged, and its source-grid bands carry only their own labels; the evidence is the source-grid audit plus a visual sample.

Counts:

| | 2021–2025 | Extension |
|---|---|---|
| Mark-scheme lists | 166 | 253 |
| Question-paper lists | 8 | 13 |
| Marks | – | 1 |

That is 425 questions in total.

## Storage

The upload plan is `data/storage/biology-historical-crop-repairs.manifest.json`: 626 new objects (9,519,292 bytes) plus 165 kept released objects.

The 626 objects were uploaded create-only with the logged-in wrangler CLI, at concurrency 2 with backoff. For each object:

1. The key was checked absent first: `get` exits 1 with "The specified key does not exist".
2. It was uploaded with `--remote`, `image/webp` and `private, max-age=31536000, immutable`.
3. It was read back and compared by SHA-256 and size.

The readback log is `docs/0610-historical-crops-r2-upload-log.jsonl`, with one `verified` line per object.

`data/storage/biology-historical-crop-repairs.receipt.json` is `verified_readback`. New objects are covered by the readback log, and the 165 kept objects by the finalized release receipt (`155a454e…`, manifest `651baec5…`), byte-identical.

Nothing was overwritten or deleted. The 1,848 released keys that the overlay stops serving are listed in `docs/0610-historical-crops-superseded-keys.json`. They stay in the bucket and in the finalized release manifest; deleting them needs owner approval.

Free-year (2021) rows with new crops are not in the public `pastpaperprep-free` bucket yet. Until `scripts/publish-free-assets.mts` is re-run (owner action), the bank page falls back to `/api/assets/free` for those images.

## Release state

0610 stays finalized: runtime `495712c9…`, content `6606b21c…`, manifest `651baec5…` and receipt `155a454e…` are unchanged, and so are the seals in `src/lib/igcse-runtime.ts`.

The overlay's own seals are in `src/lib/reviewed-biology-historical-crops.test.ts`:

- the package SHA-256 and namespace;
- the runtime and release-pair SHA-256s;
- the manifest and receipt binding;
- the readback-log SHA-256.

## Reproduce

```bash
# source repo (see its docs/historical-crop-repairs-2026-10.md): ledger runs, then
$PY scripts/build_historical_crop_repairs.py --base-run <run> --ext-run <run> --check
# app
PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT=<source checkout> node scripts/build-0610-historical-crop-repairs.mjs --check
```
