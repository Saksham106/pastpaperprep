# IGCSE science printed marks repair (0620, 0654; 0610 census only)

Follow-up to the Physics 0625 repair (#320, `docs/0625-printed-marks-repair.md`), using the same census on the other science banks' written papers (components 3x–6x).

**Census.** `scripts/census-igcse-printed-totals.py` reads each question paper's text layer. It prefers the clean May/June 2026 replacement PDFs (`../research/papacambridge-clean-20261013/sources/`) over watermarked copies; the printed totals are the same in both.
- It attributes every printed `[Total: N]` to its question. Single-part questions use their printed part mark.
- A paper is accepted only when its totals sum exactly to the printed maximum (the component's standard maximum where the cover is not machine-readable: 80/80/40/40, or 120/120/60/60 for 0654) with the stored question count.
- Every accepted total also agrees with the row's stored transcript `[Total: N]` where present: 0620 984/984, 0610 902/902, 0654 1,354/1,354.
- Papers that do not reconcile are listed in `scripts/data/igcse-science-printed-marks-census.json` and left unchanged.

| Bank | Written papers accepted / unresolved | Totals corrected |
| --- | --- | --- |
| Chemistry 0620 | 205 / 1 | 62 (60 too low, 2 too high) |
| Coordinated Sciences 0654 | 152 / 4 | 3 (too low) |
| Biology 0610 | 206 / 4 | none here (see below) |

- **0620 exception.** `0620-2026-m-32-q3` keeps its deliberately null total (the removed-part exception from #140).
- **0610.** The census finds 3 differences. `0610-2019-s-31-q3` (4 → 10) is already served correctly through the reviewed historical-crop overlay. `0610-2019-s-61-q1/q2` (stored 20/20, printed 19/21; the paper total of 40 is unchanged) are served by a separate reviewed marks overlay:
  - `scripts/build-0610-printed-marks.mjs` derives `src/data/reviewed-biology-printed-marks.json` from this census. It lists every reconciled census difference that no earlier repair corrects, and requires the crop overlay's marks to agree with the census.
  - `printedMarks` (`src/lib/reviewed-biology-printed-marks.ts`, mirrored in `scripts/generate-bank-index.mjs`) applies it after the crop overlay and fails closed on drift.
  - The finalized runtime and the crop overlay's upload manifest and receipt stay byte-identical.
  - Independent evidence: the printed `[Total: 19]` / `[Total: 21]`, the stored question text, and the mark scheme's part marks (Q1 3+1+1+2+2+2+2+6 = 19, Q2 3+3+1+1+1+2+1+2+4+2+1 = 21) all agree. The free paper archive already listed 19/21.

**Repair.** `scripts/reseal-igcse-printed-marks.mjs` changes only `marks`/`maxMarks` on the listed rows, keeps the private index in step, and records `printedMarksRepair` with the full change list. `--check` replays byte for byte.

At load, `withoutPrintedMarks` (src/lib/igcse-runtime.ts) rebuilds the exact sealed baseline from that list and must reproduce the pinned baseline runtime hash. Every earlier repair seal then checks the release it was written for, unchanged. `assertPrintedMarksRepair` then pins the change list and the repaired content. No assets, crops, classifications or storage objects change.
