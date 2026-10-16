# PDF Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDFs open with a title block, number questions 1…n, get content-based names and file names, and generated papers come out in exam order.

**Architecture:** Pure helpers (`pdf-labels.ts`, `worksheet-title.ts`) compute every string; `pdf-export.ts` only draws them. The title block is opt-in via a new `cover` argument so existing layout tests keep pinning the unchanged placement engine. `generatePaper` gains a final stable sort.

**Tech Stack:** TypeScript, jsPDF, Vitest, Next.js 16 client components.

**Spec:** `docs/superpowers/specs/2026-10-15-pdf-polish-design.md`

## Global Constraints

- Print sizes, page-break rules, darkening, header/footer and the 50-question cap are unchanged.
- Worksheet names are 1–80 characters; a user-typed name is never overwritten.
- Session names: Cambridge `June`/`s` → `May/June`, `March`/`m` → `Feb/March`, `November`/`w` → `Oct/Nov`; IB values print as stored.
- Title font: Young Serif (SIL OFL) for the title only; any font failure falls back to Helvetica bold and never fails the export.
- Copy is short; "PDF" stays in UI copy.

## Review Focus

1. Full-page Question 1 (most science / Paper 4 crops) cannot fit below the block → page 1 must carry the contents list, never a near-blank page, and Q1 must keep its source size on page 2. (Task 4 test.)
2. 50-question contents list overflowing page 1 → rows cap with `+ N more`, nothing drawn into the footer. (Task 4 test.)
3. Questions with `marks: null` → meta line and `Score / N` omit totals instead of printing `NaN`/`0`. (Task 1 test.)
4. Title made only of punctuation / non-Latin script → file name falls back to `pastpaperprep-worksheet.pdf`. (Task 1 test.)
5. Answers-only export → numbering still 1…n, eyebrow says `MARK SCHEME`, no Name/Date/Score row. (Task 4 test.)

**Design addition (flagged to owner 2026-10-15):** when Question 1 does not fit beneath the title block, the rest of page 1 holds the contents list (`#`, topic, source, marks).

---

### Task 1: Pure PDF label helpers

**Files:**
- Create: `src/lib/pdf-labels.ts`
- Modify: `src/lib/presentation.ts` (add `formatQuestionTopic`)
- Modify: `src/components/QuestionExplorer.tsx:205` (reuse `formatQuestionTopic`)
- Test: `src/lib/pdf-labels.test.ts`

**Interfaces:**
- Produces:
  - `formatQuestionTopic(bankSlug: BankSlug, topic: string): string` (presentation.ts)
  - `pdfSessionLabel(bankSlug: BankSlug, session: string): string`
  - `pdfSourceLabel(q: { bankSlug; year; session; paper; component?; id; number }): string` → `2024 May/June · Paper 22 · Q5`
  - `pdfCoverSummary(questions: PdfLabelQuestion[], bankSlug: BankSlug, content: "questions"|"answers"|"both"): { eyebrow: string; meta: string; chips: string[]; totalMarks: number | null; showScore: boolean }`
  - `pdfFileName(bankSlug: BankSlug, title: string): string`

- [ ] **Step 1: Write failing tests** covering: all six session mappings plus IB `May` passthrough; source label with `component` and with id-derived component; eyebrow for `igcse` all Paper 2/4 → `IGCSE MATHEMATICS 0580 · EXTENDED`, mixed papers → no route, `ib-chemistry-hl` → `IB CHEMISTRY HIGHER LEVEL` (catalog title upper-cased, no `IGCSE` prefix), answers → suffix `· MARK SCHEME`; meta `12 questions · 86 marks · 2019–2025`, single year `2024`, any `marks:null` → no marks part and `totalMarks:null`; chips ranked by frequency then alphabetical, 7 topics → 5 chips + `+2 more`; `showScore` false for answers; file name `biology-0610-respiration.pdf`, `"!!!"` title → `pastpaperprep-worksheet.pdf`, long title capped so the name is ≤ 84 chars.

