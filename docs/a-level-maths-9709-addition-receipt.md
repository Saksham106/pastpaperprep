# A Level Mathematics 9709: addition receipt (14 November 2026)

The owner approved folding the real 9709 questions into this PR in chat ("Yes, fold in", relayed by the coordinating session). The crops are uploaded, the runtime is finalized and the bank is switched on (2026-11-18). Nothing is migrated; the products migration and the merge stay owner-gated (below).

## Source
- Workspace: `cambridge-a-level-mathematics-9709-topic-practice` at commit 5c9254a (local git, clean). Receipts there: `docs/coverage-receipt.md`, `docs/classification-receipt.md`.
- Generator: `scripts/generate-a-level-maths-9709-runtime.mjs`. Every input is SHA-256 pinned and the run is deterministic (two runs, identical bytes):
  - `segmentation.json`, `final-labels.json`, `taxonomy.json`, `canonical-manifest.json`, `held-questions.json`, `paper-facts.json`, `source-manifest.json`, `acquisition-manifest.json`
  - the 95 blind-results files, pinned together (`e605c685…`); their transcripts are the accessible text.
- Papers: 276 sourced (bestexamhelp.com, identity-checked), 256 canonical. The 20 alias papers reprint another variant of the same series; their 149 question ids resolve to the canonical questions through `src/data/question-id-aliases.json`.

