# 2026 papers in Full past papers: receipt (14 October 2026)

PR #282 added these 2026 papers to the topic banks. This change adds them to the whole-paper
archive and publishes their PDFs to `pastpaperprep-free`. The owner approved the upload.

| Bank | Papers added | Online marking (report) | Held (PDFs only) |
| --- | ---: | ---: | ---: |
| Economics 0455 | 8: Feb/March 12, 22; May/June 11, 12, 13, 21, 22, 23 | 3 (m12, s12, s13) | 5 |
| Maths 0580 Core | 8: May/June 11, 12, 13, 31, 32, 33; Feb/March 12, 32 | 7 | 1 (June 11) |
| Add Maths 0606 | 2: Feb/March 12, 22 | 2 | 0 |
| Biology 0610 | 0 new; 18 May/June 2026 papers bound to their runtime rows | 18 (were held) | 0 |

Held papers are listed with their question paper and mark scheme, but have no per-question report.
They follow the same rules as older papers in their bank:

- 0455 Paper 2 (m22, s21, s22, s23): "Optional question choices need review", like all 53 earlier 0455 Paper 2s.
- 0455 s11: Cambridge removed Q26 (key: removed, 0 marks), so the runtime has 29 rows for 30 printed questions.
- 0580 June 11: the extractor finds no printed question numbers in this question paper (three earlier Paper 11s are held the same way).

## Sources

All 72 PDFs (36 new, plus the 36 Biology May/June 2026 PDFs already published) are listed in
`docs/2026-archive-papers-sources.json`:

- **Hashes:** each SHA-256 matches its source repo's acquisition receipt: 0455 `download-report.json`,
  0580 `core-2026/acquisition-receipt.json`, 0606 `data/source-manifest.json` (worktree and main checkout copies);
  0610 `raw-extension-2026-mj/acquisition-authority.json`.
- **Clean:** `../research/ppp-tools/clean_gate.py --year 2026` gives 72 PASS, 0 WARN, 0 FAIL.
  `scripts/scan-source-watermarks.py` flags 0 of 72.
- 0580 uses the main Best Exam Help files, not the `cross-host/` copies. 0610 uses the clean copies in
  `../research/papacambridge-clean-20261013/sources/`, already published by #278 and unchanged here.

## Build

`scripts/build-whole-paper-archives.mts` rebuilt the four banks with the existing identity reviews.
The private state from #281 was lost when its worktree was removed. So the inventories were rebuilt
from the latest surviving private build receipt, whose source hashes match every document in main's
manifests. The 2026 pairs were then added, and the 18 Biology pairs got their `runtimeQuestionIds`.

- **0455, 0580, 0606:** only the new papers were added. All 460 existing entries are byte-identical.
- **0610:** the 18 May/June 2026 papers now have reports. Their document hashes are unchanged. 54 older
  written/practical papers (2019, 2020, 2026 March) changed only question `topics`: 169 questions pick up
  the secondary topics PR #282 added to the runtime. Nothing else changed.
- Every manifest's `runtimeSha256` now matches the runtime it was built from.

## Publish

`publish-free-papers.mts upload` re-puts every approved PDF its work list hasn't logged, which would
overwrite live objects. Its `list` also needs source bindings for all 4,954 PDFs. So
`scripts/publish-added-free-papers.mts` (wrangler, no keys) published only the PDFs that the manifests
approve and `origin/main`'s don't. Its headers match the publisher's and the live objects:
`application/pdf`, `public, max-age=604800`, `attachment; filename="0455_m26_qp_12.pdf"`.

- **Plan:** 36 PDFs (16.0 MB). No existing object changes its download name.
- **Upload:** 2 at a time, with backoff. For each PDF: a staged copy was hash-checked, `r2 object get --remote` found the key absent, it was `put`, and read back with matching SHA-256 and size.
  Result: 36 absent, 36 put, 36 read back. Nothing was overwritten.
- **Verify:** all 4,954 approved PDFs were downloaded from `free.pastpaperprep.com` through DoH. Bytes, type and filename matched for every one, which wrote `src/data/paper-archive-readback.json` (objectsSha256 `0f4fa400…`, mappingSha256 `3c331e48…`).
- **Log:** `docs/2026-archive-papers-r2-upload-log.jsonl`: one line per upload event plus the verify summary,
  05:43–05:59 UTC. No credentials.
