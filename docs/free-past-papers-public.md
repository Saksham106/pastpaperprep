# Free past-paper PDFs on free.pastpaperprep.com

Whole past papers (question paper + mark scheme) are served straight from the public R2 bucket
`pastpaperprep-free` at `https://free.pastpaperprep.com/papers/v1/<sha256>.pdf`. Paper pages link
there directly, so opening, reading or downloading a paper never runs a Vercel function. The
`/past-papers/<subject>/<paper>/document` route only serves local preview (`LOCAL_PAPER_PREVIEW`).

Never put these PDFs in the private `pastpaperprep-assets` bucket, and never make that bucket public.

## How it fits together

- `src/data/paper-archives/<bank>.json` lists every approved PDF by SHA-256 and size.
- `src/data/paper-archive-readback.json` (committed) records a digest of that whole set, written only
  after every object was downloaded from `free.pastpaperprep.com` and matched byte for byte.
- Production shows the library only with `PAPER_ARCHIVE_ENABLED=true`,
  `PAPER_ARCHIVE_STORAGE_VERIFIED=true` and a receipt that matches the current manifests. Any
  manifest change closes it until the papers are re-published and re-verified.
- Objects carry `Content-Disposition: attachment; filename="0580_s23_qp_42.pdf"` (IB:
  `ib-math-aa-hl-2021-may-paper-1-tz1_qp.pdf`), because browsers ignore `download=` on
  cross-origin links. The reader fetches with pdf.js, which the header does not affect.
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

`list` hash-checks every local source. `upload` keeps to about 3 parallel puts (Cloudflare
throttles faster runs), retries failures, and skips anything already uploaded when rerun.
`verify` downloads every object through Cloudflare DNS-over-HTTPS and writes the receipt only if
all match; commit the receipt with the change that needs it.

**If a paper stops being free**, delete its object from `pastpaperprep-free` in the same change
(owner approval needed). Removing it from a manifest alone leaves the old link working.
