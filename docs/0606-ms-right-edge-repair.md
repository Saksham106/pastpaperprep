# 0606 mark-scheme edge repair (2026-10-14)

Owner-approved repair of live Cambridge IGCSE Additional Mathematics 0606 mark-scheme crops whose
printed table ran past the crop window, so guidance text, question labels or outer table rules
were cut off at the right or left edge.

## What was found

Source repository `igcse-additional-mathematics-0606-topic-practice` @ `87516d6`
(`scripts/audit_ms_horizontal_window.py`, evidence in `audit/0606-ms-right-edge/`).

The audit is fail-closed. For every crop band it reports words from the PDF text layer, vector
paths (table rules, fills) and embedded images that pass the crop window, and it renders the band
across the full page width and looks for any dark pixel outside the window. A rule centred on the
window edge counts as drawn (half its thickness, at most 0.75 pt, may sit outside).

- Historical crops (`markschemes/<id>.webp`, 1,656): 710 have printed content outside the
  42–555 pt window. 439 of them are already superseded in the app by the reviewed
  maths-source-grid repair, so **271 are live**, across 52 papers: 31 lose answer or guidance
  text, the rest lose outer table rules and often the question-number column.
- Live source-grid repair images (1,369): 2 still clip — `0606-2026-june-12-q9` image 2 (the
  word "and" printed past the table edge) and `0606-2024-november-22-q8` (the right table rule).
- The earlier estimate of about 141 crops on about 31 papers counted clipped text only; table
  rules and question labels outside the window are clipped too.

## How they were repaired

`scripts/build_ms_right_edge_repairs.py` in the source repository:

1. recomputes each crop's exact geometry with `build_crops.py` and proves it reproduces the
   live crop: 219 byte-identical, 52 encoded by another libwebp build (same size, 42.0 dB or
   better PSNR against a fresh render; a one-pixel shift scores 17–23 dB), and the two
   source-grid images pixel-identical;
2. renders the same vertical geometry with a window that contains all printed ink:
   24–572 pt (the window reviewed for the 2026 March addition) unless the table reaches further,
   then `min(24, floor(ink_left − 2))`–`max(572, ceil(ink_right + 2))`; the two source-grid
   images keep their reviewed rectangle and widen only the clipped side;
3. re-audits every result: no text, rule or pixel outside the new window.

`site/markschemes/` and both crop manifests are unchanged; a no-force `build_crops.py` run over
all 147 records is byte-identical. Repairs live in `site/repairs/0606-ms-right-edge-v1/`.

### Visual review

One before/after contact sheet per affected paper (53) was checked: every "after" crop shows the
whole table, both outer rules and the question labels, with the same content and vertical extent
as "before". Borderline crops were reviewed as edge strips: the 20 live historical crops and
129 live source-grid images whose outer rule sits on the window edge (all rules visible), and the
5 source-grid images and 1 repair whose embedded-image bounding box crosses the edge (white
margins only, nothing cut).

## Delivery route

Same route as the reviewed maths source-grid, IB boundary and IB matrix repairs: new
content-addressed objects under a reviewed namespace and an exact, fail-closed overlay. Nothing
is rewritten in place, because the historical keys are live and pinned by receipts, and
`npm run r2:sync` would otherwise overwrite them from the source repository.

- Namespace `igcse-additional/repairs/0606-ms-right-edge-v1-8193a71201e5fb95/<sha256>.webp`
  (the suffix is the SHA-256 prefix of the source results file).
- Overlay `src/data/reviewed-0606-ms-right-edge-repairs.json` (built by
  `scripts/build-0606-ms-right-edge-repairs.mjs`), applied by
  `src/lib/reviewed-0606-ms-right-edge-repairs.ts` after the earlier reviewed repairs. Each entry
  is bound to the exact active paths and SHA-256 it replaces; any other path throws. The two
  source-grid entries replace one image of an existing maths repair and keep the others.
- Print geometry: repaired historical crops keep their verified vertical segments at the new
  width (`src/lib/print-geometry.ts`, `src/lib/verified-0606-client.ts`).
- Raw runtime JSON, question images, classifications, the maths repair overlay and every
  historical receipt are unchanged.

## Upload and readback

`scripts/upload-reviewed-0606-ms-right-edge-repairs.mjs` (adapted from
`research/ppp-tools/wrangler-upload-2026.mjs`): logged-in wrangler with `--remote` and the linked
Supabase CLI, no API keys; concurrency 2 with backoff. Log:
`docs/0606-ms-right-edge-upload-log.jsonl`.

What it guarantees: check-absent → put → full read-back by SHA-256 and size, serialized on this
machine by an exclusive writer lock (`scripts/lib/single-writer-lock.mjs`, taken before any storage
call; a second run from any worktree is refused). It detects pre-existing different bytes before
writing and corrupt bytes after writing. It is not an atomic create: `wrangler r2 object put` has
no conditional create (and none is relied on for the Supabase CLI copy), so a concurrent foreign
writer between the check and the put cannot be ruled out. The rows in the committed log predate the
writer lock; they were written by a single run with no other writer to this namespace.

- **Resume** skips a store/key only when its log row is in the plan and its SHA-256 and size equal
  the planned object. Superseded objects: the overlay records only SHA-256, so the hash must match
  exactly and the size must be positive. Any other row stops the run before any storage call.
  Resumed rows are reported as historical log evidence, not as a fresh read.
