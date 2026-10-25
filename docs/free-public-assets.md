# Free-year assets on free.pastpaperprep.com

Free-year question images, mark schemes and worked explanations are served from the public R2
bucket `pastpaperprep-free` at `https://free.pastpaperprep.com/images/<private path>`, so free
visitors never run a Vercel function. Paid assets stay in the private `pastpaperprep-assets`
bucket (and Supabase) behind `/api/assets/sign`; the public bucket never holds them.

## How it fits together

- `npm run build` runs `generate:free-asset-index` after `generate:asset-manifest`. It writes
  `public/free-assets/<bank>.json`: each free question's public links and free-visitor details.
  It fails if a question outside the free years would be listed.
- The bank page reads that file. A question it doesn't list, or a public image that fails to
  load, falls back to `/api/assets/free`, which signs from the private stores as before.
- DNS for `pastpaperprep.com` is on Cloudflare (registration stays at Porkbun). `free` is the
  R2 custom-domain record and must stay **proxied**. The bucket's CORS rules match the private
  bucket's.

## After adding free questions or changing the free years

`scripts/publish-free-assets.mts` computes the free set itself from the manifests and the free-year
rules (no hand-edited list), refuses unsafe paths and symlinks anywhere in the work folder, seals
every download (SHA-256 and size), re-checks each file against its seal before reusing it or
trusting the resume log (path+hash+size), stages uploads in a fresh private temp folder, rejects a
`JOBS` outside 1–32, and exits nonzero unless each phase actually completed the whole free set
(`scripts/lib/safe-files.ts`). Needs `npx wrangler login` and the linked Supabase CLI.

```bash
export PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS=true PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED=true \
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION=true PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED=true NODE_ENV=production
npm run generate:asset-manifest
# Supabase banks: bulk copy first (per-file CLI calls are rate limited), from the linked checkout
supabase --experimental storage cp -r ss:///question-assets/<bank> /tmp/free/supabase-all/ --linked -j 16
SUPABASE_WORKDIR=<linked checkout> npx tsx scripts/publish-free-assets.mts download /tmp/free
npx tsx scripts/publish-free-assets.mts upload /tmp/free     # about 3 parallel; Cloudflare throttles faster runs
npx tsx scripts/publish-free-assets.mts verify /tmp/free     # every object from free.pastpaperprep.com
```

### R2-backed files: copy inside Cloudflare

Every R2-backed bank's free files (the IGCSE release banks, IB CS, IB Economics and, since
October 2026, the IB sciences) can skip the download/upload round trip. A one-off Worker
(`scripts/free-copy-worker/`) copies them from `pastpaperprep-assets` to `pastpaperprep-free`
inside Cloudflare. The free set is bundled into the Worker as its allowlist, so it can copy
nothing else. Writes are atomically create-only: R2 evaluates `If-None-Match: *` as part of the
write, so an existing object is never replaced, even one created mid-run. Before copying anything,
`copy` asks the Worker to prove this on a scratch key (`_copy-selftest/`, deleted straight away)
and stops if the proof fails. Each answer carries the file's SHA-256, so `verify` can check the
public copy. The run fits the Workers and R2 free tiers.

```bash
ONLY_SOURCE=r2 npx tsx scripts/publish-free-assets.mts copy-deploy /tmp/free-copy   # owner approval: deploys a Worker
ONLY_SOURCE=r2 npx tsx scripts/publish-free-assets.mts copy /tmp/free-copy          # owner approval: writes to the bucket
ONLY_SOURCE=r2 npx tsx scripts/publish-free-assets.mts verify /tmp/free-copy
npx tsx scripts/publish-free-assets.mts copy-delete /tmp/free-copy
```

Files are cached at Cloudflare's edge for up to a week. **If you replace an existing object** (same
path, new bytes or headers), purge those URLs in Cloudflare (Caching → Configuration → Custom Purge)
before `verify`, or it will read the old copy.

**If a year stops being free**, delete its files from `pastpaperprep-free` in the same change
(owner approval needed). The build stops listing them, but the bucket would otherwise keep
serving them to anyone with the old link.

## Receipts

- 2026-10-13: bucket created, custom domain connected, 11,556 free files (12 Supabase banks,
  7 R2 banks plus explanations) copied and verified byte-for-byte from the public URL.
- 2026-10-13: after the review fixes, the existing copies were sealed and the new `verify` read all
  11,556 back from the public URL: 11,556 of 11,556 matched.
