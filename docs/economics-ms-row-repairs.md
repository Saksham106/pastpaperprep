# 0455-2022-s-21: mark-scheme rows served to the wrong question

**Date:** 2026-10-23. Paper: IGCSE Economics 0455/21, May/June 2022 (Paper 2).

## Defect

Students saw an incomplete, mislabelled scheme for `0455-2022-s-21-q4`: one crop with two rows, both printed "4(d)".

The cause is in Cambridge's published scheme (`0455_s22_ms_21.pdf`, SHA-256 `1e24d415…`, 23 pages; cover reads
0455/21, May/June 2022). Its Question 4 rows are misnumbered:

| Question paper | Mark scheme row | Printed label | Marks | Page |
|---|---|---|---|---|
| 4(a) Define privatisation. | present | *(empty)* | 2 | 18 |
| 4(b) Explain the difference between absolute poverty and relative poverty. | present | "4(d)" | 4 | 19 |
| 4(c) Analyse how specialisation can benefit firms. | present | "4(d)" | 6 | 19 |
| 4(d) Discuss whether or not the use of supply-side policy measures will reduce unemployment. | **absent** | — | 8 | — |

The scheme goes from the specialisation row straight to 5(a). Nothing in it mentions supply-side policy.
Three mirrors were checked, and all have the same rows: Best Exam Help (our pinned copy), PapaCambridge (byte-identical)
and papers.xtremepape.rs (a 2023 Ghostscript re-encode of the same Cambridge file, SHA-256 `a55a2b82…`).

The segmenter assigns rows by printed label. The unlabelled 4(a) row therefore went to Q3, as part of the 3(d)
continuation above it, and Q4 started on page 19. The 2026-10-02 written-answer repair
(`docs/economics-written-crop-repairs.md`) tightened Q4's page-19 crop, but could not move a row between questions.
It held Q2 and Q3.

## Paper audit

`scripts/build-economics-ms-row-repairs.py` audits every row of every table in the scheme. Rows are the bands
between full-width rules, and each row belongs to its printed question number, or to the row above if it is a
continuation. The unlabelled row is matched to QP 4(a) by its stem. Every word of every row must sit inside its
owner's served crops and inside no other question's crops. Today's crops for Q1–Q5 fail in exactly these places:

- `p18 449.76–524.82`: the 4(a) row is outside Q4's crops and inside Q3's page-18 crop.
- `p15 264.36–352.08`: Q2's page-15 crop ends at 273.7pt, below the repeated table header and into the top of the
  "3(a) Identify two influences…" line.

Q1 and Q5 pass. The repaired crops pass with no problems.

## Repair

| Question | Change | New crop |
|---|---|---|
| `0455-2022-s-21-q2` | Page 15 ends at the rule closing 2(d) (223.44pt) | `e8a6c0bf…` 1263×226 |
| `0455-2022-s-21-q3` | Page 18 ends at the rule closing 3(d) (450.24pt), so it no longer shows 4(a) | `4b2165f9…` 1263×566 |
| `0455-2022-s-21-q4` | 4(a) row from page 18, then today's page-19 crop (4(b), 4(c)) | `99a7fe82…` 1085×113, `cb462488…` (unchanged bytes) |

Each crop is re-rendered with the renderer that answer already uses. Q2 and Q3 use the segmenter's full-width
method, which reproduces today's crops pixel for pixel. Q4 uses the written-answer grid method, which reproduces
today's crop byte for byte. Q2 and Q3 keep their first three released crops unchanged.

- Package: `research/economics-ms-row-repair-20261023/` (`build-a`, `build-b`: two byte-identical builds).
  Python 3 with pymupdf and pillow:
  `python -I scripts/build-economics-ms-row-repairs.py <igcse-economics-0455-topic-practice> <written-grid-v2-paper2/economics-written-source-grid.json> <package>/build-a`
- `scripts/build-economics-ms-row-repairs.mjs <package> [--check]` writes `src/data/reviewed-economics-ms-row-repairs.json`
  and `data/storage/economics-ms-row-repairs.manifest.json`. That is 4 objects, 69,130 bytes, under
  `repairs/economics-ms-rows-v1-553ea0b9b40c08cd`. Each entry is bound to the raw runtime paths and hashes and to the
  crops served today.
- `reviewedMarkschemePaths` checks this overlay before the written-answer overlay. Stale paths or hashes throw. The
  index generator projects the same counts: Q4 goes from 1 to 2 answer images, and Q2 and Q3 stay at 4.
- The printed labels stay as Cambridge printed them. The crops are source images, and 4(b)/4(c) still read "4(d)".

## Not repairable from source

4(d) [8] has no published scheme, so the served scheme covers 12 of Q4's 20 marks. The overlay records this
under `officialSchemeGaps`. In this paper every Section B 8-mark Discuss part that is printed (2(d), 3(d), 5(d))
uses the same level table: L3 6–8, L2 3–5, L1 1–2, 0. The Section A Discuss parts (1(g), 1(h)) are point-marked,
"up to 4 marks for why it might / might not". Any explanation of 4(d) must not cite official mark codes for it.

## Upload (owner approval)

`WRANGLER_BIN=<wrangler> node scripts/upload-reviewed-economics-ms-row-repairs.mjs <package>` (`--dry-run` checks
locally). It is create-only, uses the single-writer lock, re-reads every object in full and writes
`data/storage/economics-ms-row-repairs.receipt.json`. 2022 is not 0455's free year (2021), so nothing goes to
the public bucket. The superseded objects stay in place: `markschemes/0455-2022-s-21/q2-4-15.webp`, `q3-4-18.webp`
and `repairs/economics-written-v1-…/cb462488….webp` (the last is still byte-identical to Q4's second crop).
