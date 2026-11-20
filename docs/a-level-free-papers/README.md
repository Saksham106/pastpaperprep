# Cambridge A Level in Full past papers: receipt (20 November 2026)

All five A Level banks, Maths 9709 (#496), Physics 9702 and Chemistry 9701 (#498), Biology 9700 and Economics 9708
(#500), are added to the free whole-paper library at `/past-papers`, the same way as IGCSE and IB. The owner asked for it in chat ("we should probably also do
the free papers thing, same way we do for IGCSE and IB").

| Bank | Papers (2020–2026) | Online marking (report) | Held (PDFs only) |
| --- | ---: | ---: | ---: |
| Maths 9709 | 276: Feb/March variant 2, May/June and Oct/Nov variants 1–3, Papers 1–6 | 274 | 2 |
| Physics 9702 | 147: Papers 1, 2 and 4; variant 4 from May/June 2025 | 146 | 1 |
| Chemistry 9701 | 147: Papers 1, 2 and 4; variant 4 from May/June 2025 | 145 | 2 |
| Biology 9700 | 144: Papers 1, 2 and 4; variant 4 from May/June 2025 | 128 | 16 |
| Economics 9708 | 197: Papers 1–4 | 93 | 104 |

Report papers carry exactly the runtime marks: 0 of 12,860 questions differ, and every paper totals its syllabus maximum.

## Scope

- **Components:** the question paper and mark scheme of every paper in the topic bank, as for IGCSE and IB. No inserts
  exist for these components. Practical Papers 3 and 5 (9702/9701) are not in the banks, so they are not listed, and
  confidential instructions are never published. Examiner reports are not published for any board.
- **Years:** 2020–2026, the bank's years. Oct/Nov 2026 is not out yet.
- **Reprinted variants:** Cambridge reprints one variant's questions as another variant of the same series (60 papers,
  e.g. 9709/23 = 9709/22 in May/June). The bank keeps those questions once. The archive lists every printed variant
  with its own PDFs, and its report reuses the canonical rows its runtime `aliasIds` name (`reprintQuestionIds` in the
  inventory, same printed numbers enforced). 9701 May/June 2026 Paper 43 is a partial reprint: 8 of its 9 questions
  reuse Paper 41's rows and Q4 is its own.

## Held papers (PDFs only, no report)

- **9709-2024-s-33, 9701-2025-s-42:** reviewed report holds (`data/paper-archives/report-holds.json`). The official
  mark scheme has no rows for 9709/33 Q11, and none for 9701/42 Q5(c). Both questions are withheld from practice too.
- **9702-2021-s-42** ("Question and markscheme maxima disagree"): Cambridge's mark-scheme cover misprints "Maximum
  Mark: 40" on this 100-mark paper.
- **9709-2021-w-23, 9701-2026-m-12** ("Printed and runtime question inventories do not reconcile"): the extractor
  misses one printed question number (no text on its line, and a font that changes per page). This fails closed.
  The same holds 9700-2021-w-13, -2023-w-11, -2025-s-44 and 9708-2023-s-11, -2023-w-13, -2024-s-12, -2025-s-14,
  -2025-w-13, -2025-w-32.
- **"Optional question choices need review":** 9708 essay papers (Papers 2 and 4: 94) and 9700 Paper 4 in 2020–2021,
  whose Section B was a choice (13). The same rule holds IGCSE 0455 Paper 2.
- **9708-2025-w-22, -w-23, 2026-s-22, -s-23:** Cambridge published these question papers with an image-only cover (no
  text layer). Each is accepted by a reviewed identity case and is listed with its PDFs only. They are also
  optional-choice papers.
- **Not listed:** 9700-2020-m-12, -m-22, -m-42. Their Feb/March 2020 mark schemes exist only as stamped copies (Best
  Exam Help), a re-distill with a margin stamp, or a teachifyme.com-stamped copy (Exam Easy).

## Sources and stamps

- **Origin and hashes:** Best Exam Help, plus the documented Exam Easy host exceptions. All are SHA-256 pinned in each
  `cambridge-a-level-*-topic-practice/data/acquisition-manifest.json` and re-hashed when the inventory is built.
- **2020 cover stamps:** every 2020 Feb/March and May/June QP and MS from Best Exam Help carries a `bestexamhelp.com`
  line on page 1. 149 of 152 are replaced by clean copies of the same files: 121 from Exam Easy and 28 from pastpapers.co
  (`clean-sources.json`). For each one:
  - no host stamp on scan;
  - same page count;
  - identical page text once the stamp is ignored;
  - 0 differing pixels on pages 2+;
  - the same producer and creation time as the stamped file, and no later modification.

  Evidence: `research/stamp-scan-a-level-2026-11/`. None of the 152 stamped hashes appears in a manifest.
- **Scanner:** `scan-source-watermarks.py` over all 1,822 bound PDFs flags no host stamp. Its 29 flags are 9708
  question papers citing their data sources under extracts (tradingeconomics.com, reuters.com, statista.com …). These
  are the same 29 files the 9708 acquisition receipt lists as Cambridge's own text.
- **Identity:** 906 of 911 pairs pass the cover checks directly. Five are accepted through reviewed cases
  (`identity-review.json`, hash-bound rendered covers):
  - 9702-2021-m-22: the mark scheme prints the template placeholder `9702/COMP`.
  - 9708-2025-w-22, -w-23, 2026-s-22, -s-23: the question papers' covers are images with no text layer.

  Build with `--identity-review docs/a-level-free-papers/identity-review.json`.

## Builder changes

- **Cambridge cover rules for A Level** (`cambridgeFamily`) and the production runtime cohort for `a-level-*`.
- **`margin` question starts**, gated to the A Level banks (`MARGIN_START_BANKS`), so other manifests keep their
  extractor version. A Level questions can open with a diagram (9709) or a shifted-glyph word (9701 MCQ), which the
  strict rule missed on 17 papers.
- **9701 covers:** the MCQ layout check also reads the shifted-glyph "Multiple Choice" (`0XOWLSOH &KRLFH`).
- **Syllabus table:** 244 A Level rows in `data/paper-archives/assessment-structure.json`, cited to the 2019–2028
  syllabuses. 9701 and 9700 Paper 1 is 60 minutes in 2020–2021 and 75 minutes from 2022. 9708 changed in 2023: Paper 2
  went from 90 minutes and 40 marks to 120 minutes and 60 marks, and Paper 4 from 135 minutes and 70 marks to
  120 minutes and 60 marks.

## Rebuild

Scripts and evidence live in `research/a-level-free-papers-2026-11/` (`scripts/build_inventory.mjs`,
`scripts/add_assessment_entries.mjs`, `identity-evidence/`). The private state (inventories, bindings, receipt) is
saved to `research/a-level-free-papers-2026-11/paper-archive-state/`.

```bash
node ../research/a-level-free-papers-2026-11/scripts/build_inventory.mjs "$PWD" "$PWD/private/paper-archives/inventory" ../research/stamp-scan-a-level-2026-11/results.json
npx tsx scripts/build-whole-paper-archives.mts --identity-review docs/a-level-free-papers/identity-review.json $(for b in maths-9709 physics-9702 chemistry-9701 biology-9700 economics-9708; do echo --inventory private/paper-archives/inventory/inventory-a-level-$b.json; done)
```

Biology 9700 and Economics 9708 joined after #500 merged. The syllabus rows for them come from
`WITH_HELD=1 node .../add_assessment_entries.mjs .`.

## Publish (owner approved in chat, 20 November 2026)

Published with `scripts/publish-added-free-papers.mts` (wrangler, no keys).

- **Plan:** 1,140 PDFs (511.8 MB) that the manifests approve and `origin/main`'s don't. All are `9709_*`, `9702_*`
  or `9701_*`, and no existing object changes its download name.
- **Upload:** 2 at a time. For each PDF, a staged copy was hash-checked, the key was found absent, the PDF was put,
  and it was read back with matching SHA-256 and size.
  - Result: 1,140 of 1,140 present and read back, with 0 pre-existing conflicts and one transient `get` retry.
  - Log: `r2-upload-log.jsonl` (no credentials).
- **Verify:**
  - The first full run stopped one existing IB Biology object at 2 MiB with an HTTP/2 stream error (curl 92). A fresh
    fetch returned the full file with the right hash.
  - The second full run read back all 6,626 approved PDFs from `free.pastpaperprep.com` through DoH, and bytes, type
    and filename matched for every one.
  - This wrote `src/data/paper-archive-readback.json`: objectsSha256 `c05dd650…`, mappingSha256 `9b466240…`.
- **Storage:** before, `pastpaperprep-free` held 5.44 GB in 67,151 objects. After, it holds 5.96 GB in 68,291
  objects. With `pastpaperprep-assets` at 4.07 GB, R2 totals 10.03 GB, about 0.03 GB over the 10 GB free tier.

### Biology 9700 and Economics 9708 (owner approved in chat, 20 November 2026)

- **Plan:** against this branch's `HEAD`, which holds the three published banks: 682 PDFs (545.2 MB), all `9700_*` or
  `9708_*`.
- **Upload:** 682 of 682 present and read back, with 0 pre-existing conflicts and one transient `get` retry. Log:
  `r2-upload-log-9700-9708.jsonl` (no credentials).
- **Verify:** one full run read back all 7,308 approved PDFs from `free.pastpaperprep.com`, with 0 failures.
  - Receipt: objectsSha256 `e16c3952…`, mappingSha256 `28963f1c…`.
- **Storage:** a bucket listing through the Cloudflare API finds exactly 7,308 objects under `papers/v1/` (5.46 GB), the whole approved set, with all 682 new keys present. `wrangler r2 bucket info` still showed the pre-upload metrics an hour later (6.07 GB, +134 objects), so it lags. Expected R2 total: about 10.58 GB (10.03 + 0.55), about 0.58 GB over the 10 GB free tier.
