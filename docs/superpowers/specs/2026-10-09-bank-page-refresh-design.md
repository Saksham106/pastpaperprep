# Bank page refresh and Save PDF flow

Date: 2026-10-09
Status: approved in conversation, awaiting written-spec review

## Goal

Make `/banks/[slug]` calmer and easier to study from, and make saving, not downloading, the way a PDF is made from the bank page.

Students make up most of the page's users. They browse, read a question, reveal the answer and move on. The redesign keeps the current structure (filter sidebar beside a scrolling list) and changes how it looks. It also makes two small filter changes and one flow change: on the bank page, a PDF is saved to My Worksheets and is downloaded from there.

## Decisions taken in conversation

- **Keep the structure.** Keep the sidebar and the list. Don't add a syllabus tree, a dropdown filter bar or a focus/practice mode.
- **Keep the "PDF" wording** because it is simpler for users. The two actions are told apart by verb:
  - **Save PDF** stores the selection in My Worksheets.
  - **Download PDF** produces the file, and only appears where a saved PDF is open.
- The bank page no longer offers a direct download.
- Don't add a "Not practised" filter, and don't add an "Add to an existing worksheet" action from the bank page. Worksheet Edit → Add questions already covers that.

## 1. Question card (visual)

Today's card has a header made of five grey chips, a topic row, an exam image inside a bordered box, a thick cobalt left border and a separate footer. The new card has:

- **One metadata line** in the mono face and muted colour: `2025 May/June · Paper 22 · Q1 · Component 22 · Variant 2 · 1 mark`.
  - Each part appears only when present, as today.
  - The text wraps on narrow screens; there is no horizontal scroll.
- **Add to PDF** stays in the header's top-right as a checkbox with that exact label, styled quieter: muted text, cobalt when checked.
  - Its accessible name stays `Add question N to PDF`.
  - It shows only under the same conditions as today: `unlocked && selectable`.
- **A selected card** gets a cobalt outline, so the selection is visible while scrolling.
- **The topic line** shows the primary topic in bold, then up to four subtopics as muted text separated by `·`, replacing the outlined chips.
- **The exam crop sits directly on the card.** The image keeps its white background, with thin lines above and below it, and the image's own border and radius are removed.
  - This applies to `.question-images img` only.
  - The source-crop and tail-clipped rules keep working, because crops must still render exactly as they do today.
- **The cobalt left border is removed.**
- **The footer is a single row.**
  - Left: **Show answer** as a soft cobalt button (border and faint fill), replacing the bare link text. The Loading and Hide states are unchanged.
  - Right: the Practised badge (if any) and the save (bookmark) icon.
- **The answer panel** gets a small label, "Mark scheme", above the mark-scheme images. Behaviour (worked-text toggle, errors) is unchanged.
- **The locked card** keeps the same content with the new spacing.
- **Dark mode** uses the existing tokens only. No new colour literals are added except where an existing light/dark pair already exists.

## 2. Top of the page

- **Bank hero** (`src/app/banks/[slug]/page.tsx`, `.bank-hero`):
  - Less vertical padding, and a slightly smaller h1 at its maximum size.
  - The stats and the Build a paper button sit on one row on desktop (the button is right-aligned) and stack on phones.
  - The text and links are unchanged.
- **Toolbar** (`.explorer-toolbar`):
  - The unlabelled cobalt download icon becomes a labelled primary button, **Save PDF**.
    - When there is an explicit selection, the button shows the count as a small badge, for example `Save PDF 2`.
    - Its accessible name is `Save PDF`, plus ` (N selected)` when there is a selection.
  - The share icon stays.
  - On phones the toolbar keeps its three rows, so the style contract test keeps the same row count. The Save PDF button sits where the download icon was.
- **Free-access notice** (`.free-value-strip`): a single slim line (bold lead sentence, then the muted sentence, then the plans link styled as text with an arrow) replacing the tall banner with a button. The copy and conditions are unchanged.

## 3. Filters (small structural changes)

- **Years and Papers** move out of "More filters" and always show, in this order: Access, Study, Topics, Subtopics (and Earlier syllabus), Years, Papers, then More filters.
  - "More filters" keeps Sessions, Components, Time zone / variant, Calculator, Granular labels, the economics-only groups, Course era and Paper 3 option.
  - The auto-open rule stays. If a shared or URL state uses a filter that is still inside More filters, the disclosure opens. Years and Papers no longer trigger it.
- **Subtopics follow the chosen topics.**
  - With **no topic selected**, the Subtopics and Earlier syllabus groups show only the subtopics that are already selected (from a URL or shared view), plus a hint: "Pick a topic to narrow subtopics", and a text button, "Show all subtopics".
  - Clicking "Show all subtopics" lists everything, as today. The button then reads "Hide subtopics".
  - With a topic selected, behaviour is unchanged:
    - Clean-maths banks show the relevant subtopics.
    - Other banks show relevant plus selected-outside subtopics, with "Show other subtopics".
  - `showAllSubtopics` resets when the topics change, as today.
