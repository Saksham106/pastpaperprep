# PDF polish: title block, sequential numbering, smart titles, exam order

Date: 2026-10-15 · Status: approved in chat (option A) · PR A of two (PR B = Build-a-paper redesign)

## Goal

A downloaded PDF should identify itself at a glance and read like a real paper:
a title block on page 1, questions numbered in PDF order, a sensible default
name and file name, and generated papers ordered like an exam.

## 1. Title block (page 1 only)

Drawn above the first question on page 1. Questions follow on the same page; no cover page.

| Row | Content | Rules |
|---|---|---|
| Eyebrow | `IGCSE MATHEMATICS 0580 · EXTENDED` | Catalog `title`, prefixed `IGCSE ` for Cambridge banks (IB titles already start with `IB`), upper-case, burgundy. Route suffix only when every question derives to the same Core/Extended route (`deriveCourseRoute`); otherwise omitted. Answers-only exports append `· MARK SCHEME`. |
| Title | Worksheet name | Young Serif, wraps to at most 2 lines, then truncates with "…". |
| Meta | `12 questions · 86 marks · 2019–2025` | Marks only when every question has integer marks; a single year shows as `2024`. |
| Topics | Up to 5 chips, then `+N more` | Display labels of `primaryTopic` (same formatter the question cards use), most frequent first, ties alphabetical. |
| Fields | `Name ____ Date ____ Score ____ / 86` | `/ total` only when marks are known. Omitted for answers-only exports. |

A rule separates the block from Question 1. The standard page header and footer are unchanged.

**Font.** Young Serif (SIL OFL) TTF committed to `public/fonts/`, fetched and
registered with jsPDF only during export, used only for the title. Falls back to
Helvetica bold if the fetch fails; export never fails because of the font.

**Layout.** The block's height is measured first and the first image placement
starts below it. Print-size rules are unchanged: if Question 1 does not fit
beneath the block at source size, it moves to page 2 (the block stays alone on
page 1) rather than being scaled down.

## 2. Sequential numbering

- Question label: **`Question 1`** (bold), then small grey source
  `2024 May/June · Paper 22 · Q5`, marks and calculator badge on the right as now.
  Continuation pages: `Question 1 (continued)`.
- Answer label: **`Question 1 · Mark scheme`** with the same grey source.
  MCQ answer rows: `Q1` then source, then the answer letter.
- Number = 1-based position of the question in the export list; identical in
  both answer-placement modes and for answers-only exports.
- Session names: `s` → May/June, `w` → Oct/Nov, `m` → Feb/March; any other
  value (IB `May`, `November`) is shown as stored.

## 3. Default worksheet titles

New pure helper `suggestWorksheetTitle(questions, existingTitles)` in `src/lib/worksheet-title.ts`,
used by the bank page (replacing the `IGCSE ADDITIONAL Worksheet 1` logic in
`QuestionExplorer.openPdfBuilder`) and by the paper builder (replacing
`<bank> practice paper`).

- Topics by frequency (display labels): 1 → `Respiration`; 2 → `Algebra & Graphs`;
  3+ → `Algebra, Graphs & more`.
- No topic information → `Paper 2 & 4 mix` (distinct papers ascending; one paper → `Paper 2 mix`).
- If the result case-insensitively matches an existing title of the user's,
  append ` 2`, ` 3`, … (first free number). Result ≤ 80 characters.
- Bank name is not in the title (My worksheets and the PDF eyebrow show it).
- Existing titles come from `/api/worksheets`; if that list is unavailable the
  suffix step is skipped. A user-typed name is never overwritten.

## 4. File name and metadata

- File: `<bank shortName>-<title>` slugified (lower-case ASCII, hyphens, ≤ 80
  chars) + `.pdf`, e.g. `biology-0610-respiration.pdf`. Empty slug → `pastpaperprep-worksheet.pdf`.
- jsPDF `title` property = worksheet name; `subject` = bank title.

## 5. Exam order for generated papers

`generatePaper` returns questions sorted by paper ascending, then original
question number ascending, then year ascending, then id. Selection (which
questions) is unchanged and still seed-reproducible; only order changes.
Hand-picked sets on the bank page keep the user's order.

## Interface changes

- `downloadQuestionPdf(questions, content, onProgress, accountMarker, placement, cover)`
  gains `cover: { title: string; bankSlug: BankSlug }`; eyebrow, chips, meta and
  file name are derived inside from the questions and the catalog.
- `PaperCandidate` adds `number` (already in the public index).
- Single caller: `QuestionExplorer.handleDownload`.

## Unchanged

Print sizes, page-break rules, darkening, header/footer, 50-question cap,
quota/access checks, My worksheets sort (last edited first).

## Testing

- Unit: numbering in both placements and answers-only; session names; chip
  ranking and `+N more`; meta line edge cases; route eyebrow; title helper
  (1/2/3+ topics, paper fallback, dedupe, 80-char cap); file-name slug; exam order.
- Layout: title block pushes Q1 down without changing its scale; tall Q1 moves
  to page 2; existing `pdf-export.layout` / `verified` tests still pass.
- Manual: real exports from Maths 0580, Biology 0610 and an MCQ bank, both
  answer orders, every page rendered and checked.
