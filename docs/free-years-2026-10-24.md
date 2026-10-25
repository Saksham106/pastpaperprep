# Wider free years (24 October 2026)

The owner asked for more free years in eleven banks:

| Bank | Free before | Free now | Newly free questions |
|---|---|---|---|
| Biology 0610 | 2021 | 2019–2021 | 1,373 |
| Chemistry 0620 | 2021 | 2019–2021 | 1,196 |
| Physics 0625 | 2021 | 2019–2021 | 1,532 |
| Co-ordinated Sciences 0654 | 2021 | 2020–2021 (first bank year is 2020) | 691 |
| Economics 0455 | 2021 | 2019–2021 | 504 |
| Computer Science 0478 | none | 2019–2021 | 286 |
| IB Chemistry HL/SL | 2020 | 2016–2020 | 1,411 |
| IB Physics HL/SL | 2020 | 2016–2020 | 1,304 |
| IB Biology HL/SL | 2020 | 2016–2020 | 1,384 |
| IB Computer Science HL/SL | none | 2019–2020 | 165 |

Every newly free year is from the older syllabus. Current-syllabus papers stay paid.

## Code
- `src/lib/access.ts`: the free-year maps. `questionYear()` now reads `ib-cs-YYYY-…` ids. Before this change, IB CS ids had no readable year, so a free year would have unlocked nothing.
- `src/lib/private-asset-providers.ts`: IB science free files sign from R2. R2 already holds every object these banks serve (all 136,361 manifest paths were present in R2 on 24 October). Supabase only kept 2020, so free PDF export and the image fallback would otherwise break for 2016–2019.
- `src/lib/asset-retention.ts`: Supabase retains nothing for banks whose free files sign from R2. Without this, `reconcile-supabase-assets --sync-missing-previews` would copy 2016–2019 into Supabase. The 2020 IB science copies there (about 40 MB) are now spare.
- Copy: the pricing guide drops "except Computer Science". The FAQ and `llms.txt` follow `freeTierScope()`.

## Storage (R2 free tier: 10 GB across both buckets)
- Listed 24 October: `pastpaperprep-free` 4.667 GB (4.40 GB PDFs, all referenced), `pastpaperprep-assets` 3.768 GB.
- New free files: 30,581 files, 0.64 GB, all already in private R2, copied private → public with the one-off Worker (see `docs/free-public-assets.md`).
- Cleanup: two superseded release folders that nothing reads.
  - `igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c/`: 8,854 files, 128.0 MB.
  - `igcse-economics-0455/releases/repaired-v6-9fae73bcd2a9/`: 3,018 files, 34.6 MB.
- How the cleanup was checked:
  - Neither folder is in the asset manifests of this branch or of main at `cfa9b322` (10 October, the rollback window).
  - No path in either folder appears anywhere in `src/`, `scripts/` or `data/`.
  - Both were uploaded on 19 September.
  - Key list: `../research/storage-cleanup-2026-10-24/`.
- Kept on purpose:
  - About 750 MB of superseded original crops that the runtime data and release receipts still list (repair overlays swap them out at load time).
  - About 8 MB scattered across mixed folders.
- Expected total afterwards: about 8.9 GB.