- [ ] **Step 2: Run** `npx vitest run src/lib/pdf-labels.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/presentation.ts (append)
export function formatQuestionTopic(bankSlug: string, topic: string): string {
  return formatPublicLabel(bankSlug === "igcse" || bankSlug === "igcse-additional" ? formatMathsPickerLabel(bankSlug, topic) : topic);
}
```

```ts
// src/lib/pdf-labels.ts
import { BANK_CATALOG, type BankSlug } from "@/lib/catalog";
import { deriveCourseRoute } from "@/lib/course-route";
import { formatQuestionTopic } from "@/lib/presentation";

export type PdfLabelQuestion = { id: string; bankSlug: BankSlug; year: number; session: string; paper: number; number: number; component?: string; marks: number | null; primaryTopic: string };

const CAMBRIDGE_SESSIONS: Record<string, string> = { june: "May/June", s: "May/June", march: "Feb/March", m: "Feb/March", november: "Oct/Nov", w: "Oct/Nov" };
const catalogEntry = (bankSlug: BankSlug) => BANK_CATALOG.find((entry) => entry.slug === bankSlug);

export function pdfSessionLabel(bankSlug: BankSlug, session: string): string {
  return catalogEntry(bankSlug)?.qualification === "Cambridge IGCSE" ? CAMBRIDGE_SESSIONS[session.toLowerCase()] ?? session : session;
}

export function pdfSourceLabel(question: Pick<PdfLabelQuestion, "bankSlug" | "year" | "session" | "paper" | "component" | "id" | "number">): string {
  const component = question.component || question.id.match(/-(\d{2})-q\d+$/)?.[1] || String(question.paper);
  return `${question.year} ${pdfSessionLabel(question.bankSlug, question.session)} · Paper ${component} · Q${question.number}`;
}

export function pdfCoverSummary(questions: readonly PdfLabelQuestion[], bankSlug: BankSlug, content: "questions" | "answers" | "both") {
  const entry = catalogEntry(bankSlug);
  const routes = new Set(questions.map((question) => deriveCourseRoute(bankSlug, question.paper)).filter((route) => route !== "both"));
  const route = routes.size === 1 && !routes.has("") ? [...routes][0] : null;
  const name = entry ? `${entry.qualification === "Cambridge IGCSE" ? "IGCSE " : ""}${entry.title}` : bankSlug;
  const eyebrow = [name, route === "core" ? "Core" : route === "extended" ? "Extended" : "", content === "answers" ? "Mark scheme" : ""]
    .filter(Boolean).join(" · ").toUpperCase();
  const totalMarks = questions.length && questions.every((question) => Number.isInteger(question.marks) && question.marks! > 0)
    ? questions.reduce((sum, question) => sum + question.marks!, 0) : null;
  const years = questions.map((question) => question.year);
  const low = Math.min(...years), high = Math.max(...years);
  const meta = [`${questions.length} ${questions.length === 1 ? "question" : "questions"}`,
    totalMarks === null ? "" : `${totalMarks} ${totalMarks === 1 ? "mark" : "marks"}`,
    years.length ? (low === high ? String(low) : `${low}–${high}`) : ""].filter(Boolean).join(" · ");
  const counts = new Map<string, number>();
  for (const question of questions) {
    const label = question.primaryTopic ? formatQuestionTopic(bankSlug, question.primaryTopic) : "";
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label);
  const chips = ranked.length > 5 ? [...ranked.slice(0, 5), `+${ranked.length - 5} more`] : ranked;
  return { eyebrow, meta, chips, totalMarks, showScore: content !== "answers" };
}

export function pdfFileName(bankSlug: BankSlug, title: string): string {
  const slug = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const titleSlug = slug(title);
  if (!titleSlug) return "pastpaperprep-worksheet.pdf";
  const bankPart = slug(catalogEntry(bankSlug)?.shortName ?? "");
  return `${[bankPart, titleSlug].filter(Boolean).join("-").slice(0, 80).replace(/-+$/, "")}.pdf`;
}
```

