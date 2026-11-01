# IB Maths AA Course Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship free, verified IB Maths AA course notes. That means 83 lessons (one per guide item, 1.1–5.19), topic pages, a course home, cheat sheets, a glossary and command terms, all linked both ways with the AA question banks. The whole course goes live together after the owner's teacher review.

**Architecture:**
- Lessons are structured JSON content blocks in `src/content/notes/ib-math-aa/`.
- They are validated in `npm test`, rendered as fully static App Router pages under `/revision-notes/ib-math-aa/…`, with maths rendered to HTML+MathML on the server by KaTeX.
- Client islands handle the level switch, progress, step reveals, quizzes, glossary pop-ups, calculator tabs and interactive graphs.
- Content is produced by a writer → machine checks → verifier → fixer pipeline, one topic batch at a time.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS modules, KaTeX 0.19 (already a dependency), Vitest. SymPy runs locally in a venv for maths checks. The Workflow tool runs the content batches.

**Spec:** `docs/superpowers/specs/2026-11-01-ib-maths-aa-course-notes-design.md`. The design mockups to follow are `docs/superpowers/mockups/aa-notes/`: `home.html`, `topic-v2.html`, `lesson-a.html` and `cheatsheet.html`.

## Global Constraints

- Source of truth is the IB AA guide, first assessment 2021, via `../research/aa-official-subtopics/official-aa-taxonomy.json`: 83 items, 51 SL and 32 AHL. Every lesson has `edition: "aa-2021"`.
- Never paste guide, booklet, past-paper or third-party text into lessons. Worked examples and checks are original.
- Copy says "Follows the IB Maths AA guide (first assessment 2021)", never "official", plus the existing not-affiliated notice. Keep copy short.
- Pages are fully static: `generateStaticParams` with `dynamicParams = false`. No new API routes (Vercel Hobby has a 12-function cap). No route `loading.tsx`.
- "Updated" and "Last reviewed" dates come from the changelog (`src/lib/updates.ts`), never the build date.
- Notes are free and public. They stay unpublished (not generated, not in the sitemap) until the owner says launch, after the teacher review.
- Design is simple and scannable, with horizontal full-length labels. Young Serif headings, Geist body, the site tokens in `src/app/globals.css`, light and dark.
- SL/AHL is marked by shape plus text, never colour alone. AHL uses the burgundy diamond and "AHL" / "HL only".
- Maths renders on the server with `katex.renderToString(tex, { output: "htmlAndMathml", throwOnError: true })`. No KaTeX JS ships to the browser.
- Owner approval is needed for every merge, production step, R2 write, migration or Vercel env change. Design approval is not merge approval.
- Delegated routine and code work runs on Sonnet at medium effort. Lesson writing and verifying run on Opus, with verify at medium effort. At most 2 heavy build or test agents run at once (machine memory).

## Review Focus

1. **A lesson whose maths is wrong, but whose JSON is valid.** The SymPy receipt and verifier must block it. Test: `lesson without a passing receipt for its current hash fails npm test` (Task 5).
2. **AHL content leaking into an SL lesson, or the SL view showing AHL lessons.** Test: `SL view lists no AHL lessons and shows the +N line` (Task 8), and the validator rule `SL lesson may mention AHL only through hlNote` (Task 3).
3. **A practice link that opens an empty or wrong bank filter.** Test: `practice href for every lesson resolves to ≥1 question in that level's bank, or falls back to its group` (Task 14).
4. **An unpublished course leaking to production** (sitemap, static params, links from bank cards). Test: `unpublished course yields no static params, no sitemap paths and no bank-card links unless NOTES_PREVIEW=1` (Task 6).
5. **Glossary pop-ups failing with keyboard or touch.** Test: `GlossaryTerm opens on Enter, closes on Escape and returns focus` (Task 10).

---

## Phase A: Sources and data (runs in parallel with Phase B)

### Task 1: Acquire the guide and formula booklet

**Files:**
- Create: `../research/aa-course-notes/sources/` (outside Git) and `../research/aa-course-notes/sources/RECEIPT.md`

