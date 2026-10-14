# Free past-paper PDFs on free.pastpaperprep.com

Whole past papers (question paper + mark scheme) are served straight from the public R2 bucket
`pastpaperprep-free` at `https://free.pastpaperprep.com/papers/v1/<sha256>.pdf`. Paper pages link
there directly, so opening, reading or downloading a paper never runs a Vercel function. The
`/past-papers/<subject>/<paper>/document` route only serves local preview (`LOCAL_PAPER_PREVIEW`).

Never put these PDFs in the private `pastpaperprep-assets` bucket, and never make that bucket public.

## How it fits together

- `src/data/paper-archives/<bank>.json` lists every approved PDF by SHA-256 and size.
- `src/data/paper-archive-readback.json` (committed) records a digest of that whole set and a seal
  of which PDF serves each bank/paper/role (question paper or mark scheme). It is written only after
  every object was downloaded from `free.pastpaperprep.com` and matched byte for byte, filename
  included, and the manifests didn't change during the run.
- Production shows the library only with `PAPER_ARCHIVE_ENABLED=true`,
  `PAPER_ARCHIVE_STORAGE_VERIFIED=true` and a receipt that matches the current manifests. Any
  manifest change, including swapping two documents, closes it until the papers are re-published and
  re-verified.
- Objects carry `Content-Disposition: attachment; filename="0580_s23_qp_42.pdf"` (IB:
  `ib-math-aa-hl-2021-may-paper-1-tz1_qp.pdf`), because browsers ignore `download=` on
  cross-origin links. A PDF shared by IB HL and SL papers carries a level-neutral name
  (`ib-economics-2024-may-paper-2-tz1_qp.pdf`). The reader fetches with pdf.js, which the header
  does not affect.
- A Cloudflare response-header Transform Rule on the `pastpaperprep.com` zone sends
  `X-Robots-Tag: noindex` for `free.pastpaperprep.com/papers/*`, so search lands on the paper
  pages rather than the bare PDFs. It does not touch `images/`.

## Publishing (owner approval required: this publishes the PDFs)

Needs `npx wrangler login` and the private source bindings from the archive build.

```bash
npx tsx scripts/publish-free-papers.mts list private/paper-archives/source-bindings.json /tmp/free-papers
JOBS=3 npx tsx scripts/publish-free-papers.mts upload private/paper-archives/source-bindings.json /tmp/free-papers
npx tsx scripts/publish-free-papers.mts verify private/paper-archives/source-bindings.json /tmp/free-papers
```

`list` hash-checks every local source inside its binding root. Rows keep the binding root and a
plain relative path, and `upload` and `verify` refuse a work list that doesn't match the committed
manifests and bindings exactly (hashes, sizes, names, sources, full coverage). Sources are read
without following symlinks below the canonical root, staged copies go to a fresh private temp
folder, and a symlinked work file or a `JOBS` outside 1–32 stops the run
(`scripts/lib/safe-files.ts`).
`upload` hash-checks a staged copy of each source and uploads that copy, so a file changed after
`list` is refused, keeps to about 3 parallel puts (Cloudflare throttles faster runs), retries
failures, and skips only objects already uploaded with the same name. `verify` downloads every
object through Cloudflare DNS-over-HTTPS, checks bytes, type and filename, and writes the receipt
only if all match. Every phase exits nonzero on any failure. Commit the receipt with the change
that needs it.

Objects are cached at Cloudflare's edge for up to a week. **If you replace an existing object**
(same hash, new filename or headers), purge those URLs in Cloudflare (Caching → Configuration →
Custom Purge) before `verify`, or it will read the old copy.

**If a paper stops being free**, delete its object from `pastpaperprep-free` in the same change
(owner approval needed). Removing it from a manifest alone leaves the old link working.

## Receipts

- 2026-10-13: 4,910 PDFs (3.88 GB) uploaded and verified byte for byte from
  `free.pastpaperprep.com`. The first readback caught one object (`0620_m21_ms_62.pdf`) whose
  public download stopped at 128 KiB although R2 held the full file; re-uploading it fixed it, and a
  second complete readback passed. Noindex rule added the same day.
- 2026-10-13, review fixes: the 16 PDFs shared by IB Economics HL and SL were re-uploaded with
  level-neutral filenames and purged from Cloudflare's cache; a third complete readback (bytes,
  type and filename) passed for all 4,910 and wrote the v3 receipt with the bank/paper/role seal.
- 2026-10-13, PapaCambridge repair (#278): the 72 May/June 2026 Biology 0610 and Chemistry 0620
  PDFs were replaced with clean copies; all 4,910 re-verified.
- 2026-10-14, missing papers: four papers that were left out are added (8 PDFs), and all 4,918
  re-verified.
  - IB Biology May 2022 Paper 1 (HL TZ2, SL TZ1, SL TZ2): IB Docs serves those mark schemes with
    21 junk bytes before `%PDF-`, so the builder rejected them. Stripping only that prefix gives the
    IB's own files (Word/Distiller producers, no repair, text identical). The papers.xtremepape.rs
    copies first used here carry an `xtremepape.rs` footer drawn as vector outlines, so they were
    replaced; `scan-source-watermarks.py` now flags such margin stamps.
- 2026-10-14, xtremepape.rs footers: 167 Chemistry 0620 full-paper PDFs (mostly 2019-2020) carried a
  vector-drawn `https://xtremepape.rs/` footer on every page. Topic crops were unaffected (all crops
  end above the footer). 152 were replaced with Cambridge originals from Exam Easy and Best Exam Help.
  For 15, every copy found was stamped (Best Exam Help on every page, Dynamic Papers, or Exam Easy's
  regenerated FPDF files), and one Exam Easy copy (0620_s19_qp_21) broke question extraction. For
  those 16, only the footer block was removed from our existing copy, and every rendered pixel
  outside the footer was checked to be unchanged. Only document hashes changed, and all 4,918 PDFs
  were re-verified.
  - 0580 June 2021 Paper 33: its sources were missing locally. Cambridge's published mark scheme
    prints `0580/31` on every page, but it is a different file from the 0580/31 scheme and its
    answers match 0580/33. It was accepted through a reviewed identity case (category
    `published-component-label`) in `private/paper-archives/identity-review.json`.
  - The publish tool's IB Maths and 0580 Core sources live in
    `../research/papacambridge-clean-20261013/restored/`, restored by hash after a scratch cache
    was cleared.