Replace `questionTopicLabel` in `QuestionExplorer.tsx:205` with `(question) => formatQuestionTopic(question.bankSlug, question.primaryTopic)`.

- [ ] **Step 4: Run** the new test file plus `npx vitest run src/components/QuestionExplorer` — expect PASS.
- [ ] **Step 5: Commit** `feat(pdf): label helpers for sessions, sources, cover summary and file names`.

### Task 2: Content-based worksheet titles

**Files:**
- Create: `src/lib/worksheet-title.ts`
- Test: `src/lib/worksheet-title.test.ts`

**Interfaces:**
- Consumes: `formatQuestionTopic` (Task 1).
- Produces: `suggestWorksheetTitle(questions: { bankSlug: BankSlug; primaryTopic: string; paper: number }[], existingTitles?: readonly string[]): string`

- [ ] **Step 1: Write failing tests:** one topic → `Respiration`; two → `Algebra & Graphs` (frequency order); three+ → `Algebra, Graphs & more`; no topics → `Paper 2 & 4 mix`, one paper → `Paper 2 mix`, three papers → `Paper 1, 2 & 4 mix`; existing `["respiration", "Respiration 2"]` → `Respiration 3`; 120-char topic → ≤ 80 chars, and with suffix still ≤ 80; empty list → `Practice set`.
- [ ] **Step 2: Run** `npx vitest run src/lib/worksheet-title.test.ts` — FAIL.
- [ ] **Step 3: Implement**

```ts
// src/lib/worksheet-title.ts
import type { BankSlug } from "@/lib/catalog";
import { formatQuestionTopic } from "@/lib/presentation";

type TitleQuestion = { bankSlug: BankSlug; primaryTopic: string; paper: number };
const joinList = (items: string[]) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} & ${items.at(-1)}`;

export function suggestWorksheetTitle(questions: readonly TitleQuestion[], existingTitles: readonly string[] = []): string {
  const counts = new Map<string, number>();
  for (const question of questions) {
    const label = question.primaryTopic ? formatQuestionTopic(question.bankSlug, question.primaryTopic) : "";
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const topics = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label);
  const papers = [...new Set(questions.map((question) => question.paper))].sort((a, b) => a - b);
  const base = (topics.length === 1 ? topics[0] : topics.length === 2 ? `${topics[0]} & ${topics[1]}`
    : topics.length > 2 ? `${topics[0]}, ${topics[1]} & more` : papers.length ? `Paper ${joinList(papers.map(String))} mix` : "Practice set").trim();
  const taken = new Set(existingTitles.map((title) => title.trim().toLocaleLowerCase()));
  const fit = (suffix: string) => `${base.slice(0, 80 - suffix.length).trimEnd()}${suffix}`;
  if (!taken.has(fit("").toLocaleLowerCase())) return fit("");
  for (let n = 2; ; n += 1) if (!taken.has(fit(` ${n}`).toLocaleLowerCase())) return fit(` ${n}`);
}
```

- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(worksheets): suggest content-based worksheet titles`.

### Task 3: Exam order for generated papers

**Files:**
- Modify: `src/lib/paper-builder.ts:5` (`PaperCandidate` adds `number`), end of `generatePaper`
- Test: `src/lib/paper-builder.test.ts`

**Interfaces:**
- Produces: `generatePaper(...)` output sorted by paper, number, year, id. `PaperCandidate` now requires `number: number`.

- [ ] **Step 1: Add failing test:** a pool where targets are `[{paper:4},{paper:2}]` returns papers `2…,4…`, within a paper ascending `number`, ties by `year`; same seed returns identical ids as a set as before (selection unchanged) — compare `new Set(ids)` against the pre-sort selection by calling with the same seed twice and asserting order is sorted.
- [ ] **Step 2: Run** `npx vitest run src/lib/paper-builder.test.ts` — FAIL on order. Fix any fixtures lacking `number`.
- [ ] **Step 3: Implement** — replace the final return:

