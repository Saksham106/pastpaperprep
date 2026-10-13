# PapaCambridge watermark repairs (May/June 2026 Biology and Chemistry)

Audit and fix, 13 October 2026.

## What was wrong

72 source PDFs carried PapaCambridge's watermark: a tiled diagonal "PapaCambridge" on every page,
a footer ("Licensed for hosting on papacambridge.com only", "Re-uploading, mirroring or re-hosting
this file … is unauthorised and traceable") and a per-file `Trace ID: PC-…`. They are every
May/June 2026 question paper and mark scheme for:

| Bank | Papers | Reaches |
| --- | ---: | --- |
| Chemistry 0620 | 18 (components 11–63) | full papers, and 303 topic questions (1,031 live crops) |
| Biology 0610 | 18 (components 11–63) | full papers only (the topic bank stops at March 2026) |

The ingestion manifest records these as downloaded from `studyhatch.com`, which rehosts
PapaCambridge's watermarked copies. No other IGCSE source was affected: all 4,200+ other files
(0580, 0606, 0610, 0620, 0625, 0654, 0455, every year) were scanned clean of PapaCambridge.

Separately, Best Exam Help stamps a small vertical `bestexamhelp.com` in the right margin of the
**cover page only** of 419 full-paper PDFs (0580 2016–19, all 0606, 0610/0625/0455 2019). No topic
crop includes a cover, so only full papers show it. Left as is for now.

## Clean sources

All 72 replacements came from our usual sources: 70 from Exam Easy
(`https://d.exam-easy.com/pdf/<code>.pdf`), and `0610_s26_qp_12` and `0610_s26_qp_61` from Best Exam
Help, which serves the same bytes for the files both hosts have. Every replacement has:

- no third-party metadata, text, link or stream content (`scripts/scan-source-watermarks.py`);
- the same page count and page sizes as the file it replaces;
- identical horizontal text, word for word on every page, once PapaCambridge's own lines are removed.

The clean PDFs are kept privately in
`../research/papacambridge-clean-20261013/sources/` with `sources.txt` listing each URL.

## Topic crops (Chemistry 0620)

Each live image was re-rendered from the clean PDF with the geometry and renderer that produced
it: base crops (full-page render then crop, lossless WebP), science written-answer repairs (clip
render, lossless) and MCQ answer-row repairs (clip render, WebP quality 90). Scale is 1.5 throughout.

- **Geometry proof:** rendering the watermarked PDFs the same way reproduces all 1,031 live crops at
  the same size; at most 27 pixels per image differ by more than 32 levels (rule-edge anti-aliasing,
  lossy encoding), which rules out any shift.
- **Watermark-only change:** against the live crops, the clean renders get lighter where the
  watermark was. The only darker pixels are 11,445 in `markschemes/0620-2026-s-42/q2-8-1.webp`,
  whose grey answer cells the watermark had lightened; the content is identical.
- Six crops did not touch the watermark and render identically, so they are left alone.

`src/data/reviewed-clean-source-crops.json` maps the other 1,025 live paths to 635 unique
content-addressed objects under `repairs/clean-source-v1-1254528fa2962f5d/`.
`cleanSourceCropPaths` applies it to question and mark-scheme paths after every other reviewed
projection, so signing, viewing and PDF export all use it. Question order, counts and every
non-image field are unchanged (`src/lib/clean-source-crops.test.ts`).

## Full papers

`scripts/build-whole-paper-archives.mts` was re-run for both banks with the original inventory
(rebuilt from the private build receipt) and the 36 pairs pointed at the clean PDFs. Only those
36 entries changed, and only their document hashes, sizes and version. Titles, marks, question
pages, timings and coverage are identical, and the other 594 papers are byte-identical.

## Release order (owner approval for each storage step)

1. Upload the 635 crops with `CLEAN_SOURCE_UPLOAD_CONFIG=<0600 scoped R2 config> npx tsx scripts/upload-clean-source-crops.mts`:
   create-only puts, then a full GET readback into `data/storage/clean-source-crops.receipt.json`.
   It refuses a projection that no longer hashes to its namespace, and reads sources only from inside
   one canonical folder (no symlinks). `WRANGLER=1` re-verifies every object read-only; wrangler has
   no conditional put, so it never uploads.
2. Publish and verify the 72 clean PDFs with the steps in `docs/free-past-papers-public.md`, which
   rewrites `src/data/paper-archive-readback.json`. **Merging the manifest change before this closes
   the whole past-paper library**, because production requires a receipt that matches the manifests.
3. Commit both receipts, then merge.
4. Delete the 72 watermarked PDFs from `pastpaperprep-free` (their old hash URLs stay reachable
   otherwise) and purge them from Cloudflare's cache. The old private crops become unreferenced.

## Receipts

- 2026-10-13: 635 clean crops uploaded through wrangler (absence check, then put) into a new
  content-addressed namespace and read back byte for byte. Review found that check-then-put is not
  atomic, so the uploader now only writes with S3 create-only puts; every object was then re-read
  with the read-only `WRANGLER=1` mode (`data/storage/clean-source-crops.receipt.json`).
- 2026-10-13: 72 clean PDFs published to `pastpaperprep-free`. The publish tool's sources for IB Maths
  (242 PDFs) and 0580 Core (138) had been cleared from a scratch cache, so they were restored by hash:
  IB Maths from `free.pastpaperprep.com`, 0580 Core from the source workspace. `verify` then
  re-downloaded all 4,910 PDFs and matched bytes, type and filename, writing the v3 readback receipt.
- Pending (owner-run, after merge): delete the 72 watermarked PDFs with
  `../research/papacambridge-clean-20261013/delete-watermarked-free-pdfs.sh`, then purge the URLs in
  `purge-urls.txt` from Cloudflare's cache.

## Follow-ups

- The sibling source workspaces still hold the watermarked PDFs and studyhatch provenance
  (`igcse-chemistry-0620-topic-practice/data/raw-extension`, `igcse-biology-0610-topic-practice/research/extension-2026/review-staging`).
  Replace them before any re-ingestion, or the watermark comes back.
- 0620 May/June 2026 MCQ answer-row repairs were held for several papers because the watermark
  broke row detection. They may now pass from the clean PDFs.