- **`--verify`** ignores the log, reads every planned object fresh from R2, Supabase, the free
  bucket and its public URL (plus the superseded R2 objects), checks SHA-256 and size, and writes
  nothing.
- Tests: `scripts/upload-reviewed-0606-ms-right-edge-repairs.test.mjs` (inert transports only).

| Store | Objects | Uploaded | Already present | Readback |
| --- | ---: | ---: | ---: | --- |
| R2 `pastpaperprep-assets` (premium delivery), `image/webp`, `private, max-age=31536000, immutable` | 267 | 267 | 0 | SHA-256 + size, all match |
| Supabase `question-assets` (free-year preview signing for this bank; parity with the maths repairs) | 267 | 267 | 0 | SHA-256 + size, all match |
| R2 `pastpaperprep-free` `images/…` (2016–2018 free years, served at free.pastpaperprep.com), `public, max-age=604800` per `docs/free-public-assets.md` | 123 | 123 | 0 | wrangler GET and public URL, SHA-256 + size, all match |

273 repairs map to 267 objects: six 2018 June 21/23 crops are byte-identical across the two
variants and share one content-addressed key. Before any upload, all 273 superseded live R2
objects were read back and matched the overlay's `oldSha256`.

## Superseded keys

`docs/0606-ms-right-edge-superseded-keys.json` lists the 273 replaced objects (271
`igcse-additional/markschemes/<id>.webp`, 2 maths source-grid images) and every store that holds a
copy. They are no longer referenced, and were not overwritten or deleted. Removing them needs
owner approval.

## Per paper

| Paper | Repaired | With clipped text | Window (pt) |
| --- | ---: | ---: | --- |
| 0606-2016-june-12 | 4 | 4 | 24–572 |
| 0606-2016-march-22 | 3 | 3 | 17–578 |
| 0606-2016-november-13 | 4 | 1 | 24–572 |
| 0606-2016-november-21 | 6 | 0 | 24–572 |
| 0606-2016-november-22 | 6 | 0 | 24–572 |
| 0606-2016-november-23 | 1 | 1 | 18–577 |
| 0606-2017-june-11 | 4 | 1 | 24–572 |
| 0606-2017-june-12 | 6 | 3 | 18–577 |
| 0606-2017-june-13 | 7 | 0 | 24–572 |
| 0606-2017-june-21 | 8 | 0 | 24–572 |
| 0606-2017-june-22 | 4 | 2 | 18–577 |
| 0606-2017-june-23 | 5 | 0 | 24–572 |
| 0606-2017-march-22 | 3 | 3 | 22–574 |
| 0606-2017-november-11 | 5 | 0 | 24–572 |
| 0606-2017-november-12 | 5 | 2 | 24–572 |
| 0606-2017-november-13 | 2 | 0 | 24–572 |
| 0606-2017-november-21 | 8 | 0 | 24–572 |
| 0606-2017-november-23 | 7 | 0 | 24–572 |
| 0606-2018-june-12 | 7 | 0 | 24–572 |
| 0606-2018-june-21 | 6 | 0 | 24–572 |
| 0606-2018-june-22 | 5 | 0 | 24–572 |
| 0606-2018-june-23 | 6 | 0 | 24–572 |
| 0606-2018-march-22 | 8 | 0 | 24–572 |
| 0606-2018-november-11 | 4 | 0 | 24–572 |
| 0606-2018-november-23 | 5 | 0 | 24–572 |
| 0606-2019-june-11 | 4 | 0 | 24–572 |
| 0606-2019-june-13 | 6 | 0 | 24–572 |
| 0606-2019-june-22 | 5 | 0 | 24–572 |
| 0606-2019-june-23 | 4 | 0 | 24–572 |
| 0606-2019-march-22 | 11 | 0 | 24–572 |
| 0606-2019-november-11 | 6 | 0 | 24–572 |
| 0606-2019-november-12 | 5 | 0 | 24–572 |
| 0606-2019-november-13 | 10 | 0 | 24–572 |
| 0606-2021-november-23 | 4 | 0 | 24–572 |
| 0606-2022-june-21 | 7 | 0 | 24–572 |
| 0606-2022-june-22 | 5 | 0 | 24–572 |
| 0606-2022-march-22 | 4 | 0 | 24–572 |
| 0606-2022-november-13 | 8 | 0 | 24–572 |
| 0606-2023-june-13 | 4 | 0 | 24–572 |
| 0606-2023-june-22 | 2 | 0 | 24–572 |
| 0606-2023-june-23 | 2 | 0 | 21–575 |
| 0606-2023-march-22 | 4 | 0 | 24–572 |
| 0606-2023-november-13 | 2 | 0 | 24–572 |
| 0606-2023-november-21 | 4 | 0 | 23–572 |
| 0606-2023-november-22 | 3 | 0 | 24–572 |
| 0606-2023-november-23 | 2 | 0 | 24–572 |
| 0606-2024-november-13 | 6 | 0 | 24–572 |
| 0606-2024-november-22 | 6 | 0 | 24–572 ×5, source-grid right edge -> 559 ×1 |
| 0606-2025-june-11 | 3 | 0 | 24–572 |
| 0606-2025-june-21 | 11 | 7 | 24–572 |
| 0606-2025-june-23 | 13 | 4 | 24–572 ×12, 24–587 ×1 |
| 0606-2025-march-12 | 2 | 0 | 22–574 |
| 0606-2026-june-12 | 1 | 1 | source-grid right edge -> 796 |
