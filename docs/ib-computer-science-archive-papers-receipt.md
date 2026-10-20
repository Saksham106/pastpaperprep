# IB Computer Science in Full past papers: receipt (21 October 2026)

PR #386 added the IB Computer Science HL and SL topic banks. This change adds their 64 QP/MS pairs to the whole-paper archive and publishes the PDFs to `pastpaperprep-free`. The owner asked for it in chat ("merge and do the follow ups").

| Bank | Papers | Online marking (report) | Held (PDFs only) |
| --- | ---: | ---: | ---: |
| IB Computer Science HL | 32 | 4 | 28 |
| IB Computer Science SL | 32 | 3 | 29 |

Held papers list their question paper and mark scheme without a per-question report, for these reasons:
- **"Optional question choices need review"**: Paper 2. Candidates answer one option of four, so the paper total is not the sum of its questions.
- **"Printed question maxima do not reconcile"**: the shared extractor's printed per-question totals don't match the runtime marks. Most of these are Paper 1s whose IB marks are printed per part. They're held, fail-closed, until the extractor learns the IB CS layout.
- **"Printed and runtime question inventories do not reconcile"** (one SL paper): same fail-closed outcome.

## Sources
- **Origin:** IB Docs (`ibdocs.re`). May 2026 comes from `papers.xtremepape.rs`; those files are clean, unstamped and identity-checked.
- **Hashes:** SHA-256 pinned in `ib-computer-science-topic-practice/data/acquisition-manifest.json`.
- **Clean:** `scan-source-watermarks.py` found only exam-text domains, no host stamps.
- **Excluded:** Paper 3 (the case study). No Paper 2 exists for 2021–2022.
- **Reviewed identities:** three SL pairs whose IB mark-scheme covers misprint the exam code are recorded with cover images (`private/paper-archives/identity-review-ib-computer-science.json`):
  - 2024 Nov SL P1: the MS prints 8823 against the QP's 8824.
  - 2024 May SL P2 and 2024 Nov SL P2: each MS prints the HL code 6905 (one also prints a 65-mark total).
  - In all three, every mark-scheme question answers the matching SL question.
- **Private state:** saved to `research/official-sources-20261013/paper-archive-state-2026-10-21/`.

## Publish
- **Script:** `scripts/publish-added-free-papers.mts` (wrangler, no keys).
- **Plan:** 128 PDFs (122.4 MB) that the manifests approve and `origin/main`'s don't. All are IB Computer Science.
- **Upload:** add-only, check-absent → put → read-back. 128 of 128 are present and read back, with 0 pre-existing conflicts.
- **Verify:** all 5,480 approved PDFs were downloaded from `free.pastpaperprep.com` and matched. This refreshed `src/data/paper-archive-readback.json`.
- **Log:** `docs/ib-computer-science-archive-papers-r2-upload-log.jsonl`. It contains no credentials.

## Code
- `whole-paper-extraction.mts`: the IB identity parser accepts the `computer-science-` subject prefix.
- `build-whole-paper-archives.mts`: IB CS Paper 2 question ids carry the option (`…-p2-tz0-optA-q3`), so they map to their pair.
- Other banks' manifests are unchanged.
