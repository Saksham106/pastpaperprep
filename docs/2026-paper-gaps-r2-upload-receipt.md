# 2026 gap papers: R2 upload receipt (13 October 2026)

The owner approved the upload of the four reviewed 2026 dry-run plans to the private R2 bucket `pastpaperprep-assets`. All 1,588 planned objects were created and read back. No object existed beforehand, so nothing was overwritten.

| Storage bank | Addition | Plan | Objects | Bytes |
| --- | --- | --- | ---: | ---: |
| `igcse-additional` | 0606 February/March 2026 | `docs/igcse-0606-2026-march-r2-upload-plan.json` | 46 | 2,229,310 |
| `igcse` | 0580 Core 2026 | `docs/igcse-0580-2026-core-r2-upload-plan.json` | 414 | 10,416,726 |
| `igcse-economics-0455` | 0455 2026 | `docs/igcse-economics-0455-2026-r2-upload-plan.json` | 348 | 4,034,118 |
| `igcse-biology-0610` | 0610 May/June 2026 | `docs/igcse-biology-0610-2026-mj-r2-upload-plan.json` | 780 | 11,990,894 |
| **Total** | | | **1,588** | **28,671,048** |

## Method

- **Tool:** the logged-in `wrangler` CLI (OAuth). No API keys or tokens were created, read or stored.
- **Before upload:** every local file was checked against its plan (SHA-256 and size), and every key against the bank's prefix.
- **Per object:** `r2 object get --remote` confirmed the key was absent; `r2 object put --remote` uploaded it with `Content-Type: image/webp` and `Cache-Control: private, max-age=31536000, immutable`; a second `get` read it back, and its SHA-256 and size were compared with the plan. A present key with different bytes would have stopped the run (none occurred).
- **Log:** `docs/2026-paper-gaps-r2-upload-log.jsonl` has one line per object: bank, key, SHA-256, bytes, `status: verified`, `existedBefore: false`, timestamp. It contains no credentials. SHA-256 `6675677211b31fbd2ee316845afec05a875a231995663c63b4287f427605d8be`; 22:51–23:21 UTC.

## Release receipts (0455, 0610)

`node scripts/igcse-release.mjs --dry-run <bank>` regenerated each full manifest from the committed candidate (0455: 4,548 objects; 0610: 14,733). The new `data/storage/<bank>.receipt.json` is `verified_readback`, and its `completed` list is exactly the manifest's keys:

- Previously released objects (0455: 4,200; 0610: 13,953) are carried over from the earlier verified receipt. Each is byte-identical (key, SHA-256, size) to the verified pair on main at `0a0b224`.
- Each 2026 object is backed by a matching `verified` line in the log.

`readbackProvenance` records both sources. `node scripts/generate-igcse-release.mjs --finalize <bank>` then sealed the runtimes:

| Bank | Candidate runtime | Finalized runtime | Asset manifest | Receipt |
| --- | --- | --- | --- | --- |
| 0455 | `aaa467b9…` | `8f173933…` | `b88a640c…` | `1ecdfccc…` |
| 0610 | `e8087662…` | `d27b4dbb…` | `5dfe4e11…` | `001e9d9d…` |

## Proof

`node scripts/igcse-2026-release-finalization.mjs` re-checks everything locally. It needs no network or credentials:

- the log against its pin;
- every receipt against the historical verified pair, the log and the plan;
- that each committed runtime is byte-for-byte `finalizeRelease()` over its exactly reconstructed candidate.

`scripts/igcse-2026-release-finalization.test.mjs` runs the same checks in CI. It also proves `--finalize` rejects a receipt that is missing any key, even when padded to the same length. The four plans carry `status: UPLOADED AND VERIFIED` only because `scripts/r2-upload-2026-log.mjs` finds a matching readback line for every planned object.
