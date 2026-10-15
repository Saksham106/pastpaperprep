# Build a paper: one screen, live paper

Date: 2026-10-15 · Status: owner approved option A and section 1 in chat, then asked for the rest to be built · PR B (stacked on PR A, #302)

## Goal

Students (mostly making **topic practice sets**, sometimes mock exams) pick what to
practise and how much, see the paper update live, adjust single questions, and
save or download it from the same screen. You can never pick a filter combination
that has no questions.

## Problems fixed

- Subtopics ignored years and route; nothing showed counts → "only N available" errors after Generate.
- Generate → Preview → Save → Open → Download relay; the PDF couldn't be downloaded from the builder.
- One-question-at-a-time preview hidden behind buttons; no way to swap or remove a single question.

## 1. Layout (approved)

Top bar: page title (Young Serif), bank picker, Core / Extended / All segmented switch (Cambridge banks only).

**Left panel "What to practise"** (sticky on desktop):
- Topic tree: each topic row has a checkbox, label, live count and an expander for its subtopics (each with count). Count 0 → greyed, checkbox disabled (unless already selected, so it can be unticked).
- Years: from–to selects.
- Size: `Questions | Marks` segmented; quick picks 5/10/20 or 25/50/80, plus a number input. Questions capped at 50, marks at 200.
- "Match a real paper" disclosure (closed by default): per-paper targets (questions or marks per paper) with live availability per paper and calculator badges; when any target is set it replaces the Size control.
- Summary line: `✓ 184 questions match` or `No questions match — widen your topics or years`.

**Right panel "Your paper"** styled as a white sheet:
- Header: editable title (PR A suggestion until the student types), `10 questions · 52 marks`, ↻ Shuffle.
- Status line when short: `Only 34 questions match` / `48 of 50 marks — closest possible`.
- Rows: number, topic, grey source (`2024 May/June · Paper 22 · Q5`), marks, calculator badge, ↑ ↓ (reorder), ⇄ swap, ✕ remove. Clicking the row opens the reader.
- Footer actions: **Save PDF** (primary) and **Download PDF** (secondary). After saving: `Saved · Open in My worksheets`; further edits turn the button into **Save changes**.

**Reader**: modal dialog reusing `PaperPreview` (question image, Show answer, previous/next across the paper); heading uses the sheet number and source. Escape / Close returns focus to the row.

**Phone (≤ 900px)**: one column, choices first; a sticky bottom bar `View paper · 10 questions` scrolls to the sheet.

## 2. Data and behaviour

**Catalog.** The builder keeps loading the public bank index (`publicBankIndexUrl`), keeping questions with images and integer marks > 0.

**Topic tree** (`src/lib/builder-topics.ts`):
- Clean maths banks (`igcse`, `igcse-additional`): topics and subtopics from `getMathsPickerSections`; plus `Earlier syllabus` with `mathsEarlierToken` subtopics when historical questions exist. Matching via `mathsTopicMatches` / `mathsSubtopicMatches`.
- Other banks: topics = distinct `primaryTopic` and `secondaryTopics`; a topic's subtopics = distinct `subtopics` of questions whose primary or secondary topic is it. Matching: topic ↔ primary/secondary topic; subtopic ↔ `subtopics.includes`.
- Selection = set of keys `t:<topic>` and `s:<topic>␟<subtopic>`. A question matches when no key is selected, or it matches any selected whole topic, or any selected subtopic. Selecting a topic clears its subtopic keys; selecting every subtopic of a topic is shown as partial (not collapsed).
- Counts per node = questions in the **base pool** (bank, route, years) matching that node alone.

**Pool** = base pool ∩ topic selection ∖ removed ids. In real-paper mode also restricted to papers with a target.

**Live paper** (`src/lib/paper-draft.ts`), recomputed whenever the pool or target changes:
- Keep current questions still in the pool, in current order.
- Questions target N: trim from the end to N, then top up from the seeded shuffle of the rest of the pool.
- Marks target M: trim from the end while total > M; then top up with an exact-sum subset of the rest (≤ 50 questions total); if none exists, greedily add the largest question that fits until nothing fits. Report `exact: false` when the total ≠ M.
- Real-paper targets: the same per paper (questions or marks), papers in ascending order.
- Order: exam order (paper, number, year, id) unless the student reordered; then kept, with top-ups appended.
- Shuffle: new seed, clears current questions and reorder flag (removed ids are kept out).
- Remove: drops the question, adds it to `removed`, and lowers the target (N − 1, or M − its marks; real-paper: that paper's target) so it is not refilled.
- Swap: replace in place with a pool question not in the paper, preferring same marks (marks targets) then same primary topic, then same paper; seeded. Disabled when nothing else matches.
- Changing bank or route resets selection, removed ids, title and saved state.

**URL state** (replaceState, no history spam): `bank`, `route`, `from`, `to`, `t` (selection keys, comma-joined, URI-encoded), `size` (`q10`/`m50`), `papers` (`2q5,4m30`), `seed`. Unknown or invalid values are ignored. The question list itself is not in the URL; the same URL rebuilds the same paper unless edited.

**Save.** New: `POST /api/worksheets` `{ bank, name, questionIds (sheet order), contentMode: "both" }`. Saved: `PATCH /api/worksheets/{id}` with `revision`. Dirty = title or ids changed since last save. Saved titles join `takenTitles`.

**Download.** New `src/lib/worksheet-export.ts` `exportWorksheetPdf({ bank, questions, title, marker, onProgress })`: `fetchPdfAssets(bank, ids, "both")` → `attachPdfAssetMetadata` → `downloadQuestionPdf(..., "both", onProgress, marker, "all-answers-last", { title, bankSlug })`. Builder metadata is mapped to export questions (`bankSlug`, `solution: null`, empty image arrays before signing). The sign route enforces access and the 50-question cap as today. The page passes the same export marker the bootstrap route derives (first 10 hex of sha256(userId), upper-case). Progress `Preparing 3 of 10…`; held-row notice and errors shown under the actions. The bank page keeps its own export path (unchanged).

**Analytics.** Reuse `pdf_export_attempt/success/error` with `source: "builder"`.

## 3. Visual

- Exam Studio tokens: `--paper` page, `--surface-raised` panels, one cobalt action colour, Young Serif for the page title and the sheet title, Geist body, IBM Plex Mono for counts.
- Left panel: flat, no nested cards; topic rows 40px min height, counts right-aligned mono, selected rows tinted `--cobalt-faint`.
- Sheet: white (stays white in dark mode, like the PDF), soft shadow, numbered rows separated by hairlines, action icons quiet until row hover/focus (always visible on touch).
- Copy short: no step numbers, no helper paragraphs.

## Unchanged

Bank page export, PDF engine, sign route, quotas, saved-worksheet schema, My worksheets list.

## Testing

- Unit: topic tree (generic + maths + earlier syllabus), selection matching, node counts; draft keep/trim/top-up, marks exact and closest, real-paper per paper, remove lowers target, swap preferences and exhaustion, determinism by seed; URL parse/serialize round-trip and junk input.
- Component: counts update with years/route, zero rows disabled, live paper without a Generate button, remove/swap/reorder, title suggestion and edit, save then save changes (PATCH), download calls the export helper with title and marker, reader opens and closes with focus return, real-paper targets.
- Browser: the real component on the local dev server through an untracked dev-only harness page (public index, no account), at desktop, tablet and mobile widths in light and dark, with zero horizontal overflow. Save/Download against real accounts is checked on the Vercel preview with an entitled account.