```ts
  const ordered = [...selected].sort((a, b) => a.paper - b.paper || a.number - b.number || a.year - b.year || a.id.localeCompare(b.id));
  return { questions: ordered, totalMarks: ordered.reduce((sum, question) => sum + question.marks!, 0) };
```

and add `"number"` to the `Pick` in `PaperCandidate`.
- [ ] **Step 4: Run** paper-builder and `src/components/PaperBuilder.test.tsx` — PASS.
- [ ] **Step 5: Commit** `feat(builder): order generated papers like an exam`.

### Task 4: Numbered labels and the title block in the PDF

**Files:**
- Add: `public/fonts/YoungSerif-Regular.ttf`, `public/fonts/YoungSerif-OFL.txt` (copied from the verified local OFL release, 105,136 bytes)
- Modify: `src/lib/pdf-export.ts` (`downloadQuestionPdf`, `placeImage`, `placeMcqAnswer`, job loop, solution-text label)
- Test: `src/lib/pdf-export.verified.test.ts` (update label expectations), `src/lib/pdf-export.cover.test.ts` (new, same jsPDF mock pattern)

**Interfaces:**
- Consumes: `pdfSourceLabel`, `pdfCoverSummary`, `pdfFileName` (Task 1).
- Produces: `downloadQuestionPdf(questions, content, onProgress?, accountMarker?, answerPlacement?, cover?: PdfCover)`; `export type PdfCover = { title: string; bankSlug: BankSlug }`.

Label row (replaces the single grey label): bold 9pt dark `Question ${n}` (+ ` · Mark scheme` for answers, + ` (continued)`), then 7pt grey `pdfSourceLabel(question)` 2mm after it; right side keeps marks + calculator badge for questions, nothing for answers. MCQ row: bold `Q${n}` then grey source, `Answer` + letter unchanged. Solution-text heading: `Question ${n} · Mark scheme`. `n` = index in `questions` + 1 (build `Map<question, number>` before the loop).

Title block (only when `cover` is given): before the job loop call `addPage()` and draw at `y = PDF_TOP_MM + 4`:
- eyebrow 7pt bold burgundy (127,41,58); title Young Serif 20pt ink (29,36,48), `splitTextToSize(title, 194)` max 2 lines (second line ends `…` if cut); meta 9pt grey; chips 7.5pt in rounded rects fill (238,241,247) text (40,54,84), wrapping; if `showScore`: one 8pt grey row `Name ____  Date ____  Score ____ / N` drawn as text + underline lines (omit `/ N` when `totalMarks` null); then a 0.3mm ink rule. Set `nextImageY` to rule + 5.
- Font: `fetch("/fonts/YoungSerif-Regular.ttf")` → base64 → `addFileToVFS` + `addFont(..., "YoungSerif", "normal")`; wrap in try/catch, fallback `setFont("helvetica","bold")`.
- Contents fallback: after the job loop's first question placement, if the first question's first image landed on page 2 (record `firstQuestionPage`), go back with `pdf.setPage(1)` and draw the contents list from the rule down: rows 4.6mm, columns `#` (bold), topic (`formatQuestionTopic`), grey source, right-aligned marks; stop when the next row would cross `297 - PDF_BOTTOM_MM - 6` and print `+ N more` instead.
- `pdf.setProperties({ title: cover?.title ?? "PastPaperPrep worksheet", subject: cover ? summary.eyebrow : "Past paper practice questions", ... })`; `pdf.save(cover ? pdfFileName(cover.bankSlug, cover.title) : "pastpaperprep-questions.pdf")`.

