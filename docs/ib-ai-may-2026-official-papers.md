# IB Maths AI May 2026: official papers added

October 2026. The owner approved downloading the official IB May 2026 PDFs and using Drex for triage. **Storage uploads are done (see Storage); not merged yet.**

## What was added

| Bank | Papers | Questions | Marks | Crops (new, all premium) |
| --- | ---: | ---: | ---: | ---: |
| AI HL (TZ1-TZ3, Papers 1-3) | 9 | 75 | 825 | 254 (130 question, 124 mark scheme) |
| AI SL (TZ1-TZ3, Papers 1-2) | 6 | 52 | 480 | 161 (87 question, 74 mark scheme) |

Additions only: no existing row or archive entry changes (the tests pin the SHA-256 of the 2021-2025 rows). There are no MCQs (Paper 1 is written). Every paper is paired with its official mark scheme, and every question has an official mark-scheme crop.

## Sources and checks

- Source: `papers.xtremepape.rs` mirror of the IB release. 30 PDFs, 25,755,235 bytes; URL, bytes, pages and SHA-256 are in `docs/ib-ai-may-2026-source-receipt.json`.
- Identity (subject, level, paper, time zone, May 2026, exam code, IB InDesign producer, copyright 2026): all 30 pass. `scripts/scan-source-watermarks.py`: 0 flagged. Nothing was stripped or altered.
- SL Paper 2 TZ3: the mark-scheme cover prints `2226-5226M` while every running footer (and the question paper) prints `2226-5229`. 5226 is HL Paper 2 TZ3, so the cover is an IB typo. The archive builder held the pair until a reviewed identity case (page images, both hashes) promoted it: `ib-maths-ai-sl-topic-practice-may-2026/data/audits/may-2026-official/archive-identity/`.

## Classification

- Taxonomy: the sources' `classification-taxonomy.json` (HL includes the AHL extensions); no label outside it, no "Other".
- **Drex = triage only.** Request `drex-v1.1`, answered by `drex-v1.5` (v1.1 is retired). The smoke test asserted the transmitted state contains the question text. 127 logged calls, 806,715 input and 209,610 output tokens. No auth, credit or semantic errors.
- A `drex-v2.0` re-run on just the 38 adjudicated disagreements (38 calls, 254,780 input and 65,346 output tokens; text only) agreed with the final primary topic on 27 of 38 and rated no skill the final labels omit at 0.9 or above. The 11 primary-topic differences are mark-weighted splits where both independent passes already agreed on the primary, so no label changed. Outputs: `drex-v2/` in each source repository.
- Primary pass (source-grounded) and a blind pass (separate Sonnet sub-agent, sealed evidence, never saw Drex or the primary labels) over all 127 questions, then adjudicated row by row from the two immutable result files.

| | HL | SL |
| --- | ---: | ---: |
| Agree outright | 50 | 39 |
| Primary differs | 3 | 3 |
| Secondaries differ | 6 | 6 |
| Skills differ | 16 | 4 |
| Adjudicated total | 25 | 13 |

`ib-ai-{hl,sl}-official-2026-review.json` (here) records each row's tuple, confidence, status and the SHA-256 of its text. The adjudication receipts are in the source repositories (`data/audits/may-2026-official/adjudication-{hl,sl}.json`, SHA-256 `ec267c6c...` and `18fe354a...`).

PR #300 review overlay: `docs/audits/ib-ai-may-2026-review-overlay.json` adds the source-evidenced Functions secondary and the `Modelling with quadratic and cubic functions` skill to AI HL TZ3 P3 Q2 (quadratic shape (a)(i), long-run model behaviour (b), graph identification (g)(i)); Statistics stays primary, Calculus secondary. `add_ib_ai_may_2026.py` applies it and the review generator checks it. A scan of the other 126 additions found no further materially assessed Functions part missing from the Functions filter.

**Owner awareness:** SL TZ2 Paper 2 Q1 (practical counting, area and cost arithmetic) was low confidence in both passes. It keeps the closest fit (Number and algebra: Algebraic manipulation, Rounding, estimation and percentage error). It is the only low-confidence row; the source builders accept it through one named exception.

## Integration

- `scripts/add_ib_ai_may_2026.py` splices the rows into `src/data/raw/ib-ai-{hl,sl}.json` (`--check` verifies). `subtopics` mirror `skills`, as for every AI row.
- Archive: `scripts/build-ib-ai-may-2026-archive.mts` adds 9 HL and 6 SL entries to `src/data/paper-archives/ib-ai-{hl,sl}.json` (the 2021-2025 source PDFs are no longer cached, so existing entries are kept as they are). All 15 have reports; marks reconcile (110/55 HL, 80 SL).
- `scripts/ai_hl_production_audit.py` and its test keep auditing the sealed 409 HL rows only; the 2026 rows are covered by `src/lib/ai-may-2026-official-papers.test.ts`.
- `scripts/sync-r2-assets.mjs` now reads the `*-may-2026` checkouts. All 2,355 referenced 2021-2025 files are byte-identical there, so `r2:sync` has nothing old to re-put. `r2:sync` is not create-only (it also re-puts keys whose bytes differ), so this holds only while those files stay identical.
- Asset census (`src/lib/asset-retention.ts`): AI HL 1,606 (1,370 premium), AI SL 1,163 (1,008 premium); preview counts unchanged.

## Storage (owner-approved, done 2026-10-15)

| Bucket | Objects | Bytes | Plan |
| --- | ---: | ---: | --- |
| `pastpaperprep-assets` | 415 (HL 254, SL 161) | 27,561,838 | `docs/ib-ai-may-2026-r2-upload-plan.json` (keys, SHA-256, MD5, size, source path); regenerate with `node scripts/plan-ib-ai-may-2026-upload.mjs` |
| `pastpaperprep-free` | 30 PDFs (HL 18, SL 12) | 25,755,235 | `docs/ib-ai-may-2026-free-papers-upload-plan.json` (`scripts/publish-added-free-papers.mts plan`) |

Each key was checked absent by a separate read, put, then read back by SHA-256 and size. The 415 crops are logged in `docs/ib-ai-may-2026-r2-upload-log.jsonl` (415/415 verified, equal to the plan; none pre-existing). `publish-added-free-papers.mts verify` re-read the free PDFs (5,014 objects) and rewrote `src/data/paper-archive-readback.json`.

## Owner follow-ups

- No worked explanations exist for the new ids.
- Mark-scheme transcripts keep the repo's existing private-use symbol glyphs (as for the 2021-2025 and AA rows); question screen-reader text is clean.
