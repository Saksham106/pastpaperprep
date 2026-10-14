# 0455 Paper 2 Q1: restore the source material cut from 13 live crops

**Date:** 2026-10-14. Owner approved the repair, including the uploads.

## Defect

On Paper 2 the Q1 source material often continues at the top of the page with the "1 (a)" anchor. The
2019–2020 and 2021–2025 crops start that page at the anchor, so 3–10 lines of source material (or the
whole closing paragraph) never reached students. The 2026 lane already starts that band at the 48pt
page-furniture line.

## Finding every affected crop (fail-closed)

Source repo `igcse-economics-0455-topic-practice` commit `83b1d24` (receipt
`docs/p2-q1-source-crop-repair-receipt.md`): `scripts/repair_p2_q1_source_crops.py census` checks all 53 Paper 2
question papers, from the pinned clean originals, against the crop bands. Every printed line, image and
graphic on pages 2…Q1-anchor that isn't furniture or a Section A heading must be inside a Q1 crop; every
other page is checked against all question bands. Every live 0455 question crop maps by SHA-256 to these
lane manifests (1,924 of 1,924).

- 14 Q1 rows flagged (13 base + 0455-2020-w-23-q1); 2026 clean; nothing outside Q1 on any page.
- Negative control: putting the 2026 Q1 bands back at the anchor flags m-22 and s-22.
- 0455-2021-s-22-q1 is flagged but is not live (excluded as `unavailable_stimulus`, see
  `docs/0455-wiring-receipt.md`). It is not delivered, so **13 live crops** are repaired.

Each anchor-page crop was re-rendered with the 2026 rule (top 48pt, same bottom, same renderer) after the
old bounds were proven to re-render byte-identically. Every before/after was checked visually: the full
continuation, the "Answer all parts of Question 1" line and parts (a)–(h), with no clipped page number.

| Question | Lines restored | Band top (pt) | Superseded object (under the 0455 prefix) | New SHA-256 |
|---|---|---|---|---|
| `0455-2020-w-23-q1` | 4 | 159.0→48 | `questions/0455-2020-w-23/q1-2-3.webp` | `c5ea87556c2b65cd`… |
| `0455-2022-m-22-q1` | 10 | 237.1→48 | `questions/0455-2022-m-22/q1-2-3.webp` | `002a41b249f9b4a6`… |
| `0455-2022-s-22-q1` | 3 | 133.0→48 | `questions/0455-2022-s-22/q1-2-3.webp` | `d82eb415bebe0c03`… |
| `0455-2022-w-21-q1` | 6 | 185.0→48 | `questions/0455-2022-w-21/q1-2-3.webp` | `ef417199ac8fd168`… |
| `0455-2024-s-22-q1` | 7 | 211.0→48 | `questions/0455-2024-s-22/q1-2-3.webp` | `b32cb64f447d0675`… |
| `0455-2024-w-21-q1` | 8 | 224.5→48 | `questions/0455-2024-w-21/q1-2-3.webp` | `76a4a80214f8feec`… |
| `0455-2024-w-22-q1` | 4 | 159.5→48 | `questions/0455-2024-w-22/q1-2-3.webp` | `8fd7d2a2e796b34d`… |
| `0455-2024-w-23-q1` | 5 | 172.5→48 | `questions/0455-2024-w-23/q1-2-3.webp` | `ff9d0dde9a35cc1d`… |
| `0455-2025-m-22-q1` | 4 | 146.5→48 | `questions/0455-2025-m-22/q1-2-3.webp` | `994df18d4c88e8d8`… |
| `0455-2025-s-21-q1` | 3 | 146.5→48 | `questions/0455-2025-s-21/q1-2-3.webp` | `2c2f0bce38299ac9`… |
| `0455-2025-s-22-q1` | 7 | 211.5→48 | `questions/0455-2025-s-22/q1-2-3.webp` | `17651ddd87640ed0`… |
| `0455-2025-w-21-q1` | 8 | 224.0→48 | `questions/0455-2025-w-21/q1-2-3.webp` | `3b3bbc2121f91ac7`… |
| `0455-2025-w-22-q1` | 4 | 159.5→48 | `questions/0455-2025-w-22/q1-2-3.webp` | `450b132e28fc9c08`… |

## Delivery: a reviewed overlay, not a new release

The bank is finalized (`verified_readback`, sealed runtime, storage receipt, 2026 addition seals). Like the
earlier Economics written-answer repairs (`repairs/economics-written-v1-…`), the fix leaves all of that
untouched and swaps paths at normalization:

- `src/data/reviewed-economics-question-crop-repairs.json`: 13 entries, each the exact live
  `questionImages` + hashes and the replacement list, with one path changed to
  `repairs/economics-q1-source-v1-2dd7ef88064cdc04/<sha256>.webp` (namespace = first 16 hex of the source repair
  receipt's SHA-256).
- `src/lib/reviewed-economics-question-crops.ts` applies it in `normalizeQuestion` (production IGCSE only, same
  gate as the other reviewed overlays). It fails closed if the live paths differ, more than one path changes,
  or a key is not SHA-named in the namespace. Signing, the asset manifest, PDF export and worksheets all read
  the normalized paths.
- Built by `scripts/build-reviewed-economics-q1-source-repairs.mjs` from the committed source receipt; it
  re-checks every candidate's bytes and binds every entry to the live row.

The runtime JSON, its seals, the release manifest and receipts, mark schemes, image counts and the public bank
index are unchanged, so the finalization does not need to be re-composed. None of the 13 rows is in the free year
(2021), so nothing goes to the public `pastpaperprep-free` bucket.

## Upload and readback

`scripts/upload-reviewed-economics-q1-source-repairs.mjs` (rules from `research/ppp-tools/wrangler-upload-2026.mjs`):
logged-in wrangler 4.149.0, no API keys, `--remote`, concurrency 2 with backoff. For each object: the
superseded live object is read and must match its recorded SHA-256; the new key must be absent (an existing
different object stops the run); put with `image/webp` and `private, max-age=31536000, immutable`; then a full
GET compared by SHA-256 and size.

Result (2026-10-14): **13 created, 0 overwritten, 0 already present; 13/13 readback match**; 388,604 bytes.
All 13 superseded objects were read and were unchanged. Evidence: `data/storage/economics-q1-source-repairs.manifest.json`,
`data/storage/economics-q1-source-repairs.receipt.json` (pins the manifest and log SHA-256), and
`docs/economics-q1-source-repairs-r2-upload-log.jsonl`.

**Superseded keys** (left in place, not deleted; the owner can retire them after deploy): the 13
`igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/questions/<paper>/q1-2-3.webp` objects in the table.

## Proof the rest is unchanged

`src/lib/reviewed-economics-question-crops.test.ts` runs the production loader with the release gates on and
compares it with the same normalization with the overlay emptied. All 1,862 questions match on every field;
exactly 13 question asset paths differ (one per listed row); mark-scheme paths and image counts are equal; the
raw runtime is byte-identical. Source side: no engine, manifest or committed crop changed.

## Verification

- `npm run lint` (0 errors; 1 existing warning in `PricingContent.tsx`), `npm run typecheck`: pass.
- `npm test`, release flags off and on (`PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS=true
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED=true`): 372 files / 2,739 tests pass, 11 skipped, in each.
  The first flags-off run had 8 timeouts while the machine's load average was about 60. A full re-run passed.
- `npm run build` in both envs (placeholder Supabase URL/key): pass. With flags on, the generated 0455 asset
  manifest lists all 13 new keys and none of the superseded ones.
- Source repo: `pytest tests` 91 passed (3 new).
