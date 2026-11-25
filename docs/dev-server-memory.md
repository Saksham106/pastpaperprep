# Local server memory (2026-11-25)

Why agents use `npm run preview:agent` / `npm run dev:agent` instead of `npm run dev`.

## What happened

An idle `npm run dev` (webpack) left running by an agent reached an 11 GB footprint (14 GB peak) and filled swap on the 24 GB Mac.

Cause: with no heap flag, `next dev` gives its server process a V8 heap limit of half of RAM (12 GB here). Its built-in watchdog restarts the server only once used heap passes 80% of that limit, checked after each request (`next/dist/server/lib/utils.js`, `getMemoryRestartStats`). So a webpack dev server that has compiled a few bank pages can grow to 10 GB or more before anything stops it.

## Measurements

Next 16.4.5, one server at a time, cold `.next` each run. Footprint is `phys_footprint` from `footprint`, summed over the server's process tree (RSS understates it). Pages: `/banks/igcse`, `/banks/igcse/topics/number`, `/past-papers`, then `/banks/ib-hl`, three more bank pages and `/`.

| Setup | After 3 pages | Peak (1 s samples) | After 8 pages + 60 s idle | First bank page |
|---|---|---|---|---|
| `npm run dev` (webpack) | 6.98 GB | 7.94 GB | 8.20 GB, still growing | 18 s |
| webpack + `webpackMemoryOptimizations` | 6.85 GB | – | 7.51 GB (3 pages) | 15 s |
| webpack + memory flags + 4 GB heap cap | 6.87 GB | 7.54 GB | 0.31 GB (watchdog restarted it) | 15 s |
| Turbopack dev | 5.27 GB | 6.56 GB | 5.23 GB | 5 s |
| **`npm run dev:agent`** (Turbopack, 3 GB heap cap) | 5.62 GB | 6.37 GB | 1.74 GB | 5 s |
| `next start` on a production build | 0.64 GB | 0.65 GB | 0.58 GB | prerendered |
| **`npm run preview:agent`** (`next start`, no entry preload, 2 GB cap) | 0.42 GB | 0.43 GB | 0.29 GB | prerendered |

Notes:

- The heap cap doesn't limit the footprint directly: much of a dev server's memory is outside the V8 heap. What it does is bring the watchdog restart forward, from about 9.6 GB of heap to 2.4 GB.
- `webpackMemoryOptimizations` saved about 3%, so it isn't used.
- In dev, three of the extra bank pages are 404 without the release flags. Under `next start` with the CI flags, all eight pages returned 200.
- Production builds already use Turbopack, so `dev:agent` matches production more closely than webpack dev does.
- `npm run dev` is unchanged. Turbopack (or adding `NODE_OPTIONS=--max-old-space-size=4096`) would also help the owner's own dev server, but that's the owner's call.
