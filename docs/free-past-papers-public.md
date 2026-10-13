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
JOBS=3 npx tsx scripts/publish-free-papers.mts upload /tmp/free-papers
npx tsx scripts/publish-free-papers.mts verify /tmp/free-papers
```

`list` hash-checks every local source inside its binding root. `upload` and `verify` refuse a
work list that doesn't match the committed manifests exactly (hashes, sizes, names, full coverage).
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