- [ ] **Step 1:** Using ego-browser (the owner's signed-in profile; see the `observability-access` memory for the CLI recipe), fetch the guide PDF from the URL in the registry's `sources[0].url`. Save it as `sources/aa-guide-2021.pdf`. Never bypass a bot check: if one blocks the fetch, stop and ask the owner to download it.
- [ ] **Step 2:** Run `shasum -a 256 sources/aa-guide-2021.pdf`. Expected: `81941821cc4c7ace86c2a378614975f5972aae098ac9a7d471bed8bee3df7d87`. On a mismatch, stop and report.
- [ ] **Step 3:** Fetch the current Mathematics: analysis and approaches formula booklet (first assessment 2021) from ibo.org the same way, as `sources/aa-formula-booklet.pdf`. Record its URL and sha256 in `RECEIPT.md`.

### Task 2: Extract syllabus items and booklet, twice, into the repo

**Files:**
- Create: `../research/aa-course-notes/extract/items.a.json`, `items.b.json`, `booklet.a.json`, `booklet.b.json`, `diff.md`
- Create: `src/data/aa-official-subtopics/items.json`
- Test: `src/lib/course-notes/items.test.ts`

**Interfaces:**
- Produces: `items.json`, shaped as `{ schemaVersion: 1, edition: "aa-2021", items: Array<{ item: string; topic: 1|2|3|4|5; level: "SL"|"AHL"; name: string; bullets: Array<{ id: string; text: string }>; booklet: Array<{ id: string; label: string }> }> }`.
  - `bullets[].id` looks like `"5.16-b2"`, and `text` is a short paraphrased checklist line, not guide text.
  - `booklet[]` lists the formula entries (paraphrased labels) the booklet gives for that item.

- [ ] **Step 1: Write the failing test** `items.test.ts`:
  - `items.json has exactly 83 items: 51 SL and 32 AHL, matching the registry levels item by item`
  - `every item belongs to exactly one group in taxonomy.json`
  - `every item has ≥1 bullet and bullet ids are unique`
- [ ] **Step 2:** Run `npx vitest run src/lib/course-notes/items.test.ts`. Expected: FAIL (file missing).
- [ ] **Step 3:** Two independent Sonnet agents each extract bullets and booklet entries from the PDFs into `items.a.json` / `items.b.json`. A script diffs them into `diff.md`. Resolve every diff by hand against the PDF, then write `items.json` with paraphrased bullet lines.
- [ ] **Step 4:** Run the test. Expected: PASS. Then ask the owner to spot-check 10 items against the PDF. This doesn't block Phase B.
- [ ] **Step 5:** Commit: `feat(notes): AA syllabus items and booklet map`.

### Task 4: Item-level question tags

**Files:**
- Modify: `src/data/aa-official-subtopics/overlay.json` (add `officialItems: string[]` per record; additive)
- Modify: `src/lib/questions.ts` and `scripts/generate-bank-index.mjs`, to carry `officialItems` through **both** paths, as the `aeo-pass` memory warns
- Test: `src/lib/aa-official-subtopics.test.ts`, plus the existing index-vs-loader parity test

- [ ] **Step 1: Write failing tests:**
  - `every accepted record has ≥1 officialItems entry and each is a member of one of its groupIds`
  - `loader and bank index expose identical officialItems for every AA question`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Run the tagging pass on the 934 accepted records, in chunks of about 60. A Sonnet tagger reads the question text and mark scheme with the group's member items and bullets from `items.json`. A blind Sonnet reviewer re-tags. Disagreements go to an Opus adjudicator. Write a receipt to `docs/aa-official-items-tagging.md`.
- [ ] **Step 4:** Run `npm run generate:bank-index && npx vitest run src/lib/aa-official-subtopics.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(aa): item-level official tags (additive)`.

## Phase B: Platform (branch `feat/aa-course-notes`, worktree `.worktrees/aa-course-notes`)

### Task 3: Lesson schema, inline markup parser and validator

**Files:**
- Create: `src/lib/course-notes/types.ts`, `src/lib/course-notes/inline.ts`, `src/lib/course-notes/validate.ts`
- Test: `src/lib/course-notes/inline.test.ts`, `src/lib/course-notes/validate.test.ts`, plus fixtures in `src/lib/course-notes/__fixtures__/`

**Interfaces:**
- Produces (`types.ts`):
  - `Level = "SL"|"AHL"`
  - `Block`, a union with `type` set to one of `text`, `definition`, `formula`, `result`, `example`, `check`, `figure`, `interactive`, `calculator`, `hlNote`, `examTip`, `mistake`, `fact`. Fields are as in spec §7:
    - `formula` has `tex` and `tag: "booklet"|"learn"`, plus optional `cheatSheet`.
    - `example` has `id`, `question`, `steps[]`, `answer`, an optional `check`, and an optional `video` (always null for now).
    - `check` has `id`, `prompt`, optional `hint`, either `options[]` or a numeric answer `{ value, tolerance }`, and `explain`.
    - `interactive` has `widget: InteractiveId`, `props`, `alt`.
    - `calculator` has `steps: { ti84, nspire, casio }`.
    - `hlNote` has `text` and `lesson`.
    - `fact` has `text`, `tag` and `cheatSheet: true`.
  - `Section = { id; heading; blocks: Block[] }`
  - `Lesson = { schemaVersion: 1; edition: "aa-2021"; item; slug; title; level; topic; summary; goals: { text; bullets: string[] }[]; prerequisites: string[]; papers: ("P1"|"P2"|"P3")[]; synonyms: string[]; before: CheckBlock[]; sections: Section[]; mistakes: string[]; examTips: string[]; readingMinutes: number }`
  - `GlossaryTerm = { id; term; definition; lesson }`
- Produces (`inline.ts`): `parseInline(text: string): InlineNode[]`, where `InlineNode` is one of:
  - `{ kind: "text"; value }`
  - `{ kind: "math"; tex }`
  - `{ kind: "term"; id; label }`
  - `{ kind: "lesson"; item }`

  The syntax is `$…$`, `[[id|label]]` and `{{lesson:5.15}}`, and `\$` escapes a dollar sign.
- Produces (`validate.ts`): `validateLesson(lesson: Lesson, ctx: { items: ItemsFile; glossary: GlossaryTerm[]; lessonItems: Set<string> }): string[]`. It returns an empty array when valid.

- [ ] **Step 1: Write failing tests:**
  - `parseInline` splits text, math, term and lesson tokens, keeps `\$` as text, and throws on an unclosed `$`.
  - `validateLesson`, using a valid fixture lesson plus one mutation per rule. It must report:
    - KaTeX parse errors (`throwOnError`)
    - an unknown glossary id
    - an unknown lesson link
    - an `item` or `level` that disagrees with `items.json`
    - a guide bullet not covered by any goal (the coverage matrix)
    - an SL lesson that names an AHL-only bullet outside an `hlNote`
    - a `formula` tagged `booklet` with no matching `items.json` booklet entry, or the reverse
    - a duplicate example or check id
    - a check with neither options nor a numeric answer
- [ ] **Step 2:** Run `npx vitest run src/lib/course-notes`. Expected: FAIL.
- [ ] **Step 3:** Implement the types, `parseInline` and `validateLesson` in the files above.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(notes): lesson schema, inline markup and validator`.

### Task 5: Content loader, course registry, publish gate and SymPy receipts

**Files:**
- Create: `src/lib/course-notes/course.ts`, `src/content/notes/ib-math-aa/course.json`, `src/content/notes/ib-math-aa/glossary.json`, `src/content/notes/ib-math-aa/command-terms.json`, `src/content/notes/ib-math-aa/lessons/` (one `<item with dot→dash>.json` per lesson, e.g. `5-16.json`), `src/content/notes/ib-math-aa/math-receipts.json`
- Create: `scripts/notes/check-math.py`, `scripts/notes/write-receipts.mjs`, `scripts/notes/sidecars/` (one SymPy assertion file per lesson, not shipped to the browser)
- Test: `src/lib/course-notes/content.test.ts`

**Interfaces:**
- Produces:
  - `COURSES: readonly Course[]`
  - `getCourse(slug): Course | undefined`
  - `getLesson(courseSlug, item): Lesson | undefined`
  - `lessonsForTopic(course, topic): Lesson[]`
  - `lessonPath(course, lesson): string` (gives `/revision-notes/ib-math-aa/<topic-slug>/<item-dashed>-<slug>`)
  - `topicPath(course, topic): string`
  - `isCourseVisible(course): boolean` (true when `course.published` or `process.env.NOTES_PREVIEW === "1"`)
  - `coursePaths(): string[]` (visible courses only)
  - `Course = { slug: "ib-math-aa"; name; published: boolean; banks: { SL: "ib-sl"; HL: "ib-hl" }; topics: { n; slug; name }[]; lessons: Lesson[]; glossary; commandTerms }`
- Topic slugs: `number-and-algebra`, `functions`, `geometry-and-trigonometry`, `statistics-and-probability`, `calculus`.

- [ ] **Step 1: Write failing tests** in `content.test.ts`:
  - `every lesson file passes validateLesson`
  - `prerequisite graph is acyclic and only references existing lessons`
  - `lesson without a passing receipt for its current hash fails npm test`, run over `math-receipts.json`
  - `unpublished course yields no static params, no sitemap paths and no bank-card links unless NOTES_PREVIEW=1`
  - `each lesson's slug is unique per topic`

  While there are fewer than 83 lessons, the 83-lesson completeness check is skipped. It turns on as a launch gate: `course.published` requires 83 lessons.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `course.ts`. Create `check-math.py`: it runs each sidecar's SymPy assertions and prints one pass/fail per id. Create `write-receipts.mjs`: it runs `check-math.py` and writes `{ [item]: { sha256, passedAt } }` for passing lessons only. Create the venv at `../research/aa-course-notes/.venv` with `pip install sympy`. Seed the course with the 5.16 lesson from the mockup, converted to JSON, with `published: false`.
- [ ] **Step 4:** Run `node scripts/notes/write-receipts.mjs && npx vitest run src/lib/course-notes`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(notes): course registry, publish gate, maths receipts`.

### Task 6: Routes and shared shell

**Files:**
- Modify: `src/app/revision-notes/[subject]/page.tsx` and `src/app/revision-notes/[subject]/[topic]/page.tsx`. They branch: `getCourse(slug)` renders the course views, and anything else keeps today's 0620 views unchanged.
- Create:
  - `src/app/revision-notes/[subject]/[topic]/[lesson]/page.tsx`
  - `src/app/revision-notes/[subject]/cheat-sheet/page.tsx`
  - `src/app/revision-notes/[subject]/[topic]/cheat-sheet/page.tsx`
  - `src/app/revision-notes/[subject]/glossary/page.tsx`
  - `src/app/revision-notes/[subject]/command-terms/page.tsx`
- Modify: `src/lib/revision-notes/index.ts` (`notesPaths()` also returns `coursePaths()`)
- Test: `src/app/revision-notes/course-routes.test.ts`

Before writing code, read `node_modules/next/dist/docs/` on dynamic segments, `generateStaticParams` and metadata, as `AGENTS.md` requires.

- [ ] **Step 1: Write failing tests:**
  - With `NOTES_PREVIEW=1`, static params include `ib-math-aa`, its 5 topics and every lesson. Without it, none of them.
  - 0620 params are unchanged.
  - Each page's metadata has a canonical path and an absolute title of 60 characters or fewer.
  - The lesson page emits `LearningResource` JSON-LD, and the course home emits `Course`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the routes, all with `dynamicParams = false`. Static segments (`cheat-sheet`, `glossary`, `command-terms`) take precedence over `[topic]`/`[lesson]`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 7: Server maths rendering and block components

**Files:**
- Create: `src/components/course-notes/Inline.tsx` (server), `Blocks.tsx` (server dispatcher), `FormulaBlock.tsx`, `ExampleSteps.tsx` (client), `CheckQuestion.tsx` (client), `CalculatorSteps.tsx` (client), `GlossaryTerm.tsx` (client), `course-notes.module.css`
- Test: `src/components/course-notes/blocks.test.tsx`

**Interfaces:**
- Consumes: `parseInline`, `Block`, `GlossaryTerm`.
- Produces:
  - `<Inline text glossary />`
  - `<Blocks blocks glossary level />`
  - `<GlossaryTerm id label definition lessonHref />`

Calculator model choice persists in `localStorage["notes-calc"]`.

- [ ] **Step 1: Write failing tests:**
  - `Inline` renders `<math>` (MathML) for `$x^2$`.
  - `ExampleSteps` shows 1 step, then all of them after "Show all", and hides `check` until the last step.
  - `CheckQuestion` marks the right or wrong option, with feedback in an `aria-live` region.
  - `GlossaryTerm opens on Enter, closes on Escape and returns focus`.
  - `hlNote` is not rendered when `level="SL"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement to match `lesson-a.html`'s styles.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 8: Course home (topic rows)

**Files:**
- Create: `src/components/course-notes/CourseHome.tsx`, `LevelSwitch.tsx` (client; `localStorage["notes-level"]`, default `"HL"`), `useNotesProgress.ts` (client; `localStorage["notes-progress:ib-math-aa"]` holds a set of items), `LessonSearch.tsx` (client; matches number prefix, name and `synonyms`)
- Test: `src/components/course-notes/course-home.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - `SL view lists no AHL lessons and shows the +N line`
  - `HL view shows "SL and HL" and "HL only" blocks per topic`
  - `search "by parts" finds 5.16; "2.5" finds 2.5`
  - `Continue points at the first lesson in syllabus order that isn't understood at the current level`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement to match `home.html`. Use full-width topic rows: the tone header on the left with the dot strip, and lessons in `columns: 3 230px` on the right. Phones get collapsible sections.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 9: Topic page (stages)

**Files:**
- Create: `src/components/course-notes/CourseTopic.tsx`
- Test: `src/components/course-notes/course-topic.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - Stages follow `taxonomy.json` group order for the topic.
  - A single-lesson group shows no group name.
  - Counts come from the overlay, per level.
  - The HL band is dimmed in the SL view.
- [ ] **Step 2–4:** Implement to match `topic-v2.html` (subgrid stages, a progress line, and a vertical timeline on phones). Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 10: Lesson page

**Files:**
- Create: `src/components/course-notes/LessonPage.tsx` and `LessonRail.tsx` (client; current section, reading progress; a mobile "Contents" bar)
- Test: `src/components/course-notes/lesson-page.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - The page renders header badges (item · level · papers) and "Builds on" links.
  - It renders sections in order, then common mistakes, exam tips, key takeaways, and Practise this.
  - "I've got this" adds the item to progress.
  - Previous/Next skips AHL lessons in the SL view.
  - "Report a problem" fires `notes_report` with an issue value from a fixed set, and shows `hello@pastpaperprep.com` as text.
  - "Before you start" renders `lesson.before` collapsed, and a wrong answer links the prerequisite lesson.
  - "Last reviewed" comes from the course's changelog entry (`src/lib/updates.ts`), never the build date.
- [ ] **Step 2–4:** Implement to match `lesson-a.html`. Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 11: Interactive graphs

**Files:**
- Create: `src/components/course-notes/interactives/registry.ts` (`InteractiveId` union and a lazy `next/dynamic` map) and one component per widget
- Test: `src/components/course-notes/interactives/interactives.test.tsx`

The widget ids are fixed now, and writers may only use these:
- `parts-area`, `transformations`, `discriminant-roots`, `exp-log-reflection`
- `unit-circle-graphs`, `radian-arc`, `secant-to-tangent`, `derivative-sign`
- `riemann-sums`, `area-between-curves`, `revolution-slice`
- `binomial-shaded`, `normal-shaded`, `z-standardise`, `regression-two-lines`
- `argand-multiply`, `roots-of-unity`, `vector-angle`, `maclaurin-partials`, `euler-step`

Each widget:
- is hand-written SVG with no new chart dependency
- has a static first render, so it never shows as blank when JS is off
- honours `prefers-reduced-motion`
- has a slider with a visible label and value

- [ ] **Step 1:** Write a failing test that every registry id renders a static SVG with `role="img"` and its `alt`, and that slider changes update the numeric readout.
- [ ] **Step 2–4:** Implement in batches of 5 widgets (a Sonnet agent per batch, at most 2 at a time). Each widget's maths is checked against a hand-computed value in its test, for example: `parts-area` at b=2 reads 2.67 / 5.33 / 8.00.
- [ ] **Step 5:** Commit per batch.

### Task 12: Cheat sheets, glossary page and command terms page

**Files:**
- Create: `src/components/course-notes/CheatSheet.tsx`, `GlossaryIndex.tsx`, `CommandTerms.tsx`, and `src/content/notes/ib-math-aa/cheatsheets/<topic-slug>.json` (sheet-only "which method when" lines)
- Test: `src/components/course-notes/cheatsheet.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - A topic sheet lists every `formula`/`fact` block with `cheatSheet: true` from that topic's lessons, in syllabus order, each linking to its lesson.
  - The SL sheet has no AHL entries.
  - The course sheet is the union of the 5 topic sheets.
  - The print stylesheet hides the site chrome.
  - "Save as PDF" calls `window.print()` and fires `notes_cheatsheet_print`.
- [ ] **Step 2–4:** Implement to match `cheatsheet.html`. Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 13: Analytics

**Files:**
- Modify: `src/lib/product-analytics.ts` (add `notes` to `auth_page_view.from`), `docs/analytics-events.md`
- Create: `src/components/course-notes/track.ts`
- Test: `src/components/course-notes/track.test.ts`

**Events** (props `lesson`, `level` on all):
- `notes_lesson_view`
- `notes_example_step`
- `notes_check_answer` (`correct`)
- `notes_glossary_open` (`term`)
- `notes_practice_click` (`bank`, `group`)
- `notes_understood`
- `notes_cheatsheet_print` (`topic` or `course`)
- `notes_level_switch`
- `notes_search` (`found`)
- `notes_report` (`issue`)

- [ ] **Steps 1–5:** Test that each helper calls `trackProductEvent` with the exact name and props and no free text. Implement, wire into the Task 7–12 components, run, and commit.

### Task 14: Bank integration both ways

**Files:**
- Modify:
  - `src/lib/explorer-state.ts` (add the `["item", "officialItems"]` param)
  - `QuestionFilters` in `src/lib/questions.ts` (`officialItems?: string[]`, filtering on Task 4's field)
  - the question card in `src/components/QuestionExplorer.tsx` ("Learn this topic" link, only for visible courses)
  - `src/app/syllabus/[bankSlug]/page.tsx` (item → lesson links)
  - `src/lib/paper-marking-report.ts` (recommend lessons next to practice)
  - `src/components/ExplanationPanel.tsx` ("Revise <topic>" under a mistake)
  - `src/components/HeaderNavigation.tsx` and `SiteFooter.tsx` (a "Notes" link once published)
- Test: extend `explorer-state.test.ts`, `QuestionExplorer.test.tsx` and `paper-marking-report.test.ts`. Create `src/lib/course-notes/practice.test.ts`.

**Interfaces:**
- Produces: `practiceHref(course, lesson, level): { href: string; count: number; scope: "item" | "group" }`.
  - The default is `/banks/<bank>?topic=<parent topic>&item=<item>` when the item has 3 or more questions at that level.
  - Otherwise it is `/banks/<bank>?topic=<parent topic>&subtopic=<group studentFacingName>`.

- [ ] **Step 1: Write failing tests:**
  - `practice href for every lesson resolves to ≥1 question in that level's bank, or falls back to its group`
  - `?item=5.16` round-trips through parse/serialize
  - A card links to the lesson for its first `officialItems` entry
  - No notes links appear while the course is unpublished
- [ ] **Step 2–4:** Implement and run. This is a high-traffic component, so the full `npm test` must stay green.
- [ ] **Step 5:** Commit.

### Task 15: Platform PR

- [ ] **Step 1:** Run `npm run lint && npm run typecheck && npm test && npm run build`. All must pass.
- [ ] **Step 2:** Check in the browser with `NOTES_PREVIEW=1 npx next dev`, at desktop, tablet and phone sizes in light and dark, with zero horizontal overflow. Use real clicks on the steps, quizzes, glossary and level switch.
- [ ] **Step 3:** Open a PR "Course notes platform (unpublished)" and bind it with ccd_pr. Merge only on the owner's "merge". The course stays `published: false`, so production shows nothing new except the item filter.

## Phase C: Content (after Tasks 2, 3 and 5)

### Task 16: Writer brief, style guide and source packs

**Files:**
- Create: `docs/course-notes/aa-style-guide.md`, `docs/course-notes/aa-writer-brief.md`, `docs/course-notes/aa-verifier-brief.md`, `scripts/notes/build-source-pack.mjs` (writes to `../research/aa-course-notes/packs/<item>.json`), `scripts/notes/originality.mjs`

**What goes in each:**
- **Style guide:**
  - the voice: a 16-year-old learning from scratch, intuition first, short sentences
  - IB notation, block usage, and how many examples per section (at least 2, with at least 1 calculator example where P2 applies)
  - a glossary policy: underline the first use per section, and add a term to `glossary.json` with its teaching lesson
  - the allowed interactive ids
  - calculator wording for the TI-84 Plus CE, TI-Nspire CX and Casio fx-CG50
- **Source pack** for each item:
  - the `items.json` entry
  - the booklet entries
  - the prerequisite candidates
  - the tagged bank questions, as text plus mark scheme, labelled "do not copy"
  - the explanation `mistake` fields for those questions
- **Writer brief:** produce `lessons/<item>.json` and `scripts/notes/sidecars/<item>.py` (a SymPy assertion for every example and check), then run the validator and `check-math.py`, and fix until both pass.
- **Verifier brief:** a blind read against the pack. Check correctness, bullet coverage, the level boundary, notation, and whether a student can learn from it. Return `pass | minor | critical` with findings.

- [ ] **Step 1:** Write the docs and the pack builder. Test: the builder emits 83 packs, each with the item's bullets.
- [ ] **Step 2:** Commit.

### Tasks 17–21: Topic batches 1–5

Run one batch at a time, in this order: 5 Calculus, 2 Functions, 1 Number and algebra, 3 Geometry and trigonometry, 4 Statistics and probability. Each batch goes through the Workflow tool:
1. **Write:** one Opus writer per lesson.
2. **Machine checks:** validator, SymPy and `scripts/notes/originality.mjs`, with up to 2 retry rounds by the writer. The originality script flags any 8-word run shared with the source pack's guide, booklet or question text. It lives with the Task 16 scripts.
3. **Verify:** one Opus verifier at medium effort per lesson.
4. **Fix:** a fixer for `minor`/`critical` findings, then a re-verify for `critical`.
5. **Ledger:** append to `../research/aa-course-notes/ledger.json` (item → status, journals).

For each batch:
- [ ] **Step 1:** Launch the batch workflow. Check the ledger: every lesson in the topic is `pass`.
- [ ] **Step 2:** Run `node scripts/notes/write-receipts.mjs && npx vitest run src/lib/course-notes`. Expected: PASS.
- [ ] **Step 3:** Preview the topic with `NOTES_PREVIEW=1` and spot-read 2 lessons in the browser.
- [ ] **Step 4:** Commit `content(notes): AA topic N lessons`, then open a PR (it stays unpublished) and merge on the owner's say-so.

### Task 22: Glossary, cheat-sheet extras and command terms

- [ ] **Step 1:** Consolidate the glossary. Merge near-duplicates, and point each term at the lesson that first teaches it. Verify with an Opus pass.
- [ ] **Step 2:** Write the 5 topic "which method when" sheets and `command-terms.json`. Verify with the Task 17 verifier brief.
- [ ] **Step 3:** Test: every glossary id used by lessons exists, every term's `lesson` exists, and every topic sheet fits in 2 A4 pages in print preview (checked by hand in the browser).
- [ ] **Step 4:** Commit and open a PR.

## Phase D: Review and launch

### Task 23: Hand over for the teacher review

- [ ] **Step 1:** Give the owner a preview build. The options are a local `NOTES_PREVIEW=1` build, or a Vercel preview with `NOTES_PREVIEW=1`, which needs owner approval for the env change.
- [ ] **Step 2:** Give them a review checklist per topic (`docs/course-notes/teacher-review.md`).
- [ ] **Step 3:** Run teacher fixes back through Tasks 17–21, steps 1–2 (write fix, then checks, then verify).

### Task 24: Launch, on the owner's word only

- [ ] **Step 1:** Set `published: true`. The test now requires 83 lessons, all with receipts.
- [ ] **Step 2:** Run the full gate, open a PR, and merge on "merge".
- [ ] **Step 3:** Check live: the sitemap contains all course paths, there's a Notes link in the navigation, and a bank card "Learn this topic" link opens the right lesson. The PostHog `notes_lesson_view` event arrives.
