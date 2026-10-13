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
rules (no hand-edited list), refuses unsafe paths, seals every download (SHA-256 and size), uploads
only the sealed bytes, logs path+hash so changed bytes upload again, and exits nonzero unless every
phase covered exactly the free set. Needs `npx wrangler login` and the linked Supabase CLI.

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
