# IB paper-count gaps (21 October 2026)

Reconciling bank paper counts (PR #395) found two gaps. One is fixed by publishing missing papers; the other by correcting a count.

## IB Math AA HL: three November 2020 Paper 3 options added to Full past papers

**Before.** The question bank holds 110 papers. Full past papers listed 107: of November 2020 Paper 3 it had only *Statistics and probability*. The 2026-10-19 archive build recorded the other three as unpaired: "previously not promoted (source identity); its local source copy was cleared and it was not re-acquired".

**Acquisition.** All six PDFs (three question papers, three mark schemes) were re-downloaded from IB Docs, the host of the live Statistics option, whose files are byte-identical to the live copies (`59b5ea79…`, `93ed849a…`). `docs/ib-hl-nov2020-p3/acquisition.json` pins URL, SHA-256, bytes and pages; the files live in `research/official-sources-20261013/ib-hl-nov2020-p3/<sha256>.pdf`.

- Each mark scheme prints its code: `N20/5/MATHL/HP3/ENG/TZ0/SE/M`, `/DM/M`, `/SG/M`.
- Each question paper prints "Mathematics Higher level Paper 3 – <option>", "Tuesday 10 November 2020 (afternoon)" and "[50 marks]"; its per-question maxima sum to 50, matching the runtime (7+10+18+15; 8+12+13+6+11; 5+10+5+18+12).
- `scripts/scan-source-watermarks.py`: 0 of 6 flagged.

**Why they were rejected, and the identity review.** Their question paper covers (page 2, after the IB licence page) print only the numeric component code (8820 – 7208, 7207, 7209), not the `N20/5/MATHL/HP3` code the automatic identity check reads. `docs/ib-hl-nov2020-p3/identity-review.json` records three `valid-pair` cases, bound to both PDF hashes, with rendered cover pages as visual evidence (`…/ib-hl-nov2020-p3/identity-evidence/`). The verdict covers identity only.

**Build.** `node scripts/build-ib-hl-nov2020-p3-archive-inventory.mjs` writes the inventory: the 107 published pairs re-hashed against the committed manifest at `10299fe5`, plus the three new pairs. Then

```bash
npx tsx scripts/build-whole-paper-archives.mts --inventory docs/ib-hl-nov2020-p3/archive-inventory.json --identity-review docs/ib-hl-nov2020-p3/identity-review.json --bank ib-hl
```

gives 110 paired, 110 reports, 0 held, 0 unpaired. The three new entries are 60 minutes, 50 marks, self-markable. Of the 107 earlier entries, 105 are byte-identical. `2026-may-tz2-p3` and `2026-may-tz3-p3` each gain a secondary topic (Geometry and trigonometry): PR #286 committed a runtime one revision newer than the one its archive was built from, so the archive had lagged since then. `runtimeSha256` now matches the committed `src/data/raw/ib-hl.json`.

**Publication (owner-approved 21 October 2026).** `publish-added-free-papers.mts plan` listed exactly the six PDFs (3.2 MB of 5,486 approved). `upload` added all six to `pastpaperprep-free` under `papers/v1/<sha256>.pdf` with check-absent, put and read-back (0 conflicts). `verify` then re-read all 5,486 approved PDFs from `free.pastpaperprep.com` and rewrote `src/data/paper-archive-readback.json`. Plan and upload log: `docs/ib-hl-nov2020-p3/free-papers-upload-{plan.json,log.jsonl}`.

## IB Chemistry HL: paper count corrected from 93 to 90

**Finding.** The runtime lists 93 papers, but three hold no questions: 2019 May TZ1, May TZ2 and November HL Paper 2 (20 questions). The 2016–2019 extension excluded them in `ib-chemistry-topic-practice/data/classification-extension/classification-contract.json` as "store-truncation: Section B tail (~5 marks) missing from both QP and MS in the acquired source".

**That reason does not hold for the pinned files.** These papers (2016 syllabus) have no Section B. Each question paper runs to printed page 24 of 24 and its marks sum to 90. Each mark scheme ends on the paper's last question, checked by rendering: TZ1 ends at Q7, TZ2 at Q6(e), November at Q7(b). The question crops already exist in the source repo's `site-extension/`.

**Decision (owner, 21 October 2026).** Correct the count now. Re-ingesting the 20 questions (classification, review, runtime and seal regeneration, private R2 upload) is a separate content task. `src/lib/catalog.ts` now says 90. Full past papers is unaffected: it already served these three complete papers.
