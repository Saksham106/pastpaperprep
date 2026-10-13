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

Copies are byte-for-byte and resumable. Needs `npx wrangler login` and the linked Supabase CLI.

```bash
PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS=true PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED=true \
PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION=true PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED=true \
NODE_ENV=production npm run generate:asset-manifest
# same variables:
NODE_ENV=production npx tsx scripts/list-free-public-assets.mts > /tmp/free/list.tsv
# Supabase banks: bulk copy first (per-file CLI calls are rate limited)
supabase --experimental storage cp -r ss:///question-assets/<bank> /tmp/free/supabase-all/ --linked -j 16
JOBS=3 scripts/copy-free-public-assets.sh /tmp/free/list.tsv /tmp/free download
JOBS=3 scripts/copy-free-public-assets.sh /tmp/free/list.tsv /tmp/free upload
scripts/copy-free-public-assets.sh /tmp/free/list.tsv /tmp/free verify
```

Keep uploads at about 3 parallel jobs: Cloudflare's API throttles faster runs (the script logs
throttled files to `upload-failed.txt`; rerunning skips everything already uploaded).

**If a year stops being free**, delete its files from `pastpaperprep-free` in the same change
(owner approval needed). The build stops listing them, but the bucket would otherwise keep
serving them to anyone with the old link.

## Receipts

- 2026-10-13: bucket created, custom domain connected, 11,556 free files (12 Supabase banks,
  7 R2 banks plus explanations) copied and verified byte-for-byte from the public URL.
