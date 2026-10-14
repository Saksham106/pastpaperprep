# 0580 Core 2021–2025 crop-boundary repair (14 October 2026)

The shared Core crop code had faults that the 2026 Core lane exposed. This repair checks every live 0580 Core 2021–2025 crop for all six fault classes and fixes the faulty question crops under new immutable keys. The owner approved the repair and the upload.

## What was checked

`scripts/audit_core_crop_boundaries.py` in the source repository (branch `fix/0580-core-crops`, commit `652f0a75b8c158209a2c5925cf234124859a2556`) re-derived all 2,570 crop geometries from the 140 clean local PDFs. They matched the released manifests exactly. It then checked them against the PDF text and vector layers and the rendered ink:

- crop segments holding only furniture (BLANK PAGE, copyright page);
- foreign rows, other questions' headings, and text from before the mark-scheme table (Generic Marking Principles);
- every question start is its printed left-margin heading;
- text or ink crossing any crop edge;
- printed text owned by no crop, or by two;
- each question's printed `[k]` total against its mark-scheme Marks column, and paper totals.

The 241 live mark schemes already served from the reviewed maths-source grid repair were audited from that repair's own source clips. Every finding was viewed on a contact sheet. Verdicts are in the source repository: `data/core-2021-2025/crop-boundary-audit-before-repair.json`, `crop-boundary-audit.json` (0 unresolved) and `crop-boundary-adjudications.json`.

## What was found (1,283 served rows)

| Class | Live crops | Fix (source override) |
| --- | ---: | --- |
| Blank or copyright page attached to the last question | 43 (43 of 70 papers) | `question_end` |
| Answer line cut by the footer margin (2021 June 32 Q5 lost its `[4]` entirely) | 29 | `question_page_bottom`, in the white gap above the footer ink |
| Answer line split across a question boundary (2025 Nov 12 Q17/Q18) | 2 | Q18 start override |
| Axis label cut by the left render edge (2021 Nov 33 Q2) | 1 | `question_render_x` (new, backward-compatible) |
| Dropped one-line mark-scheme row | 6 in the lane, 0 live | The app already serves the grid repair, which has the row. Fixed in the lane only. |
| Mark-scheme cover/GMP rows taken as table rows | 0 | — |
| Diagram label read as a question heading | 0 | — |
| Clipped first line on a continuation page | 0 | — |

Accepted as cosmetic, unchanged:
- Page-number, registration-mark and barcode slivers at continuation-page tops. These are pre-existing and were accepted in the 2026 receipt.
- The live grid mark scheme for 2025 June 11 Q19 clips half of the last letter of "place". The source text overruns the table border there.

## Delivery

The route is the reviewed-repair overlay used by the maths-source, science and IB repairs:

- `src/data/reviewed-0580-core-crop-repairs.json` maps each row's exact released path to `repairs/0580-core-crops-v1-080b88626b486cbc/<sha256>.webp`.
- `src/lib/reviewed-0580-core-crop-repairs.ts` applies it in the question normaliser, so the viewer, the signer and the PDF exporter all use it. It fails closed if a live path differs.
- `src/data/print-geometry-0580-core-crop-repairs.json` gives the new images verified print geometry, keyed only to their new paths.

The raw bank `src/data/raw/igcse.json`, `print-geometry-0580.json` and every storage receipt are byte-identical to `origin/main`. This route was chosen because the raw bank is hash-pinned by the 0580 additions, section and print-geometry receipts, and keys are never reused.

Only question images change: 75 rows. No mark-scheme mapping changes.

## Upload

- **Plan:** `docs/igcse-0580-core-crop-repairs-r2-upload-plan.json`: 75 objects, 5,782,716 bytes, bucket `pastpaperprep-assets`, prefix `igcse/repairs/0580-core-crops-v1-080b88626b486cbc/`. R2 only: 2021–2025 is not a free-preview year, and production premium delivery is R2.
- **Tool:** the logged-in `wrangler` CLI (OAuth); no API keys were created or read. The script was copied as `research/ppp-tools/wrangler-upload-2026-0580-core-crops.mjs`. Each key was checked absent and put with `--remote`, `image/webp` and `private, max-age=31536000, immutable`, then read back and compared by SHA-256 and size. Concurrency 2, with backoff.
- **Result:** 75 created (`existedBefore: false`) and verified, 2026-10-14T06:24:08.627Z to 2026-10-14T06:29:22.029Z. Nothing was overwritten or deleted.
- **Log:** `docs/igcse-0580-core-crop-repairs-r2-upload-log.jsonl` (SHA-256 `d5498f00151311fad67a3bc5e08d382c5d1c8927f08729c8201ffe645a6ea4e7`).
- **Superseded objects read back first:** `docs/igcse-0580-core-crop-repairs-r2-superseded-readback.jsonl` (SHA-256 `e64ff277d32ebc07cbc6a41174cd78260a27498aaed0fb7e2b3779a87f59664f`). All 75 live originals matched their released SHA-256 and size.

