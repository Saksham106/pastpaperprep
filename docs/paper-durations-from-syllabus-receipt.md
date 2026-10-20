# Paper duration and total marks from the syllabus (21 October 2026)

Full past papers used to read each paper's duration and total marks off its PDF cover. That can misread: a cover printing "1 hour 2 0 minutes" became 60 minutes. Both values now come from the official syllabus or subject guide, via `data/paper-archives/assessment-structure.json`.

## The table
- **Keys:** bank, exam years, route (Core, Extended, HL or SL), and component.
- **Size:** 556 entries from 63 cited sources: Cambridge syllabuses, including Wayback copies of retired versions, and IB subject guides.
- **Citations:** each entry records the source's URL, SHA-256, page and a short quote.
- **Era changes covered:** for example, 0580 from 2025; 0478 Paper 2 going from 50 to 75 marks in 2023; the IB 2016→2025 science guides; IB Maths HL Paper 3 changing from 60 to 75 minutes after the IB's 2024 correction; and the IB's 2021–22 adapted papers.
- **Where the guide is silent or was misread, the printed papers decide.** Every paper in the range was checked:
  - IB Maths AA HL 2017–2020: 100/100/50 marks (35 covers).
  - IB Physics SL Paper 2 2025–26: 50 marks (8 covers).
  - IB Chemistry/Physics HL Paper 2 2019–24: 90 marks (34 covers).
  - 0455 2017–2019: Paper 1 is 30 marks and Paper 2 is 90, from the official mark-scheme covers (14 papers).
- **One printed exception:** IB Economics HL Paper 3, May 2023, prints 58 marks where the guide says 60.
- **Shared sittings:** IB science Paper 1A and 1B (2025–26) share one sitting, so they carry no per-paper timer. The table records the shared length.

## The audit: 2,751 live papers in 22 banks
- **Already correct:** 2,733 papers (IGCSE 1,757 of 1,767; IB 976 of 984).
- **Corrected:** 5 wrong values, all confirmed against the printed covers:
  - biology-2019-may-tz2-sl-p1: 5 → 45 min.
  - biology-2018-may-tz1-hl-p2 and biology-2019-may-tz2-hl-p2: 120 → 135 min.
  - chemistry-2018-may-tz2-hl-p3: 60 → 75 min.
  - The Nov 2019 IB CS HL Paper 2 (60 → 80 min) was fixed in #388.
- **Filled:** 13 blanks.
  - Durations: IB Biology 2019 HL P1, and IB CS 2019 P1 ×3.
  - Totals: 0580 March 2016 P22/P42 and 0606 March 2016 P12/P22.
  - Both: 0606 June 2026 ×5 and 0455 March 2023 P12.

## Code
- `scripts/assessment-structure.mts` resolves exactly one entry per paper and throws when none or several match, so an unmodelled paper fails the build.
- `build-whole-paper-archives.mts` takes duration and total marks from the table. Cover values are used only when no table is passed (unit fixtures).
- `scripts/apply-assessment-structure.mts` rewrote the committed manifests without re-extracting the PDFs. `--check` verifies them.
- `scripts/assessment-structure.test.ts` fails if any live paper differs from the table, if a marked paper's questions don't add up to its total, or if any entry lacks a citation.
- No PDF changed and nothing was published.

The research files (both audits, the guides and the cover evidence) are in `research/paper-durations/`.
