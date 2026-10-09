# Bank Page Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calmer, student-first `/banks/[slug]` page where "Save PDF" stores to My Worksheets and downloading happens only from a saved worksheet.

**Architecture:** Keep the sidebar and list structure. The changes are mostly CSS in `src/app/globals.css`, small JSX edits in `src/components/QuestionExplorer.tsx` (card, filters, toolbar, dialog, notice) and the hero row in `src/app/banks/[slug]/page.tsx`. There are no API, data or PDF-generation changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, plain CSS, Vitest + Testing Library, `@phosphor-icons/react`.

**Spec:** `docs/superpowers/specs/2026-10-09-bank-page-refresh-design.md`

## Global Constraints

- Keep the "PDF" wording. **Save PDF** saves to My Worksheets. **Download PDF** appears only on a saved worksheet.
- The bank-mode dialog has no Download button.
- UI copy is short and plain. Don't add helper text beyond what this plan specifies.
- Card checkbox accessible name stays `Add question N to PDF`, with visible label "Add to PDF".
- Analytics event names are unchanged.
- The 50-question limit (`MAX_PDF_QUESTIONS`) and gating (`canExportPdf`, `bankAccess`) are unchanged.
- Use existing colour tokens only. The light/dark theme must work.
- The worktree is `.worktrees/bank-page-refresh`. Run `npm ci` there (a real install, not a symlinked `node_modules`).
- Test command for one file: `npx vitest run <file>`. Full suite: `npm test`.

## Review Focus

1. **A shared/URL state with a subtopic but no topic.** The selected subtopic must stay visible and checked while the list is collapsed. (Task 2 test.)
2. **Save PDF after an earlier successful save.** It must start fresh: no explicit selection, empty name, no "unsaved" state. (Task 3 test.)
3. **Worksheet view (`?worksheet=`).** It must still offer Download PDF with answer placement, and no Save PDF. (Task 3 test.)
4. **Anonymous/free user clicking Save PDF.** The upgrade dialog must open with the new copy, and focus must return to the Save PDF button. (Task 3 test.)
5. **Phone toolbar.** It must stay three rows and the labelled Save PDF must fit beside share at 375px. (Task 4 contract test plus browser check.)

---

### Task 1: Question card and checkbox visuals

**Files:**
- Modify: `src/components/QuestionExplorer.tsx` (`QuestionCard` article class and answer panel)
- Modify: `src/app/globals.css` (card rules around lines 597–669, mobile rules around lines 1520–1524 and 1897)
- Test: `src/components/QuestionExplorer.test.tsx`, `src/components/ux-polish-style-contract.test.ts`

**Interfaces:**
- Produces: `.question-card.is-selected` when the card's PDF checkbox is checked, and `.answer-panel-label` ("Mark scheme") as the first child of `.answer-panel` when mark-scheme images exist.

- [ ] **Step 1: Write failing tests**

Add the following to `QuestionExplorer.test.tsx`, near the "keeps an explicit PDF selection" test:

```tsx
  it("outlines a card added to the PDF and labels the mark scheme", async () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((q) => q.markschemeImageCount > 0).slice(0, 3), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/assets/sign") { const body = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}-${request.kind}.webp`] })) }), { status: 200 }); }
      return new Response("{}", { status: 200 });
    }));
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
    const box = screen.getAllByRole("checkbox", { name: /add question/i })[0];
    fireEvent.click(box);
    expect(box.closest(".question-card")).toHaveClass("is-selected");
    fireEvent.click(screen.getAllByRole("button", { name: /show answer/i })[0]);
    expect(await screen.findByText("Mark scheme")).toHaveClass("answer-panel-label");
  });