## Stored values

Marks, topics and classification are unchanged: every repaired crop keeps its printed `[k]` total. Two stored fields are proven wrong by the repaired crops. They are left as they are here because the raw bank is hash-pinned; the owner should decide:

- `accessibleText` of the 43 trailing-page rows ends with page furniture ("BLANK PAGE", and barcode glyphs on 2024–2025 papers).
- `pages` of the same rows lists the blank/copyright pages.

The source runtime (`site/data/questions.json`) carries the corrected values. Neither field is shown to students: `accessibleText` feeds search, and `pages` is unused.

## Superseded keys (left in the bucket, unreferenced; deleting them needs owner approval)

- `igcse/core-questions/0580-2021-june-11-q22.webp` → `d008c6772ee1…`
- `igcse/core-questions/0580-2021-june-31-q4.webp` → `f2d3cc5a7c22…`
- `igcse/core-questions/0580-2021-june-32-q1.webp` → `8d4848a6f6dd…`
- `igcse/core-questions/0580-2021-june-32-q5.webp` → `51bd3d6880a5…`
- `igcse/core-questions/0580-2021-june-32-q8.webp` → `2eaddd855230…`
- `igcse/core-questions/0580-2021-june-32-q9.webp` → `aacf980f411f…`
- `igcse/core-questions/0580-2021-june-33-q10.webp` → `80ef2ffc55e0…`
- `igcse/core-questions/0580-2021-june-33-q6.webp` → `fe5955a5de6e…`
- `igcse/core-questions/0580-2021-march-12-q21.webp` → `d50bd12fc186…`
- `igcse/core-questions/0580-2021-march-32-q8.webp` → `9e17df864651…`
- `igcse/core-questions/0580-2021-march-32-q9.webp` → `c61b1b059749…`
- `igcse/core-questions/0580-2021-november-11-q21.webp` → `55709549aab3…`
- `igcse/core-questions/0580-2021-november-12-q7.webp` → `a6ba91847480…`
- `igcse/core-questions/0580-2021-november-13-q24.webp` → `72926ebdc14b…`
- `igcse/core-questions/0580-2021-november-31-q10.webp` → `fd24f3df901a…`
- `igcse/core-questions/0580-2021-november-31-q3.webp` → `a96a63176f4d…`
- `igcse/core-questions/0580-2021-november-32-q10.webp` → `4aecea5a2d7a…`
- `igcse/core-questions/0580-2021-november-32-q4.webp` → `a0753ef49bc6…`
- `igcse/core-questions/0580-2021-november-33-q2.webp` → `80796ad75fb8…`
- `igcse/core-questions/0580-2021-november-33-q9.webp` → `4cf11c8c0405…`
- `igcse/core-questions/0580-2022-june-11-q4.webp` → `3cb77eee3f71…`
- `igcse/core-questions/0580-2022-june-12-q15.webp` → `afeb787dc4c6…`
- `igcse/core-questions/0580-2022-june-12-q24.webp` → `e7a15846882e…`
- `igcse/core-questions/0580-2022-june-13-q14.webp` → `f57dfaab691d…`
- `igcse/core-questions/0580-2022-june-13-q23.webp` → `61273b5cdfbd…`
- `igcse/core-questions/0580-2022-june-31-q2.webp` → `264632d0a077…`
- `igcse/core-questions/0580-2022-june-31-q9.webp` → `ebde6dee7dc4…`
- `igcse/core-questions/0580-2022-june-32-q9.webp` → `5b367c5391fa…`
- `igcse/core-questions/0580-2022-june-33-q9.webp` → `78c7996cc5a5…`
- `igcse/core-questions/0580-2022-march-12-q24.webp` → `1e84baf6a5d8…`
- `igcse/core-questions/0580-2022-march-32-q9.webp` → `020d8d7881b9…`
- `igcse/core-questions/0580-2022-november-11-q23.webp` → `5c838f8371ec…`
- `igcse/core-questions/0580-2022-november-31-q1.webp` → `7b06e4c81f0d…`
- `igcse/core-questions/0580-2022-november-32-q9.webp` → `5ecbd3d4f261…`
- `igcse/core-questions/0580-2022-november-33-q10.webp` → `4038fa8c5c57…`
- `igcse/core-questions/0580-2022-november-33-q5.webp` → `6d4f544b2a8d…`
- `igcse/core-questions/0580-2023-june-11-q25.webp` → `93fdc9419874…`
- `igcse/core-questions/0580-2023-june-11-q6.webp` → `e6a842afaf05…`
- `igcse/core-questions/0580-2023-june-13-q25.webp` → `34617e675b10…`
- `igcse/core-questions/0580-2023-june-31-q10.webp` → `c6c4568299cc…`
- `igcse/core-questions/0580-2023-june-31-q4.webp` → `75591b4add1a…`
- `igcse/core-questions/0580-2023-june-32-q9.webp` → `8c72dfd7aed9…`
- `igcse/core-questions/0580-2023-june-33-q3.webp` → `1812acf36e50…`
- `igcse/core-questions/0580-2023-june-33-q7.webp` → `4d4cde516b9d…`
- `igcse/core-questions/0580-2023-march-12-q26.webp` → `ef8720dcb9cf…`
- `igcse/core-questions/0580-2023-march-32-q1.webp` → `ba736d098291…`
- `igcse/core-questions/0580-2023-november-11-q25.webp` → `c2e3a7c6ad02…`
- `igcse/core-questions/0580-2023-november-12-q24.webp` → `13a0f5c64e9a…`
- `igcse/core-questions/0580-2023-november-13-q23.webp` → `af6cff0f6f43…`
- `igcse/core-questions/0580-2023-november-31-q10.webp` → `a84bd7b52890…`
- `igcse/core-questions/0580-2023-november-33-q10.webp` → `b01bed622c19…`
- `igcse/core-questions/0580-2024-june-11-q25.webp` → `481bb88b49ab…`
- `igcse/core-questions/0580-2024-june-12-q16.webp` → `42348533549f…`
- `igcse/core-questions/0580-2024-june-12-q8.webp` → `144c992b080a…`
- `igcse/core-questions/0580-2024-june-13-q23.webp` → `f4295ea3639e…`
- `igcse/core-questions/0580-2024-june-31-q2.webp` → `cc9aee51ff5f…`
- `igcse/core-questions/0580-2024-june-32-q1.webp` → `acb051a1b85e…`
- `igcse/core-questions/0580-2024-june-32-q4.webp` → `b68093381673…`
- `igcse/core-questions/0580-2024-june-33-q9.webp` → `8e95bebf9e36…`
- `igcse/core-questions/0580-2024-march-12-q13.webp` → `18ae219df23d…`
- `igcse/core-questions/0580-2024-march-12-q25.webp` → `3b51b3f3a722…`
- `igcse/core-questions/0580-2024-march-32-q5.webp` → `0b2cea1fb143…`
- `igcse/core-questions/0580-2024-november-13-q23.webp` → `02a3ad42f983…`
- `igcse/core-questions/0580-2024-november-13-q24.webp` → `81baa6312768…`
- `igcse/core-questions/0580-2024-november-31-q10.webp` → `fb58b192fbfc…`
- `igcse/core-questions/0580-2024-november-32-q9.webp` → `9d9f5b858067…`
- `igcse/core-questions/0580-2024-november-33-q1.webp` → `81cce81dbf67…`
- `igcse/core-questions/0580-2025-june-12-q25.webp` → `dfff9c7abfd2…`
- `igcse/core-questions/0580-2025-june-13-q25.webp` → `fedccef336b3…`
- `igcse/core-questions/0580-2025-june-33-q24.webp` → `554f8f009b82…`
- `igcse/core-questions/0580-2025-march-12-q26.webp` → `2ece42aa58af…`
- `igcse/core-questions/0580-2025-march-32-q21.webp` → `0ad47afe10b3…`
- `igcse/core-questions/0580-2025-november-12-q17.webp` → `44ecc7ed4988…`
- `igcse/core-questions/0580-2025-november-12-q18.webp` → `2a29aedb1e74…`
- `igcse/core-questions/0580-2025-november-12-q27.webp` → `b81d2ec6365e…`
