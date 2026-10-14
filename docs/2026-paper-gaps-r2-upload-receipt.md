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

## 0610 mark-scheme ownership repair (14 October 2026 UTC)

The PR #282 review found that 21 written/practical May/June 2026 Biology questions had mark-scheme crops that also showed a neighbouring question's rows. The cause was whole-page bands on pages shared by two questions. The source pipeline re-cut those 24 crops at the printed question boundary. The owner approved publishing the repaired images, provided nothing was overwritten.

- **Plan:** `docs/igcse-biology-0610-2026-mj-ms-ownership-r2-upload-plan.json`. It lists 24 objects (334,006 bytes) and, for each, the key it replaces. Every key is content-addressed (`…-<sha256[:12]>.webp`) and new; none appears in the first log.
- **Upload:** same tool and rules as above (copied as `wrangler-upload-2026-0610-ms-ownership.mjs`): key checked absent, `put --remote` with `image/webp` and `private, max-age=31536000, immutable`, read back, then SHA-256 and size compared; at most 3 at a time. All 24 were created (`existedBefore: false`) and verified, 03:13–03:14 UTC.
- **Log:** `docs/2026-0610-ms-ownership-r2-upload-log.jsonl`, 24 lines, same format, SHA-256 `2f535945fe914636b4bd2ce5bc46249793a38da6965d51fdad469ea9a88f58cb`.
- **Replaced objects:** the 24 earlier crops stay in the bucket, unreferenced. Deleting them needs owner approval.

The rebuilt candidate (`3f2ec8f2…`) produced a manifest with the same 14,733 object count. 14,709 objects are byte-identical to the previous verified receipt (`001e9d9d…`, manifest `5dfe4e11…`) and are carried over through it. The 24 new objects are backed by the new log. The 24 replaced keys drop out. `readbackProvenance` records both sources and the dropped count.

| Bank | Candidate runtime | Finalized runtime | Asset manifest | Receipt |
| --- | --- | --- | --- | --- |
| 0610 (after repair) | `70b7a9a6…` | `495712c9…` | `651baec5…` | `155a454e…` |

`node scripts/igcse-2026-release-finalization.mjs` rebuilds the first 0610 release's manifest and receipt byte-exactly from main's verified pair and the first log. It then checks that every current object is either unchanged from that release or a repaired crop with a create-only readback line and a reviewed plan entry, and that every dropped object is a replacement the plan names.
