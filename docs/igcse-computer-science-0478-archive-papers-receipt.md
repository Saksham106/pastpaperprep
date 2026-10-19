# Computer Science 0478 in Full past papers: receipt (19 October 2026)

PR #357 added IGCSE Computer Science 0478 to the topic banks. This change adds its 50 papers to the
whole-paper archive and publishes their PDFs to `pastpaperprep-free`. The owner asked for it in chat.

| Bank | Papers | Online marking (report) | Held (PDFs only) |
| --- | ---: | ---: | ---: |
| Computer Science 0478 | 50: Feb/March 2023–2026 (12, 22); May/June 2023–2026 and Oct/Nov 2023–2025 (11–13, 21–23) | 46 (427 questions) | 4 |

Report papers carry exactly the runtime marks: 0 of 427 questions differ, and every paper totals 75.

**Update (#367):** the first release (#365) shipped 40 reports and 10 held papers. #367 reads 0478 marks from the right-aligned mark column instead of every `[n]` in the text, which unblocked six Paper 2s whose pseudocode array indexes (`List[1]`) had been counted as marks. Their PDFs are unchanged.

Held papers list their question paper and mark scheme without a per-question report:

- **"Question and markscheme maxima disagree":** 0478-2023-s-21, -s-22, -s-23. Cambridge's mark-scheme covers print "Maximum Mark: 50"; the question papers print 75. 0478-2023-s-22 also had Q5 withdrawn by Cambridge.
- **"Printed and runtime question inventories do not reconcile":** 0478-2025-s-22. Cambridge withdrew Q10, the 15-mark scenario, so the runtime has 9 rows for 10 printed questions.

## Sources

- **Origin and hashes:** Best Exam Help originals, SHA-256 pinned in `igcse-computer-science-0478-topic-practice/data/acquisition-manifest.json`.
- **Identity:** page-1 identity checked for all 100 PDFs (`identity-report.json`).
- **Clean:** `scripts/scan-source-watermarks.py` found no host stamps. Nine of the 100 PDFs had flags, all from exam text such as `vb.net` and fictional URLs.
- **Private state:**
  - `private/paper-archives/inventory-igcse-computer-science-0478.json` (git-ignored) holds 50 pairs and 469 runtime question ids.
  - The updated private state is saved to `research/official-sources-20261013/paper-archive-state-2026-10-19/`.

## Publish

`scripts/publish-added-free-papers.mts` (wrangler, no keys):

- **Plan:** 100 PDFs (36.4 MB) that the manifests approve and `origin/main`'s don't, all `0478_*`. No existing object changes its download name.
- **Upload:** 2 at a time. For each PDF:
  - a staged copy was hash-checked;
  - `r2 object get --remote` found the key absent;
  - the PDF was put;
  - it was read back with matching SHA-256 and size.
  - Result: 100 of 100 present and read back, with 0 pre-existing conflicts.
- **Verify:** all 5,242 approved PDFs were downloaded from `free.pastpaperprep.com` through DoH, and bytes, type and filename matched for every one. This wrote `src/data/paper-archive-readback.json`: objectsSha256 `866d81f6…`, mappingSha256 `be4216e8…`.
- **Log:** `docs/igcse-computer-science-0478-archive-papers-r2-upload-log.jsonl`. No credentials.

## App

`PastPaperHub` gains a Computer Science group; without it the hub omitted the bank.
