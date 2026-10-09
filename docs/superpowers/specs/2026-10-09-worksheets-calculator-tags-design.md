# My Worksheets refresh and calculator tags

Date: 2026-10-09 · Status: approved design, awaiting spec review

## Goal

Teachers and tutors use **Build a paper** to make mock papers to hand out. Today the entry point is a lone
button in the My Worksheets header, the empty state never mentions it, and nothing on a printed paper says
which questions allow a calculator. Success means a teacher on My Worksheets immediately sees how to build
a paper, can reach the builder from any bank, and every printed maths question shows whether a calculator
is allowed.

Out of scope (later phases): the bank-page question explorer redesign and the landing page redesign.

## 1. My Worksheets page (`/worksheets`)

Layout chosen in the visual review ("A panel, slimmed" + "C table"):

- **Header:** back link, eyebrow "Your work", "My worksheets" title in the existing page heading style. No build button in the header.
- **Build panel:** a slim surface card: small paper-with-plus icon, "Build a paper", one line
  "A printable mock from any bank, with its mark scheme.", primary button **Start building →**
  linking to `/worksheets/build`.
- **Saved worksheets:** heading "Saved worksheets · N", then a table with columns Name, Bank, Questions,
  Edited, actions. Actions: **Open**, **Edit**, and a "⋯" menu containing **Delete** (keeps today's
  confirmation dialog and API). Bank shows the bank's display name (e.g. "IGCSE Mathematics 0580"), not the
  slug. Edited shows a relative date ("2 days ago", falling back to the date after a week).
- **Empty state:** dashed box: "No saved papers yet" / "Papers you build, or question sets you save from a
  bank, will appear here." The build panel stays above it.
- **Mobile (< 600px):** table rows collapse into stacked rows (name, then bank · questions · edited, then
  actions).
- Loading and error states keep their current wording.

Files: `src/app/worksheets/page.tsx`, `src/components/WorksheetList.tsx`,
`src/components/worksheet-workspace.css` (and `globals.css` only where existing worksheet rules live).

## 2. "Build a paper" from a bank page

- A secondary **Build a paper** button in the bank hero (`src/app/banks/[slug]/page.tsx`), linking to
  `/worksheets/build?bank=<slug>`.
- `/worksheets/build` reads `bank` from the query and preselects it when the user has access to that bank;
  otherwise it falls back to the current default. No access at all still shows the existing "See plans"
  prompt.
- Bank pages are statically rendered (`dynamicParams = false`, no per-request auth), so the button is a plain
  link; access is decided on the build page, as today.

## 3. Calculator rule (single source of truth)

New module `src/lib/calculator-policy.mjs` (plain JS + JSDoc so both the Node index generator and the
TypeScript app import it). `calculatorAllowed(bank, { paper, year })` returns `true`, `false`, or `null`:

| Bank | Rule |
|---|---|
| `igcse` (0580) | year ≥ 2025: papers 1, 2 → `false`; 3, 4 → `true`. Before 2025: `true`. |
| `igcse-additional` (0606) | year ≥ 2025: paper 1 → `false`; paper 2 → `true`. Before 2025: `true`. |
| `ib-hl`, `ib-sl` (AA, old and new syllabus) | paper 1 → `false`; papers 2, 3 → `true`. |
| `ib-ai-hl`, `ib-ai-sl` | `true` (graphic display calculator on every paper). |
| all other banks | `null` (no tag). |

- Applied where the per-question `calculator` field is produced: `scripts/generate-bank-index.mjs` and
  `metadataFromRaw` in `src/lib/questions.ts`, replacing today's pass-through of raw `calculator`.
- **Data correction:** this changes 691 pre-2025 0606 Paper 1 questions from non-calculator to calculator.
  Evidence: pre-2025 questions on both 0606 papers say "do not use a calculator in this question" (29 on
  Paper 1, 51 on Paper 2), while 2025+ Paper 1 has none; the site's own assessment guide describes 2025+
  Paper 1 as the non-calculator paper. The correction lives in the rule: the raw file
  `src/data/raw/igcse-additional.json` is left untouched because audit tests pin a fingerprint of every
  non-classification field per question (`calculator` included). A test pins exactly which 691 questions
  the rule changes.
- **Badge = the paper's rule.** Some questions on calculator papers forbid a calculator for one part; that
  instruction is already printed in the question image. We do not guess per question from transcribed text.
- **Filter bug:** `src/lib/question-filter.ts` currently treats `null` as non-calculator. Unknown values will
  match neither "calculator" nor "non-calculator".
- The bank-page "Calculator" filter (currently Cambridge-only, under "More filters") also appears for IB AA
  HL/SL, now that they have values. It stays hidden for IB AI (all one value) and non-maths banks.

## 4. Builder: calculator labels on paper rows (no toggle)

Decided against a calculator toggle: calculator status follows the paper, and teachers already choose
papers in "02 / Paper mix".

- Each paper row in "02 / Paper mix" shows the same badge as the PDF ("NO CALCULATOR" solid, "CALCULATOR"
  outlined) when every question for that paper in the current pool shares one value. If the pool mixes
  values (0580/0606 Papers 1–2 across 2025), the row shows no badge.
- For 0580 and 0606 a one-line hint under Paper mix: "Paper 1 is non-calculator from 2025 (0580: Papers 1
  and 2). Set From year to 2025 for a fully non-calculator paper."
- `PaperCandidate` (`src/lib/paper-builder.ts`) gains `calculator: boolean | null` from the index; no change
  to generation logic.

## 5. PDF badge

In `src/lib/pdf-export.ts`, the label row above each question (and its "(continued)" parts) draws a small
badge immediately left of the marks text:

- `calculator === false` → filled black rounded rectangle, white bold uppercase "NO CALCULATOR".
- `calculator === true` → outlined rounded rectangle, dark text "CALCULATOR".
- `null` → nothing (sciences, economics).
- Answer pages: no badge (marks schemes are not sat).
- Printed in grayscale-safe colours; badge height fits the existing 5 mm label band, so page layout and
  the page-break logic from #197 are unchanged.

## Testing

- `calculator-policy` unit tests: every rule row; agrees with all 3,967 0580 raw values; agrees with all
  2025+ 0606 raw values; flips exactly the 691 pre-2025 0606 Paper 1 rows; IB AA/AI derivations by paper.
- Bank index regeneration test: generated `calculator` values match the policy for every maths bank.
- `question-filter`: null matches neither calculator option.
- `WorksheetList`: table, relative dates, bank display names, ⋯ menu delete flow, empty state.
- Build page: `?bank=` preselects an accessible bank and ignores an inaccessible or unknown one.
- `PaperBuilder`: paper-row badges for uniform pools, none for mixed pools; 0580/0606 hint.
- `pdf-export`: badge drawn for true/false, nothing for null, nothing on answers; positions inside the label
  band.
- Manual: run the app locally and check My Worksheets (desktop + mobile width), a bank page button, the
  builder, and a generated PDF with mixed calculator questions, before opening the PR.