- [ ] **Step 1: Update existing verified tests** to the new label strings: `"2025 November / Paper 11 / Q1"` → assert `"Question 1"` and `"2025 November · Paper 11 · Q1"` are both drawn; `"Official answer"` assertion → `"Question 1 · Mark scheme"`; regex `/Q16$/` → `"Question 1"` at the same y (13). Run them — FAIL.
- [ ] **Step 2: Write `pdf-export.cover.test.ts`** (copy the mock/`beforeEach` block from the verified test, plus `addFileToVFS`, `addFont`, `rect`, `getNumberOfPages` stubs and `global.fetch` returning an ArrayBuffer): (a) short Q1 with cover → no `addPage`, first image y = block bottom (> 27) and height unchanged at source size, title text drawn, `save` called with `mathematics-0580-algebra.pdf`; (b) full-page Q16 with cover → exactly one `addPage`, Q16 placed at source size on page 2, contents row `"1"` and its source drawn after `setPage(1)`; (c) 50 full-page questions → contents ends with `+ N more`, no text y beyond 278; (d) `content: "answers"` → eyebrow ends `· MARK SCHEME`, no `Score` text, label `Question 2 · Mark scheme` for the second question; (e) `fetch` rejects → export still saves, helvetica used; (f) no cover → behaviour identical to before (no title text, filename `pastpaperprep-questions.pdf`).
- [ ] **Step 3: Run** both files — FAIL.
- [ ] **Step 4: Implement** per the description above; copy font files.
- [ ] **Step 5: Run** `npx vitest run src/lib/pdf-export` — PASS.
- [ ] **Step 6: Commit** `feat(pdf): numbered questions and a page-1 title block`.

### Task 5: Wire titles and cover into the bank page and builder

**Files:**
- Modify: `src/components/QuestionExplorer.tsx` (`openPdfBuilder` default name, `handleDownload` cover arg)
- Modify: `src/components/PaperBuilder.tsx` (name state, fetch existing titles, suggest after generate)
- Test: `src/components/PaperBuilder.test.tsx`, existing QuestionExplorer tests that assert the old default name

**Interfaces:**
- Consumes: `suggestWorksheetTitle` (Task 2), `PdfCover` (Task 4).

- [ ] **Step 1: Failing tests:** PaperBuilder — after Generate with only "Algebra" questions, the name field reads `Algebra`; after the user types a name and regenerates, the typed name stays; when `/api/worksheets` returns `[{title:"Algebra"}]`, the suggestion is `Algebra 2`; when that fetch fails, suggestion is `Algebra`. QuestionExplorer — update any test expecting `IGCSE … Worksheet 1` to the new topic-based default.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
  - PaperBuilder: `const [nameEdited, setNameEdited] = useState(false)`; `const [existingTitles, setExistingTitles] = useState<string[]>([])` loaded once via `fetch("/api/worksheets")` → `payload.worksheets.map(w => w.title)` (ignore failures). Bank change: `setName("")`, `setNameEdited(false)`. After `setDraft(result)`: `if (!nameEdited) setName(suggestWorksheetTitle(result.questions.map(q => ({ ...q, bankSlug: bank, primaryTopic: byId.get(q.id)?.primaryTopic ?? q.primaryTopic })), existingTitles))`. Input `onChange` sets `nameEdited(true)`.
  - QuestionExplorer `openPdfBuilder`: replace the `bankLabel`/`Worksheet 1` block with `setWorksheetName(suggestWorksheetTitle(exportQuestions))`, then fire-and-forget `fetch("/api/worksheets")` and, if the name is still the unedited suggestion, replace it with the de-duplicated one (`setWorksheetName(current => current === first ? suggestWorksheetTitle(exportQuestions, titles) : current)`).
  - `handleDownload`: pass `{ title: worksheetName.trim() || suggestWorksheetTitle(exportQuestions), bankSlug: bank }` as the 6th argument.
- [ ] **Step 4: Run** component tests — PASS.
- [ ] **Step 5: Commit** `feat(worksheets): content-based default names and titled PDFs`.

### Task 6: Verification

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` in the worktree — all pass.
- [ ] Real export check on the local dev server with an entitled account: Maths 0580 (both answer orders), Biology 0610 (full-page Q1 → contents page), an MCQ bank (answers-only). Render every page of each downloaded PDF to PNG and inspect: title block, numbering 1…n, sources, contents list, file name; compare each placed image's aspect ratio with its source.
- [ ] Commit any fixes; push branch and open the PR (merge only on owner's say-so).