## Runtime
| | |
|---|---|
| Questions | 2,118 (2,119 canonical, minus held `9709-2024-s-33-q11`: Cambridge's mark scheme omits it) |
| Papers | 256 (Paper 1: 502, Paper 2: 239, Paper 3: 477, Paper 4: 321, Paper 5: 307, Paper 6: 272 questions) |
| Years | 2020-2026 (all series; Oct/Nov 2026 not yet published) |
| Sections | 38 official sections 1.1-6.5 (`9709:2020:<code>`), every one used; labels never leave the question's own paper |
| Free | 2020-2021: 636 questions |
| Not sat | May/June 2020: 138 questions, labelled "Not sat" (source exam status `released_not_sat`) |
| Paper facts | totals and durations from the syllabus assessment table (`paper-facts.json`), in the runtime and `assessment-guides.ts` |
| Candidate seal | `5cdeebc4a0d84f9878f6204b8b6d318a5b91fe7c216c46187a34383b1757c3fa` after crop revision v2 of 2026-11-21 (before: `1b09ae09…` after 2026-11-15; first candidate `191db74b…`; blanked-v1, recomputed from content) |
| Files | `src/data/production/a-level-maths-9709.json`, `src/data/private-index/a-level-maths-9709.json`, `src/data/a-level-maths-9709-taxonomy.json` |

Topics are the official section titles; the paper tab equals the paper number, and a paper tab lists that paper's sections in syllabus order.

## Storage (uploaded and read back, 14 November 2026)
The owner approved the R2 upload in this session ("Yes, upload"). That approval covered only the 6,496 objects in the manifest, as new keys.
- Prefix `a-level-maths-9709/releases/full2118-v1-191db74b1cb4/` in the private bucket `pastpaperprep-assets`.
- Plan: `data/storage/a-level-maths-9709.manifest.json`, 6,496 WebP objects, 84,547,318 bytes.
- Dry run: `data/storage/a-level-maths-9709.dry-run.json`. Every local file was re-hashed and matches the segmentation record.
- Upload: `scripts/upload-computer-science-wrangler.mjs --bank a-level-maths-9709` with wrangler 4.152.0 (OAuth) and concurrency 2. For each object the script:
  1. checked the local SHA-256 and size;
  2. confirmed the key was absent with `get`;
  3. uploaded it with an **unconditional** `put` (Wrangler has no conditional put);
  4. read it back with `get` and compared the SHA-256 and size.
- **Correction (owner review, 2026-11-18):** steps 2–3 are an absent check followed by an unconditional put, **not an atomic create-only write**. A concurrent writer between the two calls could have been overwritten. The read-back proves every stored object's bytes match the manifest; it does not prove create-only behaviour. No re-upload is needed on this evidence.
  - The sealed receipt's `readbackProvenance.method` still reads "wrangler-oauth create-only get/put/get". It is pinned by the runtime's `storageReceiptSha256`, so it is left as written; this note supersedes that wording.
  - The script now refuses a put unless `--allow-non-atomic-put` is passed, and new receipts say "not atomic create-only". New writes should use the Worker uploader (`research/ppp-tools/r2-upload-worker/`: atomic `If-None-Match: *` put, R2-checked SHA-256, read-back), as Physics 9702 did.
- Results: **6,496 of 6,496 verified, 0 failed, 0 already present**, with no 429 failures.
  - Log: `docs/a-level-maths-9709-r2-upload-log.jsonl` (SHA `1f082223…`).
  - Receipt: `data/storage/a-level-maths-9709.receipt.json` (`verified_readback`).
- The 2 held-question QP crops were not uploaded.

## Finalized runtime
`generate-igcse-release.mjs --finalize a-level-maths-9709` checked the receipt against the manifest seal. It then moved all 2,118 rows to `production` / `classified` and sealed the runtime:

| Seal | Value |
|---|---|
| Original candidate | `191db74b1cb400a1a095ee61cc3b3f033d47edaff6c1936e4d13f9f2e7351d22` |
| Asset manifest | `5e3be084cc5546dee4b58fd31a67f914c0bf64fe99f9d9a8829f68ee7f01bbd5` |
| Storage receipt | `0e99a49588ecd02a3421dc261e2dbb4893a37afbb848ca011c94737d77d21809` |
| Finalized content | `76268395f8bf77825b81b4170de3f182fa237eb36cafa94c593ad171c2e08674` |
| Runtime | `91005b99f339c7515d57bc550ad3ec902bbb9fb960866b6cce2f96b663c3a9c3` |

At finalize the catalog entry kept `pendingStorage: true` (hidden, unsellable); it was switched on 2026-11-18 (see below). The release test reconstructs the candidate from the finalized runtime and checks it reproduces the pinned seal.

## Crop revision v2 (15–17 November 2026)
The explanations session found maths glyphs missing from some question crops.
- **Cause:** `segment.py`'s barcode test painted out any small block made mostly of non-ASCII glyphs.
- **Affected:** 26 masks in 23 question crops, covering 20 questions. The masks erased ∞, ∫ with its limits, modulus bars and en-dashes. No mark-scheme crops were affected.
- **Fix:** made in the content workspace at commit `8e5f3a7`. Barcode masks now need barcode width, and the audit rejects any non-furniture mask.
  - The 23 crops were re-rendered under new `.v2.webp` names. The other 6,475 are byte-identical.
  - The 20 questions were re-transcribed, which corrected the text of 15 rows.
  - Labels and marks are unchanged.
- **App side:**
  - The generator now pins `8e5f3a7`, including `crop-revisions.json` and `transcript-overrides.json`.
  - The new candidate is `1b09ae09…`. Exactly 20 questions changed, and only in their question crops and text.
  - The storage prefix keeps its first-candidate name.
- **Upload:** owner-approved, run in the coordinating session with the same Wrangler script (absent check, then unconditional put, then read-back; not atomic create-only, see the correction above). It added only the 23 new keys; 6,473 objects were already verified.
  - Receipt: 6,496 of 6,496 verified, 0 failed, 0 pre-existing. It lists the 23 superseded keys, which stay in the bucket unreferenced.
  - The upload script accepts a superseded original in its log only when its `.v2.webp` replacement is in the manifest.
- **Re-finalized:** runtime `8d7493bc…`, still hidden.

## Crop revision v2: 2026-s-12 Q2 axis labels (21 November 2026)
The shared ingestion toolkit's proof-of-equivalence run found it. The crop for `9709-2026-s-12-q2` (page 2) cut two of its graph's axis labels at the fixed 40–556pt crop edges: the "–" of "–1" at x 38.5pt and the "x" label, which runs to x 556.9pt. A fresh render confirmed it.
- **Fix:** content workspace commit `7abce15` (`docs/crop-revision-2026-11-21.md`). QP crops widen to the printed text, out to 25/575pt, as the toolkit does.
  - This crop is now 37.01–558.36pt, matching the toolkit, under a new key: `q2-2-1.v2.webp`, sha `8f5d6af8…`, 18,950 bytes.
  - The other 6,497 crops are byte-identical, and the text, labels and marks are unchanged.
  - A scan of every QP crop found no other printed word cut by its edges.
- **App side:**
  - The generator pins `7abce15`. It expects 24 revised crops and 21 revised questions; the transcript was checked and is unchanged.
  - The new candidate is `5cdeebc4…`. Exactly one row changed: `questionImages` and `questionImageHashes` of `9709-2026-s-12-q2`.
- **Not a free year:** free years are 2020–2021, so nothing goes to the free bucket.
- **Upload:** one new private object, `questions/9709-2026-s-12/q2-2-1.v2.webp`, under the existing prefix. The owner approved it in the coordinating session ("Yes, upload it").
  - Dry run: all 6,496 local files re-hashed and matching the segmentation record; 6,495 were already verified in the log.
  - Run with the Worker uploader (`scripts/r2-upload-worker/`, PR #504): create-only put, R2 SHA-256 check and read-back. Its log reader now accepts a superseded original only when its `.v2.webp` replacement is in the manifest, as the wrangler script did.
  - Result: verified, not pre-existing. The Worker was deleted, and its URL answers 404.
  - Receipt: 6,496 of 6,496 verified, 0 failed, 24 superseded originals listed. They stay in the bucket, unreferenced.
- **Re-finalized:** runtime `db987166…`. Compared with the previous live runtime, only this question's crop and the seal fields changed.

## Calculator policy
`calculatorAllowed("a-level-maths-9709", …)` is true for all six papers. The source is syllabus section 4, "Calculators", which is identical in the 2020–22, 2023–25 and 2026–27 syllabuses: a calculator with standard scientific functions in all examinations; graphical and symbolic-algebra calculators are not permitted.

## Explanations and switch-on (17–18 November 2026)
- **Explanations:** batch 1 from the explanations session (`feat/explanations-9709-batch1` @ `85acd6aa`) is merged: **1,218 of 2,118** questions explained.
  - The explanations are in private R2 under `explanations/a-level-maths-9709/`, and the 362 free-year ones are also in the free bucket. The owner approved both in that session.
  - `articles-explanation-coverage.test.ts` names 9709 as a partial-coverage bank (owner decision 2026-11-17). No article claims full A Level coverage.
- **Free-year crops:**
  - The 1,828 free-year question and mark-scheme crops (2020–2021, 636 questions, 20.5 MB) were copied to `pastpaperprep-free` under `images/<private path>`.
  - The owner approved it in the coordinating session ("Yes, copy both"). It used the repo's `scripts/free-copy-worker` (allowlist, create-only `If-None-Match`, self-tested), and the Worker was deleted afterwards.
  - Every copied path was re-fetched from `free.pastpaperprep.com` and re-hashed: 3,930 of 3,930 across 9709 and 9702 (the 362 explanations already existed). Receipt: `research/ppp-tools/free-copy-alevel/receipt.json`.
  - This session spot-checked 4 random 9709 crops from the public URL against the upload manifest; all matched.
- **Switched on (2026-11-18):** `pendingStorage` is removed and 9709 is off `src/lib/held-banks.mjs`. It's served under the shared release gate, and its static bank index is published again.

## Pre-launch polish (owner, 2026-11-18, "Yes, fix first")
- **Subject order:** A Level is listed as Mathematics, Chemistry, Physics everywhere, from one source (`BOARD_SUBJECT_ORDER` in `qualifications.ts`, applied by `getCatalogBanksForDisplay`).
- **Quotes:** A Level pages show no testimonial (every quote on file is from IGCSE or IB students) until there are A Level ones.
- **Titles:**
  - home title: "Free IGCSE, A Level & IB Past Papers by Topic";
  - hub title: "Cambridge A Level Past Papers by Topic", now with its own link preview;
  - the layout default title and descriptions now name A Level.
- **Labels:**
  - the IGCSE picker and footer group reads "Cambridge IGCSE";
  - the 9709 tabs read Stats 1 / Stats 2;
  - the variant filter reads "Variant" on every Cambridge bank ("Time zone" stays on IB).
- **Phone tabs:** 9709's seven tabs wrap into a four-column grid at 760 px and below. The 3- and 4-tab pickers are unchanged.

## Still owner-gated
1. **Production migration** `20261114000000_a_level_maths_9709_release.sql`. It must be applied **before this PR merges**: once 9709 is live, checkout for `bank_a_level_maths_9709` needs the `products` row and its `stripe_price_catalog` rows.
2. **Stripe:** none needed. Single bank uses the shared single-bank prices; All Access and Lifetime cover every bank.
3. **Merge**, not back-to-back with another build.
4. Decide the held question `9709-2024-s-33-q11`.

## Existing banks unchanged
For every other bank, raw and normalized rows were hashed on `origin/main` (cdb1fe2a) and on this branch. All 22 banks are identical (43,617 rows), and the bank-index manifest changes only the 9709 entry.

| Bank | Rows | Raw SHA | Normalized SHA |
|---|---:|---|---|
| igcse | 4,174 | `65b89684ed59` | `35cacec9d596` |
| igcse-additional | 1,656 | `6ca23bfd5439` | `1a82fa331d4a` |
| igcse-biology-0610 | 5,211 | `6606b21ce241` | `f80b51d6b330` |
| igcse-economics-0455 | 1,862 | `7f9ec89bf5bc` | `11ca94d50214` |
| igcse-chemistry-0620 | 5,129 | `a531a0ba21ca` | `989653a713fb` |
| igcse-physics-0625 | 5,789 | `fc5d222dd140` | `b23e889d1927` |
| igcse-coordinated-sciences-0654 | 4,721 | `d2e3517d35cc` | `fa99ff74aef6` |
| igcse-computer-science-0478 | 847 | `d650264d2d3e` | `8107648efa3a` |
| ib-hl | 893 | `42c0f770ccbe` | `561326c3cfa0` |
| ib-sl | 596 | `491ca5a84e86` | `42d834b24ccb` |
| ib-ai-hl | 484 | `25f6eab9d8c2` | `5da2ec1889a0` |
| ib-ai-sl | 386 | `fdb7cdb44043` | `65b5ec4b809a` |
| ib-chemistry-hl | 2,036 | `687fc132de74` | `ca2351cd10f0` |
| ib-chemistry-sl | 1,521 | `b16e364b1a17` | `993dfbd799e1` |
| ib-physics-hl | 2,028 | `8f98d19eb05e` | `4d90204605b4` |
| ib-physics-sl | 1,413 | `09494c0301f5` | `268c865f2c37` |
| ib-biology-hl | 2,071 | `06a06c71d6ec` | `9a9723b82502` |
| ib-biology-sl | 1,671 | `12ce9865be9e` | `a7301b6d61c9` |
| ib-computer-science-hl | 506 | `f976e7e5b290` | `6d130d7eabe1` |
| ib-computer-science-sl | 391 | `edca6d26e4bb` | `22a383043f1b` |
| ib-economics-hl | 128 | `e14d3572aef8` | `6c5e30730f28` |
| ib-economics-sl | 104 | `aa54701ced11` | `dabc96226ce0` |
