# IB Business Management in Full past papers: receipt (24 November 2026)

PR #515 added the IB Business Management HL and SL topic banks. This change adds their papers to the whole-paper
archive (`/past-papers`), the same way as IB Computer Science (#388).

| Bank | Papers (Nov 2020 – May 2026) | Online marking (report) | Held (PDFs only) |
| --- | ---: | ---: | ---: |
| IB Business Management HL | 49: P1 ×9, P2 ×9 (old guide); P1 ×12, P2 ×12, P3 ×7 (2024 guide) | 7 (every Paper 3) | 42 |
| IB Business Management SL | 41: P1 ×9, P2 ×9 (old guide); P1 ×12, P2 ×11 (2024 guide) | 0 | 41 |

The 12 joint Paper 1s (2024 guide) are one PDF pair each, listed in both banks under a level-neutral download name,
so the change publishes 120 PDFs, not 144.

## Scope

- **Old-guide Paper 1 (Nov 2020 – Nov 2023) is listed with its case study** (9 papers per bank, added 24 November
  2026 in the follow-up to #517). Every question needs the pre-seen case study booklet, so each paper carries it as
  the archive's optional insert (`documents.insert`, label "Case study"), shown as a third reader tab. One booklet
  per session serves HL, SL and both time zones: 7 booklets for 18 papers. Its pinned hash and session check
  (`case_link_check`) come from the acquisition manifest, and the builder checks its cover names Business management
  and the sitting. All 18 are held ("Optional question choices need review": Section A lets candidates choose).
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
- **Reviewed identity:** Nov 2023 Paper 1 SL TZ1. Its mark scheme cover prints 8823 – 5013M (the TZ2 code) against the
  paper's 8823 – 9228; session, subject, level and paper agree on the rendered covers, it is a different file from the
  TZ2 scheme, and its text holds all 22 words unique to the TZ1 paper (12 of 26 for TZ2). Recorded as an IB cover
  misprint in `identity-review.json`.
- **Reviewed identity:** May 2026 Paper 3 HL TZ2. The mark scheme's text layer splits the subject ("Business
  m anagement"); the rendered covers agree on session, subject, level, paper and code 2226 – 3023
  (`identity-review.json`, images in `research/ib-business-management-free-papers-2026-11/identity-evidence/`).

## Syllabus table

17 rows in `data/paper-archives/assessment-structure.json`, written by
`research/ib-business-management-free-papers-2026-11/scripts/add_assessment_entries.mjs`:

- 2016 guide (pages 63–64): SL P1 1 h 15, 40 marks; HL P1 2 h 15, 60 marks; SL P2 1 h 45, 50 marks; HL P2 2 h 15,
  70 marks (Nov 2020 and 2023).
- IB 2021–2022 adaptations (source 50, pages 24–25): SL P1 1 h, 30 marks (one Section A question); HL P1 1 h 15,
  40 marks (Section C removed); SL P2 1 h 15, 30 marks; HL P2 1 h 45, 50 marks (Section C removed) (May 2021 –
  Nov 2022). Every printed cover agrees.
- 2024 guide (pages 45–46): P1 1 h 30, 30 marks (SL and HL); SL P2 1 h 30, 40 marks; HL P2 1 h 45, 50 marks; HL P3
  1 h 15, 25 marks.

## Code

- `whole-paper-extraction.mts`: the IB identity parser accepts the `business-management-` prefix, and a joint paper's
  cover may print "Higher / Standard level" (the May 2024 – May 2026 Paper 1 mark schemes do).
- `paper-question-links.ts`: Business Management bank ids order their parts like IB CS (`ibbm-<year>-<session>-<level>-<paper>-<tz>`), so question cards link to the full paper.
- Follow-up: the archive gains an optional insert document (`whole-paper-types.ts`, `whole-paper-public.ts`,
  `whole-paper-archive.ts`, the builder, the reader and paper page, paper SEO copy). The readback seal adds one
  `…/insert` line per paper that has one, so other banks' manifests and digests are byte-identical.
- Other banks' manifests are unchanged.

## Rebuild

```bash
node scripts/build-ib-business-management-archive-inventory.mjs
npx tsx scripts/build-whole-paper-archives.mts --identity-review docs/ib-business-management-archive/identity-review.json --inventory docs/ib-business-management-archive/archive-inventory.json
```

Private state (bindings, receipt) is saved to `research/ib-business-management-free-papers-2026-11/paper-archive-state/`.

## Publish: old Paper 1 with case studies (needs owner approval)

- **Plan** (`publish-added-free-papers.mts plan` against #517's tip): 43 PDFs (27.9 MB): 18 question papers, 18 mark
  schemes and 7 case study booklets, all `ib-business-management*`. No existing object changes its download name.
  8,003 approved PDFs in total.
- Until the upload and `verify` run, the committed readback no longer matches the manifests, so the library stays
  closed in production and the "committed public readback" test fails. `verify` rewrites the receipt.

## Publish (owner approved in chat, 24 November 2026: "Yes, publish 120 PDFs")

- **Script:** `scripts/publish-added-free-papers.mts` (wrangler, no keys).
- **Plan:** 120 PDFs (104.7 MB) that the manifests approve and `origin/main`'s don't. All are `ib-business-management*`,
  and no existing object changes its download name.
- **Upload:** add-only, 2 at a time: check-absent → put → read-back (SHA-256 and size). 120 of 120 present and read
  back, 0 pre-existing conflicts.
- **Verify:** all 7,960 approved PDFs re-read from `free.pastpaperprep.com` (bytes, type, filename), 0 failed. This
  refreshed `src/data/paper-archive-readback.json` (7,840 → 7,960 objects).
- **Log:** `r2-upload-log.jsonl` (upload and verify events, no credentials).