- **Checkboxes** (filter groups and the card's Add to PDF): a custom checkbox instead of the native one with only a cobalt tint, which shows a faint, thin tick.
  - Size and border: 16px, 1.5px `--line-strong` border, 4px radius.
  - Checked: a solid `--cobalt` fill with a clearly visible white tick (CSS mask, so it themes correctly).
  - A visible focus ring.
  - The same in light and dark mode. It is still a real `<input type="checkbox">`, so keyboard and screen-reader behaviour are unchanged.
- **Sidebar styling**: clearer group headings, consistent spacing between groups, and a cobalt checked state. There is no change to the markup roles or labels, other than the new hint and button.

## 4. Save PDF flow

This applies on the bank page, outside a saved worksheet and outside a shared set:

1. **Add to PDF** on cards builds the selection, as today. The results line reads `N selected for PDF`.
2. The text button "Use all results for PDF" becomes **Clear selection**. It behaves the same: it clears the explicit selection, so the PDF uses every current result again.
3. **Save PDF** in the toolbar opens the dialog.
   - Gating is the same as today: without `canExportPdf`, the upgrade dialog opens.
   - The `pdf_builder_open` analytics event is kept unchanged.
4. The dialog is titled **Save N question(s) as a PDF**, with the eyebrow "Save PDF".
   - The intro text keeps today's three cases (explicit selection, every current result, or over the 50-question limit), with "worksheet" changed to "PDF".
   - Fields: **Name** (accessible name `PDF name`, default name logic unchanged) and **Include** (Questions / Answers / Both, stored as `contentMode`).
   - **The answer-placement choice is not shown here.** It is a download-time option and stays in the download dialog.
   - The only action is **Save PDF** (primary), plus the close button. **There is no Download PDF button here.**
   - A footnote reads: "Saved to My Worksheets. Download it from there any time."
5. **On success:**
   - The dialog closes.
   - A confirmation replaces "Worksheet saved". It reads **Saved "<name>" to My Worksheets**, with an **Open** link (to the existing `/banks/<bank>?worksheet=<id>` view) and a **My Worksheets** link.
   - The page stays where it is.
   - The selection and the name field are cleared, so the next Save PDF starts fresh and does not duplicate the saved set.
6. **Saving still requires `bankAccess`**, as today. The upgrade dialog copy becomes "Saving PDFs needs paid access" / "Save and download PDFs with paid access to this question bank."
7. **Inside a saved worksheet** (`?worksheet=`), nothing changes:
   - The heading's download icon opens the existing download dialog, which keeps Questions / Answers / Both, answer placement and Download PDF.
   - The icon becomes a labelled **Download PDF** button for clarity, keeping the accessible name `Download PDF`.
   - Edit and Share are unchanged.
8. Shared sets (`?set=`) are unchanged: there is no toolbar and no selection.

The API, the database, the PDF generation, the 50-question limit and the worksheet editing flow are unchanged.

## 5. Out of scope

Landing page (a separate PR), a practice or focus mode, a syllabus tree with counts, a "Not practised" filter, adding to an existing worksheet from the bank page, and data or index changes.

## Testing

- **Update `QuestionExplorer.test.tsx` where it asserts copy that changes:**
  - "Download PDF" in bank mode
  - "Build worksheet from", "Worksheet name" and "Save worksheet"
  - "Use all results for PDF"
  - "Worksheet saved" / "View worksheet"
  - Years living under More filters
- **New tests:**
  - The bank-mode dialog has no Download PDF button.
  - A successful save shows the My Worksheets confirmation with Open and My Worksheets links, and clears the selection.
  - Years and Papers render without opening More filters.
  - With no topic selected, the subtopic list is collapsed with "Show all subtopics", and a URL-selected subtopic is still visible and checked.
  - "Show all subtopics" reveals the full list.
  - The Save PDF button shows its count and accessible name.
  - The worksheet view still offers Download PDF.
- **Update `ux-polish-style-contract.test.ts`** deliberately. Mobile still has three toolbar rows, and the save button takes the download slot. Add assertions that the card has no cobalt left border and that `.question-images img` has no border.
- **Manual browser check on a local build:**
  - 0580 (free, anonymous) and IB AA SL (paid account) at desktop and phone widths, in light and dark mode.
  - Save PDF end to end, then open the worksheet and download.
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` must all pass.

## Style note

UI copy stays short and plain. Don't add explanatory text beyond what is specified here; prefer whitespace and hierarchy to extra labels.

## Risks

- Paying users who used direct download from the bank page now need one extra step (save, then open). This is intended. The confirmation's Open link keeps it to one click.
- Hiding subtopics until a topic is chosen could confuse someone arriving from an old shared link with a subtopic filter. Selected subtopics always stay visible, so that link still shows and clears correctly.
