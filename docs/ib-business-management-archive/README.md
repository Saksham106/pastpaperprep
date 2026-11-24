# IB Business Management in Full past papers: receipt (24 November 2026)

PR #515 added the IB Business Management HL and SL topic banks. This change adds their papers to the whole-paper
archive (`/past-papers`), the same way as IB Computer Science (#388).

| Bank | Papers (Nov 2020 – May 2026) | Online marking (report) | Held (PDFs only) |
| --- | ---: | ---: | ---: |
| IB Business Management HL | 40: P2 ×9 (old guide); P1 ×12, P2 ×12, P3 ×7 (2024 guide) | 7 (every Paper 3) | 33 |
| IB Business Management SL | 32: P2 ×9 (old guide); P1 ×12, P2 ×11 (2024 guide) | 0 | 32 |

The 12 joint Paper 1s (2024 guide) are one PDF pair each, listed in both banks under a level-neutral download name,
so the change publishes 120 PDFs, not 144.

## Scope

- **Old-guide Paper 1 (Nov 2020 – Nov 2023) is not listed** (9 papers per bank). Every question needs the separate
  pre-seen case booklet, and the archive lists a question paper and a mark scheme only. The bank still serves those
  questions with the booklet attached. Listing them needs a third document kind in the archive (manifest, readback
  seal, publisher, paper page); that is a follow-up.
- **Nov 2025 Paper 2 SL TZ1 is not listed:** no question paper exists on any host (the inventory records it as
  unpaired).
- **"More Papers" supplementary uploads are excluded** (never in the acquisition manifest's `papers`).
- **Held papers:** Paper 2 (both guides) and the joint Paper 1 let candidates choose between questions, so the paper
  total is not the sum of its questions ("Optional question choices need review", as for IB Economics). Old Paper 2
  also prints Section C, which the bank leaves out.
- **Report papers:** all seven HL Paper 3s carry exactly the runtime marks (0 corrections) and total 25.

## Sources

- **Origin:** IB Docs (`ibdocs.re`) to Nov 2025; May 2026 from `papers.xtremepape.rs` (clean, identity-checked).
- **Hashes:** SHA-256 pinned in `ib-business-management-topic-practice/data/acquisition-manifest.json` and re-hashed by
  `scripts/build-ib-business-management-archive-inventory.mjs`.
- **Watermarks:** the scan flags only exam-text domains (statista.com, smartg.com, robustbeans.com), all reviewed as
  the IB's own text. The one stamped file (`More-Papers-N22`) is a supplementary upload and is not used.
- **Reviewed identity:** May 2026 Paper 3 HL TZ2. The mark scheme's text layer splits the subject ("Business
  m anagement"); the rendered covers agree on session, subject, level, paper and code 2226 – 3023
  (`identity-review.json`, images in `research/ib-business-management-free-papers-2026-11/identity-evidence/`).

## Syllabus table

11 rows in `data/paper-archives/assessment-structure.json`, written by
`research/ib-business-management-free-papers-2026-11/scripts/add_assessment_entries.mjs`:

- 2016 guide (pages 63–64): SL P2 1 h 45, 50 marks; HL P2 2 h 15, 70 marks (Nov 2020 and 2023).
- IB 2021–2022 adaptations (source 50, pages 24–25, Section C removed): SL P2 1 h 15, 30 marks; HL P2 1 h 45,
  50 marks (May 2021 – Nov 2022). The printed covers agree.
- 2024 guide (pages 45–46): P1 1 h 30, 30 marks (SL and HL); SL P2 1 h 30, 40 marks; HL P2 1 h 45, 50 marks; HL P3
  1 h 15, 25 marks.

## Code

- `whole-paper-extraction.mts`: the IB identity parser accepts the `business-management-` prefix, and a joint paper's
  cover may print "Higher / Standard level" (the May 2024 – May 2026 Paper 1 mark schemes do).
- `paper-question-links.ts`: Business Management bank ids order their parts like IB CS (`ibbm-<year>-<session>-<level>-<paper>-<tz>`), so question cards link to the full paper.
- Other banks' manifests are unchanged.

## Rebuild

```bash
node scripts/build-ib-business-management-archive-inventory.mjs
npx tsx scripts/build-whole-paper-archives.mts --identity-review docs/ib-business-management-archive/identity-review.json --inventory docs/ib-business-management-archive/archive-inventory.json
```

Private state (bindings, receipt) is saved to `research/ib-business-management-free-papers-2026-11/paper-archive-state/`.

## Publish (owner approved in chat, 24 November 2026: "Yes, publish 120 PDFs")

- **Script:** `scripts/publish-added-free-papers.mts` (wrangler, no keys).
- **Plan:** 120 PDFs (104.7 MB) that the manifests approve and `origin/main`'s don't. All are `ib-business-management*`,
  and no existing object changes its download name.
- **Upload:** add-only, 2 at a time: check-absent → put → read-back (SHA-256 and size). 120 of 120 present and read
  back, 0 pre-existing conflicts.
- **Verify:** all 7,960 approved PDFs re-read from `free.pastpaperprep.com` (bytes, type, filename), 0 failed. This
  refreshed `src/data/paper-archive-readback.json` (7,840 → 7,960 objects).
- **Log:** `r2-upload-log.jsonl` (upload and verify events, no credentials).