```

Add the following to `ux-polish-style-contract.test.ts`, at the end of the file:

```ts
describe("question cards are calm study cards", () => {
  it("drops the cobalt rail and the boxed exam image", () => {
    expect(styleFor(globalBlocks, ".question-paper::before")).toEqual({});
    const image = styleFor(globalBlocks, ".question-images img", "base");
    expect(paintsNothing(image.border)).toBe(true);
  });

  it("draws a clearly visible custom checkbox", () => {
    const box = styleFor(globalBlocks, ".filter-group input[type=\"checkbox\"]", "base");
    expect(normalize(box.appearance)).toBe("none");
    expect(Number.parseFloat(box.width ?? "0")).toBeGreaterThanOrEqual(16);
    const checked = styleFor(globalBlocks, ".filter-group input[type=\"checkbox\"]:checked", "base");
    expect(normalize(checked.background)).toBe("var(--cobalt)");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx -t "outlines a card" src/components/ux-polish-style-contract.test.ts`
Expected: FAIL. `is-selected` is missing, "Mark scheme" is not found, `.question-paper::before` is non-empty and `appearance` is undefined.

- [ ] **Step 3: Implement the JSX**

In `QuestionCard`, change the article and the answer panel:

```tsx
    <article className={`question-card question-paper${selected ? " is-selected" : ""}`}>
```

```tsx
      {answerOpen && <div className="answer-panel">{answerAsset?.urls.length ? <p className="answer-panel-label">Mark scheme</p> : null}{answerAsset?.urls.map((source, index) => /* unchanged */)}{/* solution unchanged */}</div>}
```

(Keep the existing image and solution JSX exactly. Only insert the label as the first child.)

- [ ] **Step 4: Implement the CSS**

In `globals.css`:

1. Replace line 597 (`.filter-group input, .pdf-select input, .pdf-options input { accent-color… }`) with:

```css
.pdf-options input { accent-color: var(--cobalt); }
.filter-group input[type="checkbox"], .pdf-select input[type="checkbox"] { appearance: none; width: 16px; height: 16px; margin: 1px 0 0; flex: 0 0 auto; display: grid; place-content: center; background: var(--surface-raised); border: 1.5px solid var(--line-strong); border-radius: 4px; cursor: pointer; transition: background 120ms ease, border-color 120ms ease; }
.filter-group input[type="checkbox"]::before, .pdf-select input[type="checkbox"]::before { content: ""; width: 11px; height: 11px; background: var(--accent-contrast); -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat; transform: scale(0); transition: transform 120ms ease; }
.filter-group input[type="checkbox"]:hover, .pdf-select input[type="checkbox"]:hover { border-color: var(--cobalt); }
.filter-group input[type="checkbox"]:checked, .pdf-select input[type="checkbox"]:checked { background: var(--cobalt); border-color: var(--cobalt); }
.filter-group input[type="checkbox"]:checked::before, .pdf-select input[type="checkbox"]:checked::before { transform: scale(1); }
.filter-group input[type="checkbox"]:focus-visible, .pdf-select input[type="checkbox"]:focus-visible { outline: 2px solid var(--cobalt); outline-offset: 2px; }
.filter-group label:has(input:checked) { color: var(--ink); }
```

2. Replace lines 610–621 (from `.question-card` through `.question-images img, .answer-panel img`) with the following. Keep line 622 onward (source-crop and tail-clipped rules) untouched.

```css
.question-card { overflow: hidden; background: var(--surface-raised); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); transition: border-color 140ms ease, box-shadow 140ms ease; }
.question-card.is-selected { border-color: var(--cobalt); box-shadow: 0 0 0 1px var(--cobalt), var(--shadow-sm); }
.question-paper { position: relative; }
.question-card-header { padding: 14px 18px 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.question-meta { display: flex; flex-wrap: wrap; align-items: center; color: var(--muted); font: 500 .74rem/1.45 var(--font-mono); }
.question-meta span + span::before { content: "·"; margin: 0 7px; opacity: .7; }
.pdf-select { display: flex; align-items: center; gap: 7px; white-space: nowrap; color: var(--muted); font-size: .76rem; font-weight: 700; cursor: pointer; }
.pdf-select:has(input:checked) { color: var(--cobalt-strong); }
.question-topic { padding: 6px 18px 0; display: flex; align-items: baseline; flex-wrap: wrap; font-size: .84rem; }
.question-topic strong { font-weight: 750; }
.question-topic span { color: var(--muted); }
.question-topic span::before { content: "·"; margin: 0 6px; }
.question-images { margin-top: 12px; padding: 18px clamp(16px, 4vw, 42px); display: grid; gap: 12px; background: #fefefe; border-block: 1px solid var(--line); }
.question-images img { width: 100%; max-width: 900px; height: auto; margin: 0 auto; background: #fefefe; border: 0; border-radius: 0; }
.answer-panel img { width: 100%; max-width: 900px; height: auto; margin: 0 auto; background: #fefefe; border: 1px solid var(--line); border-radius: 6px; }
```

3. Replace `.question-actions` (line 661) and `.answer-toggle` (line 663) with the following, and add the label rule:

```css
.question-actions { padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.answer-toggle { min-height: 36px; padding: 0 14px; color: var(--cobalt-strong); background: var(--cobalt-faint); border: 1px solid color-mix(in srgb, var(--cobalt) 40%, var(--line)); border-radius: 8px; font-weight: 750; cursor: pointer; }
.answer-toggle:hover { border-color: var(--cobalt); }
.answer-toggle[aria-expanded="true"] { background: transparent; }
.answer-panel-label { margin: 0; color: var(--success); font: 700 .68rem/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
```

4. Mobile:
   - Line 1520 becomes `.question-card-header { padding: 12px 13px 0; }`.
   - Line 1521 stays.
   - Line 1522 becomes `.question-images { padding: 12px 8px; }`.
   - Line 1897 becomes `.question-actions { padding: 10px 13px; }`.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx src/components/ux-polish-style-contract.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx src/app/globals.css src/components/ux-polish-style-contract.test.ts
git commit -m "feat(bank): calmer question cards and visible checkboxes"
```

---

### Task 2: Years and Papers always visible; subtopics follow topics

**Files:**
- Modify: `src/components/QuestionExplorer.tsx` (`SECONDARY_FILTER_KEYS`, subtopic visibility, sidebar JSX, `FilterGroup` unchanged)
- Test: `src/components/QuestionExplorer.test.tsx`

**Interfaces:**
- Consumes: the existing `showAllSubtopics` state and `subtopicGroups`.
- Produces: the button text "Show all subtopics" / "Hide subtopics" (class `text-button subtopic-more`) when no topic is selected.

- [ ] **Step 1: Write failing tests and update stale ones**

Add:

```tsx
  it("shows Years and Papers without opening more filters", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 40), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={questions} access={fullAccess} />);
    expect(screen.getByRole("group", { name: "Years" }).closest(".secondary-filters")).toBeNull();
    expect(screen.getByRole("group", { name: "Papers" }).closest(".secondary-filters")).toBeNull();
    expect(screen.getByRole("button", { name: /more filters/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("collapses subtopics until a topic is chosen but keeps selected ones visible", () => {
    const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 200), [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { unmount } = render(<QuestionExplorer questions={questions} bankSlug="igcse" access={fullAccess} />);
    expect(screen.queryByRole("group", { name: "Subtopics" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all subtopics" }));
    const subtopics = screen.getByRole("group", { name: "Subtopics" });
    const first = within(subtopics).getAllByRole("checkbox")[0];
    const value = first.getAttribute("aria-label")!.replace(/^Subtopics: /, "");
    expect(screen.getByRole("button", { name: "Hide subtopics" })).toHaveAttribute("aria-expanded", "true");
    unmount();
    const raw = questions.flatMap((q) => q.subtopics).find(Boolean)!;
    render(<QuestionExplorer questions={questions} bankSlug="igcse" access={fullAccess} initialState={{ search: "", sort: "paper", filters: { subtopics: [raw] }, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);
    const kept = within(screen.getByRole("group", { name: "Subtopics" })).getAllByRole("checkbox");
    expect(kept).toHaveLength(1);
    expect(kept[0]).toBeChecked();
    expect(value).toBeTruthy();
  });
```

> **Execution note:** if `raw` is not a picker value for `igcse`, which uses maths-picker tokens, take the value from the first test's revealed checkbox instead. Pass the token used by `filters.subtopics` (check `getMathsPickerSections(bank)[0].value`), and ledger the ruling.

Update the existing tests:
- **"shows clean current subtopics and distinct earlier-only filters":** click `screen.getByRole("button", { name: "Show all subtopics" })` right after render, before querying the groups.
- **"opens additional filters when a shared workspace already uses one":** use `filters: { sessions: [questions[0].session] }`. Assert the Sessions group, and the active-filter chip with that session's label, instead of the years ones.
- **The three tests that click "More filters"** to reach Calculator, Components or Time zone stay as they are.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx -t "Years and Papers|collapses subtopics|clean current subtopics|opens additional filters"`
Expected: FAIL. Years is inside `.secondary-filters`, and the "Show all subtopics" button is not found.

- [ ] **Step 3: Implement**

`SECONDARY_FILTER_KEYS` drops `"years"` and `"papers"`:

```ts
const SECONDARY_FILTER_KEYS: MultiKey[] = [
  "sessions", "components", "calculator", "subjects", "courseEras", "options", "zones", "granularLabels", "officialCodeRefs", "retrievalFacets",
];
```

Replace the `visibleSubtopics` / `earlierSubtopics` block with:

```ts
  const cleanMaths = isCleanMathsBank(bank);
  const subtopicsCollapsed = !filters.topics?.length && !showAllSubtopics;
  const keepSelectedSubtopics = (values: string[]) => subtopicsCollapsed ? values.filter((value) => (filters.subtopics ?? []).includes(value)) : values;
  const visibleSubtopics = keepSelectedSubtopics(cleanMaths
    ? subtopicGroups.relevant.filter(value => !isMathsEarlierToken(value))
    : filters.topics?.length
      ? showAllSubtopics ? subtopicGroups.all : [...subtopicGroups.relevant, ...subtopicGroups.selectedOutsideContext]
      : subtopicGroups.all);
  const earlierSubtopics = keepSelectedSubtopics(cleanMaths && "earlier" in subtopicGroups && Array.isArray(subtopicGroups.earlier) ? subtopicGroups.earlier : []);
```

In the sidebar, directly after the Earlier syllabus `FilterGroup` and before the existing "Show other subtopics" button, add:

```tsx
          {!filters.topics?.length && subtopicGroups.all.length > 0 && <button className="text-button subtopic-more" type="button" aria-expanded={showAllSubtopics} onClick={() => setShowAllSubtopics((show) => !show)}>{showAllSubtopics ? "Hide subtopics" : "Show all subtopics"}</button>}
```

Move the Years and Papers `FilterGroup` lines out of `.secondary-filters-inner` to just before the `more-filters-button`, keeping the Years then Papers order.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx
git commit -m "feat(bank): show years and papers up front; subtopics follow topics"
```

---

### Task 3: Save PDF flow

**Files:**
- Modify: `src/components/QuestionExplorer.tsx` (toolbar button, results heading, PDF dialog, `saveWorksheet` success branch, saved notice, upgrade dialog copy, worksheet heading download button, phosphor import)
- Modify: `src/components/worksheet-workspace.css` (heading download button, saved notice)
- Test: `src/components/QuestionExplorer.test.tsx`

**Interfaces:**
- Produces the following, which Task 4's CSS targets:
  - Toolbar button `.save-pdf-button`, with an optional `.save-pdf-count`.
  - Heading button `.worksheet-download-button`.
  - Dialog class `pdf-dialog is-save` in bank mode.
- Accessible names:
  - Toolbar: `Save PDF`, or `Save PDF (N selected)`.
  - Dialog submit: `Save PDF`.
  - Name field: `PDF name`.
  - Worksheet heading: `Download PDF`.
  - Upgrade dialog title: "Saving PDFs needs paid access".

- [ ] **Step 1: Rewrite the affected tests to the new flow (they fail first)**

1. **"saves the exact ordered selection and content mode as a worksheet":** rename it to "saves the exact ordered selection to My Worksheets without downloading". Replace the dialog section with:

```tsx
    fireEvent.click(screen.getByRole("button", { name: "Save PDF (2 selected)" }));
    const dialog = screen.getByRole("dialog", { name: /save 2 questions as a pdf/i });
    const nameField = within(dialog).getByRole("textbox", { name: "PDF name" });
    expect((nameField as HTMLInputElement).value).toMatch(/^IB SL /);
    expect(within(dialog).queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: /each question followed/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Answers" }));
    fireEvent.change(nameField, { target: { value: "My set" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save PDF" }));
```

   Keep the body assertion. Then replace the tail with:

```tsx
    expect(await screen.findByText(/saved “my set” to my worksheets/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.search).not.toContain("worksheet=");
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/banks/ib-sl?worksheet=worksheet-1");
    expect(screen.getByRole("link", { name: "My Worksheets" })).toHaveAttribute("href", "/worksheets");
    expect(screen.getAllByRole("checkbox", { name: /add question/i }).every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("button", { name: "Save PDF" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    expect((within(screen.getByRole("dialog")).getByRole("textbox", { name: "PDF name" }) as HTMLInputElement).value).toMatch(/^IB SL /);
```

2. **"reopens a worksheet…":** change `.explorer-toolbar .download-button` to `.explorer-toolbar .save-pdf-button`, and add:

```tsx
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(screen.getByRole("radio", { name: /each question followed/i })).toBeInTheDocument();
```

   Only add the answer-placement assertion if the reopened worksheet's content mode is "both". If it isn't, assert the dialog has a `Download PDF` button instead.

3. **"reports a save failure without marking the worksheet clean":**
   - Open the dialog with `screen.getByRole("button", { name: "Save PDF" })`.
   - The name field is `screen.getByLabelText("PDF name")`.
   - Submit with `within(screen.getByRole("dialog")).getByRole("button", { name: "Save PDF" })`.
   - Replace the "unsaved worksheet changes" assertion with `expect(screen.getByRole("dialog", { name: /as a pdf/i })).toBeInTheDocument();`.
   - Keep the alert assertion.

   Selecting a question after the dialog opens is fine: the dialog stays open.

4. **"keeps an explicit PDF selection and opens the export options":**
   - Open with `{ name: "Save PDF (1 selected)" }`.
   - The dialog name is `/save 1 question as a pdf/i`.
   - Focus returns to `screen.getByRole("button", { name: "Save PDF (1 selected)" })`.
   - Add `fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))` and expect `screen.queryByText(/selected for PDF/i)` to be null.

5. **"shows free value first…":** open with `screen.getByRole("button", { name: "Save PDF" })`. The dialog name is `/saving pdfs needs paid access/i` (both places). Focus returns to the `Save PDF` button.

6. **"keeps the PDF download icon visible on hover in both themes":** rename it to "keeps the Save PDF button readable on hover", with regex `/\.save-pdf-button:hover\s*\{[^}]*color:\s*var\(--accent-contrast\)/`.

7. **Any other `/download pdf/i` button query in bank mode** (grep the file) becomes `"Save PDF"`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx`
Expected: FAIL on the rewritten tests ("Save PDF" button not found).

- [ ] **Step 3: Implement**

1. **Import:** add `FilePlus` to the phosphor import.

2. **State:** replace `const [savedWorksheetLink, setSavedWorksheetLink] = useState("");` with:

```ts
  const [savedWorksheet, setSavedWorksheet] = useState<{ href: string; title: string } | null>(null);
```

3. **`saveWorksheet` success, non-editing branch.** Replace the `setSavedWorksheetLink(...)` / `setWorksheetStatus("")` / `setPdfOpen(false)` branch with the code below. The earlier unconditional `setSelectedIds(new Set(saved.question_ids)); setSelectionIsExplicit(true); setWorksheetBaseline(...)` lines move into the `editingExisting` branch, so they only run when editing.

```ts
      if (editingExisting) {
        setSelectedIds(new Set(saved.question_ids)); setSelectionIsExplicit(true);
        setWorksheetBaseline(JSON.stringify({ name: saved.title, ids: saved.question_ids, content: saved.content_mode }));
        setWorksheetStatus("Changes saved.");
      } else {
        setSavedWorksheet({ href: `/banks/${encodeURIComponent(bank)}?worksheet=${encodeURIComponent(saved.id)}`, title: saved.title });
        setSelectedIds(new Set()); setSelectionIsExplicit(false);
        setWorksheetName(""); setWorksheetBaseline("");
        setWorksheetStatus("");
        setPdfOpen(false);
      }
```

   (Check that `setWorksheetName(saved.title)` / `setWorksheetRevision(saved.revision)` stay before the branch, and that the non-editing branch's `setWorksheetName("")` wins.)

4. **Toolbar button.** Replace the toolbar `download-button toolbar-icon-button` line with:

```tsx
        {(!worksheetId || worksheetLoadFailed) && <button ref={pdfTriggerRef} className="save-pdf-button" type="button" aria-label={worksheetId ? "Download PDF" : selectionIsExplicit && selectedIds.size ? `Save PDF (${selectedIds.size} selected)` : "Save PDF"} onClick={openPdfBuilder}>{worksheetId ? <DownloadSimple aria-hidden="true" /> : <FilePlus aria-hidden="true" />}<span>{worksheetId ? "Download PDF" : "Save PDF"}</span>{!worksheetId && selectionIsExplicit && selectedIds.size > 0 && <span className="save-pdf-count" aria-hidden="true">{selectedIds.size}</span>}</button>}
```

5. **Worksheet heading.** Replace the heading's `download-button toolbar-icon-button` button with:

```tsx
<button ref={pdfTriggerRef} className="button secondary worksheet-download-button" type="button" onClick={openPdfBuilder}><DownloadSimple aria-hidden="true" /> Download PDF</button>
```

6. **Results heading.** The "Use all results for PDF" button text becomes `Clear selection`.

7. **Saved notice.** Replace the `savedWorksheetLink &&` notice with:

```tsx
      {savedWorksheet && <div className="worksheet-saved-notice" role="status"><Check aria-hidden="true" weight="bold" /><strong>Saved “{savedWorksheet.title}” to My Worksheets</strong><a href={savedWorksheet.href}>Open</a><Link href="/worksheets">My Worksheets</Link><button type="button" aria-label="Dismiss saved confirmation" onClick={() => setSavedWorksheet(null)}><X aria-hidden="true" /></button></div>}
```

8. **PDF dialog.** Split it into the two modes. The `worksheetId` branch keeps today's download content: eyebrow "Worksheet builder", the "Download N questions" title, the "Only the questions in this worksheet are included." line, content radios, answer placement, the Download PDF button only, the retry button, the dirty note and the pdf status. Bank mode becomes:

```tsx
      {pdfOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfDialogRef} className={`pdf-dialog${worksheetId ? "" : " is-save"}`} role="dialog" aria-modal="true" aria-labelledby="pdf-title"><button className="pdf-close" aria-label="Close PDF options" onClick={() => setPdfOpen(false)}><X /></button>
        {worksheetId ? <>{/* existing download content, minus the !worksheetId-only parts */}</> : <>
          <p className="eyebrow">Save PDF</p>
          <h2 id="pdf-title">Save {exportQuestions.length.toLocaleString()} {exportQuestions.length === 1 ? "question" : "questions"} as a PDF</h2>
          <p>{selectionIsExplicit ? "Using your selected questions." : filtered.length > MAX_PDF_QUESTIONS ? `PDFs are limited to ${MAX_PDF_QUESTIONS} questions. Narrow your filters or select questions.` : "Nothing selected, so this uses every current result."}</p>
          <label className="worksheet-name-field">Name<input aria-label="PDF name" maxLength={80} value={worksheetName} onChange={(event) => setWorksheetName(event.target.value)} placeholder="e.g. Algebra revision" /></label>
          <div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div>
          <div className="worksheet-actions only-save"><button type="button" className="button primary" disabled={!resolvedAccess.bankAccess || !worksheetReady || worksheetLoading || worksheetSaving || !exportQuestions.length || !worksheetName.trim()} onClick={saveWorksheet}>{worksheetSaving ? "Saving…" : "Save PDF"}</button></div>
          <small className="pdf-save-note">Saved to My Worksheets.</small>
          {worksheetStatus && <p role={worksheetStatus.includes("could not") || worksheetStatus.includes("required") || worksheetStatus.includes("unavailable") || !worksheetStatus.endsWith("…") ? "alert" : "status"}>{worksheetStatus}</p>}
        </>}
      </section></div>}
```

   The status role must make "Service unavailable" an `alert` and "Saving worksheet…" a `status`. Keep today's three substrings and add the `!endsWith("…")` fallback so server error messages render as an alert.

   `pdfBuildButtonRef` is only used by the download branch, so leave it there.

9. **Upgrade dialog.** The title becomes `Saving PDFs needs paid access` and the body becomes `Save and download PDFs with paid access to this question bank.`

10. **`worksheet-workspace.css`:**
    - Replace the `.worksheet-workspace-actions .download-button` rule with `.worksheet-download-button { min-height: 42px; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }`.
    - Add `.pdf-dialog.is-save .only-save { display: flex; }` and `.pdf-save-note { color: var(--muted); }`.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx src/components/worksheet-workspace.css
git commit -m "feat(bank): Save PDF saves to My Worksheets; download only from saved PDFs"
```

---

### Task 4: Toolbar, free strip and hero

**Files:**
- Modify: `src/app/globals.css` (toolbar columns at lines 530, 1414 and 1853–1861; `.save-pdf-button`; free strip at lines 583–587, 1501–1503, 1846 and 1890–1895; hero at lines 282 and 448–451)
- Modify: `src/components/QuestionExplorer.tsx` (free strip markup)
- Modify: `src/app/banks/[slug]/page.tsx` (hero meta row)
- Test: `src/components/ux-polish-style-contract.test.ts`, `src/components/QuestionExplorer.test.tsx` (the free-value test already covers copy and links)

**Interfaces:**
- Consumes: `.save-pdf-button` and `.save-pdf-count` from Task 3.

- [ ] **Step 1: Update the contract tests (they fail first)**

In the mobile toolbar `describe`:
- Change `download` to `styleFor(globalBlocks, ".explorer-toolbar .save-pdf-button", mobile)`.
- Expect `grid-template-columns` to be `"minmax(0, 1fr) 44px auto"`.
- Keep the `grid-row` "1" assertion for the save button.
- Rename the "keeps search, share, and download on the first row" test to "keeps search, share, and Save PDF on the first row".

Add:

```ts
describe("free access note is one slim line", () => {
  it("has no border or button inside", () => {
    const strip = styleFor(globalBlocks, ".free-value-strip", "base");
    expect(drawsNoEdge(strip)).toBe(true);
    expect(styleFor(globalBlocks, ".free-value-strip > .button")).toEqual({});
  });
});
```

Add an assertion to "shows free value first…" in `QuestionExplorer.test.tsx`:

```tsx
    expect(screen.getByRole("link", { name: /^view plans$/i })).toHaveClass("free-value-link");
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/ux-polish-style-contract.test.ts src/components/QuestionExplorer.test.tsx -t "free|toolbar|Save PDF on the first row"`
Expected: FAIL (the old columns, the bordered strip, the `.button` link).

- [ ] **Step 3: Implement**

1. **Toolbar columns:** in all three rules, change the trailing `48px` (desktop and line 1414) or `44px` (mobile) to `auto`, and add:

```css
.save-pdf-button { min-height: 48px; padding: 0 16px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: var(--accent-contrast); background: var(--cobalt); border: 1px solid var(--cobalt); border-radius: 7px; font-weight: 800; white-space: nowrap; cursor: pointer; }
.save-pdf-button:hover { color: var(--accent-contrast); background: var(--cobalt-strong); border-color: var(--cobalt-strong); }
.save-pdf-count { min-width: 20px; padding: 1px 6px; color: var(--cobalt-strong); background: var(--accent-contrast); border-radius: 999px; font-size: .72rem; line-height: 1.4; text-align: center; }
```

   On mobile, replace `.explorer-toolbar .download-button { grid-column: 3; grid-row: 1; }` with `.explorer-toolbar .save-pdf-button { grid-column: 3; grid-row: 1; min-height: 44px; padding-inline: 12px; }`.

   Remove the now-unused `.download-button` and `.download-button:hover` rules, but only if a grep shows no other users. Otherwise keep them.

2. **Free strip markup** in `QuestionExplorer.tsx`:

```tsx
      {!bootstrapPending && !resolvedAccess.bankAccess && <div className="free-value-strip"><p><strong>{/* same lead ternary */}</strong> <span>{/* same detail ternary */}</span></p><Link className="free-value-link" href={plansHref}>{PLANS_LABEL}<span aria-hidden="true"> →</span></Link></div>}
```

3. **Free strip CSS:**
   - Split `.access-notice, .free-value-strip` so `.access-notice` keeps its rule.
   - Delete the `.free-value-strip` rules at lines 585–587, 1501–1503, 1846 and 1890–1895, and add:

```css
.free-value-strip { margin-top: 10px; padding: 9px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--cobalt-faint); border: 0; border-radius: 8px; font-size: .84rem; }
.free-value-strip p { min-width: 0; margin: 0; color: var(--ink-soft); }
.free-value-strip p span { color: var(--muted); }
.free-value-link { flex: 0 0 auto; color: var(--cobalt-strong); font-weight: 750; white-space: nowrap; }
@media (max-width: 640px) { .free-value-strip { margin-top: 6px; padding: 8px 12px; font-size: .78rem; } .free-value-strip p span { display: none; } }
```

4. **Hero** in `page.tsx`: wrap the stats and the Build link:

```tsx
          <div className="bank-hero-meta"><div className="bank-hero-stats">{/* unchanged spans */}</div><Link className="button secondary bank-hero-build" href={`/worksheets/build?bank=${slug}`}>Build a paper</Link></div>
```

   CSS:
   - `.bank-hero { padding: 18px 0 16px; … }`, keeping the other declarations.
   - `.bank-hero h1`: change the font size to `clamp(2rem, 3.2vw, 2.8rem)`.
   - Add `.bank-hero-meta { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px 20px; flex-wrap: wrap; }`.
   - `.bank-hero-stats` and `.bank-hero-build` get `margin-top: 0`. In the mobile block at line 1512, also drop `margin-top: 9px`.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx src/components/ux-polish-style-contract.test.ts "src/app/banks/[slug]/page.tsx"
git commit -m "feat(bank): slimmer hero, free note and labelled Save PDF in toolbar"
```

---

### Task 5: Verify and polish in a real browser

**Files:** whatever the check reveals (CSS only, unless it reveals a bug, in which case write a test first).

- [ ] **Step 1:** Run `npm run lint && npm run typecheck && npm test && npm run build`. Expected: all pass.
- [ ] **Step 2:** Start the production build locally and check the following at 1440×900 and 390×844, in light and dark mode:
  - `/banks/igcse?free=1` while anonymous.
  - `/banks/ib-sl` with the paid test account.
  - Card look, checkbox tick visibility, Years and Papers visible, subtopic collapse.
  - Save PDF end to end (selection, save, confirmation, Open).
  - In the worksheet, Download PDF opens the download dialog.
  - The phone toolbar is three rows with Save PDF fitting.
- [ ] **Step 3:** Fix anything visual with CSS, re-run `npm test`, and commit as `fix(bank): <what>`.
