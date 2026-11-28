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

Every R2-backed bank's free files (the IGCSE release banks, IB CS, IB Economics, the IB sciences and the A Level banks) can skip the download/upload round trip. A one-off Worker
(`scripts/free-copy-worker/`) copies them from `pastpaperprep-assets` to `pastpaperprep-free`
inside Cloudflare. The free set is bundled into the Worker as its allowlist, so it can copy
nothing else. Writes are atomically create-only: R2 evaluates `If-None-Match: *` as part of the
write, so an existing object is never replaced, even one created mid-run. Before copying anything,
`copy` asks the Worker to prove this on a scratch key (`_copy-selftest/`, deleted straight away)
and stops if the proof fails. Each answer carries the file's SHA-256, so `verify` can check the
public copy. The run fits the Workers and R2 free tiers.

Two scripts drive it. Both need explicit owner approval for deploy, copy and delete, asked in the session that runs them.

**Live banks** (`scripts/publish-free-assets.mts`, free set computed from `getAvailableBanks()`):

```bash
ONLY_SOURCE=r2 npx tsx scripts/publish-free-assets.mts copy-deploy /tmp/free-copy   # owner approval: deploys a Worker
ONLY_SOURCE=r2 npx tsx scripts/publish-free-assets.mts copy /tmp/free-copy          # owner approval: writes to the bucket
ONLY_SOURCE=r2 npx tsx scripts/publish-free-assets.mts verify /tmp/free-copy
npx tsx scripts/publish-free-assets.mts copy-delete /tmp/free-copy
```

**Any bank, including held (`pendingStorage`) banks** (`scripts/free-copy/free-copy.mts`, `--bank` is repeatable). The publish script skips held banks, so use this one to publish a bank's free files before it launches. It lists the files with the app's own `listFreePublicAssets`, so the set matches what the site will link to. Logs, the Worker secret and the receipt go to `--out` (default `~/.cache/ppp-upload-work/free-copy/<bank>`), which must be outside the repo. Pass the same `--bank` list (or the same `--out`) to every step; a step without either stops.

```bash
# Held banks only: the full `npm run generate:asset-manifest` skips them, so generate theirs first, with the
# production release flags (as a launch build sees the bank). Not PASTPAPERPREP_PREVIEW_PENDING_BANKS: the dev-only
# preview gives a held release-lane bank local `/questions/...` paths, and `list` stops with "unsafe asset path".
export NODE_ENV=production PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS=true PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED=true
mkdir -p generated/asset-manifest generated/question-search
npx tsx scripts/generate-asset-manifest.mts --bank <slug>     # writes generated/asset-manifest/<slug>.production.json
# Run `list` and every later command with the same env, so the manifest name matches
npx tsx scripts/free-copy/free-copy.mts list   --bank <slug>   # offline: writes free-list.json and prints counts
npx tsx scripts/free-copy/free-copy.mts deploy --bank <slug>   # owner approval: deploys, waits for 403, bundles the list
npx tsx scripts/free-copy/free-copy.mts copy   --bank <slug>   # owner approval: waits for 403, self-test, create-only copy
npx tsx scripts/free-copy/free-copy.mts verify --bank <slug>   # every path from free.pastpaperprep.com vs the private hash
npx tsx scripts/free-copy/free-copy.mts delete --bank <slug>   # deletes, then confirms the Worker no longer answers (keeps its config until then)
```

A live bank needs no held-bank env; generate its manifest as in the first block above. If the manifest is missing, `list` and `deploy` stop and print the exact command to run. Only R2-sourced files are copied; Supabase-sourced previews go through `publish-free-assets.mts`.

A new `workers.dev` Worker can answer 404 for a short while after deploy. Both `deploy` and `copy` poll with an unauthenticated request until the Worker answers 403, with backoff and a time limit, then run the self-test. A 200 on that request means authentication is broken, so the run stops; so does a Worker that never reaches 403. `delete` reuses that probe: it reports the Worker deleted only after the same request gets 404 three times in a row (a live Worker answers it 403, and answers `GET /` 404 even while live, so `GET /` proves nothing), and keeps the saved config until then.

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
