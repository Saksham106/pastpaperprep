# IB Maths AA course notes: design

Date: 2026-11-01. Status: design, awaiting owner approval. Nothing is built yet.

## 1. Intent

A student who is stuck on a topic in class should be able to open PastPaperPrep, find exactly where they are in the IB Maths AA course, learn it properly, check they understood it, and then practise real past-paper questions on it. A student who wants the whole course can walk through it from start to finish.

The notes are a full course: every syllabus item for SL and HL, launched together. The owner rejected a one-topic pilot.

What makes this different from other notes sites is the link to the question bank. Each lesson ends in real past-paper questions on exactly that syllabus item, with mark schemes and worked explanations. Other sites can't easily do that.

**Why IB Maths AA first** (data from 2026-11-01, last 60 days): it has the most bank sessions (1,000 across HL and SL), the most free users revealing answers (155 sessions), the most paid subscriptions covering it (8), and 350 past-paper sessions. One course serves two banks, because HL is SL plus the additional higher level (AHL) items.

## 2. Goals, non-goals, anti-goals

**Goals**
- Cover all 83 items of the official AA guide (first assessment 2021): 51 SL items that are also HL, and 32 AHL items that are HL only. Each item is taught in full.
- Be accurate. Every formula, worked example and answer is checked before release.
- Teach, don't just summarise. Each lesson builds intuition, shows worked examples, and lets students check themselves.
- Make it easy to find your place: syllabus number, topic, name, or "what are we doing in class".
- Connect learning to practice: lesson → check yourself → real past-paper questions → worked explanations.
- Provide a cheat sheet for each topic and one for the whole course, each in SL and HL versions.
- Mark SL and AHL content clearly everywhere.
- Make the pages good to read: clean HTML, readable on a phone, dark mode, printable.

**Non-goals (for this release)**
- Videos. Each worked example and lesson keeps a slot for one, but none are made yet.
- The Internal Assessment (exploration).
- Other courses. AA comes first. The format must work for other subjects later, but none are built now.
- Account-synced progress. Progress is stored in the browser for now (see §9).
- The 2029 syllabus. The structure must allow a second edition (see §4), but none is written now.

**Anti-goals: failure even if it technically works**
- Any wrong maths on a page. One wrong formula costs a paying student marks and costs us trust.
- Notes that are summaries pretending to be lessons. If a student can't learn the topic from scratch from the page, it has failed.
- Copying the IB guide, formula booklet, past-paper questions or another site's notes into the prose.
- Hundreds of thin, templated pages published only for SEO. The October Google drop may be linked to templated pages (see `gsc-drop` notes). Every page must be substantial and reviewed.
- A cluttered page: helper banners, cards inside cards, decorative graphs. The owner's design rules apply (see the `pastpaperprep-product-design` skill).
- Calling the notes "official" or implying IB endorsement.

## 3. What already exists

- `/revision-notes/[subject]/[topic]`: IGCSE Chemistry 0620 only. These are bullet-point summaries as plain TypeScript data (`src/lib/revision-notes/`). They are not lessons. This design reuses the URL family and replaces the format (§6).
- The official AA syllabus registry: `../research/aa-official-subtopics/official-aa-taxonomy.json`. It holds 83 entries with the official item number, SL/AHL applicability, an editorial student-facing name and the classification boundary, all traced to the guide PDF (sha256 recorded).
- The student-facing groups and per-question tags: `src/data/aa-official-subtopics/taxonomy.json` has 50 groups covering all 83 items. `overlay.json` tags 934 current-era AA questions (2021 onward, SL and HL) to those groups. The bank filters already use these tags.
- Worked explanations exist for every served question (R2, gated like mark schemes). Each one has a `mistake` field per part.
- KaTeX is installed and used by `ExplanationPanel`.
- The free whole-paper library at `/past-papers` already has a "See where your marks went" report that recommends practice.
- Constraints: Vercel Hobby allows 12 serverless functions, so the notes must be fully static with no new API routes. No `loading.tsx` on public pages (AEO pass). "Updated" dates come from the changelog, never the build date.

## 4. Syllabus source and edition

**Source of truth:** the IB *Mathematics: analysis and approaches guide, first assessment 2021*, through the registry above. Lessons follow the guide's numbering (1.1 … 5.19), its topic order, its SL/AHL split, and the notation list in the guide.

**Why this edition:** the IB is replacing the course. According to secondary sources (the IB page was behind a bot check), the new guide is published in February 2027, first teaching is August 2027, first exams are May 2029, and the last exams on the current course are November 2028. Every current student, every paying customer and every question in the bank uses the current guide. So that guide is what we build.

**Edition-ready structure:** every lesson records `edition: "aa-2021"`. When the 2029 guide comes out (Feb 2027), we map its items to existing lessons. Unchanged ones get a second edition tag, changed ones get a new version, and the course home gets an edition switch ("Exams to Nov 2028" / "Exams from May 2029"). That is a follow-up project. Nothing in this release should make it harder.

**Copyright rules for content**
- The guide's structure and numbering are used as reference facts. Its text is never pasted into lessons. Learning goals are rewritten in our own words.
- Formulas are maths, not text. We typeset them ourselves and mark whether each is in the formula booklet. We never reproduce the booklet's layout or a scan of it.
- Worked examples and "check yourself" questions are original. Real past-paper questions appear only as links into the bank, never copied into notes.
- Never copy another notes site, textbook or video. Writers get the guide item and our own data, not other sites' notes.

## 5. Course shape

**Lesson = one official syllabus item.** That gives 83 lessons. Teachers talk in syllabus numbers ("we're on 5.16"), so students can find their place instantly. Small items (1.1 standard form) make short lessons. Big items (5.14 implicit differentiation, related rates, optimisation) get several sections inside one lesson.

Hierarchy: **Course** (IB Maths AA) → **5 Topics** (Number and algebra, Functions, Geometry and trigonometry, Statistics and probability, Calculus) → **Lessons** (1.1 … 5.19) → **Sections** inside each lesson.

The 50 student-facing groups are used only for practice links and for clustering on the topic map. They don't change the lesson structure.

| Topic | SL items (SL + HL) | AHL items (HL only) |
|---|---|---|
| 1 Number and algebra | 1.1–1.9 | 1.10–1.16 |
| 2 Functions | 2.1–2.11 | 2.12–2.16 |
| 3 Geometry and trigonometry | 3.1–3.8 | 3.9–3.18 |
| 4 Statistics and probability | 4.1–4.12 | 4.13–4.14 |
| 5 Calculus | 5.1–5.11 | 5.12–5.19 |

**Prerequisites:** each lesson lists the lessons it builds on, for example 5.16 (substitution and parts) needs 5.5, 5.10 and 5.15. This is real data that drives the "before you start" check, the "Builds on" links and the "stuck?" links. Schools teach in different orders, so prerequisites matter more than syllabus order.

## 6. Pages and URLs

All pages live under the existing notes family, are statically generated (`generateStaticParams`, `dynamicParams = false`) and have no route `loading.tsx`.

| URL | Page |
|---|---|
| `/revision-notes/ib-math-aa` | Course home: topic columns, search, level switch, progress |
| `/revision-notes/ib-math-aa/<topic>` | Topic page: groups flowing left to right, link to the topic cheat sheet |
| `/revision-notes/ib-math-aa/<topic>/<item>-<slug>` | Lesson, e.g. `/calculus/5-16-integration-by-substitution-and-parts` |
| `/revision-notes/ib-math-aa/<topic>/cheat-sheet` | Topic cheat sheet (SL/HL toggle) |
| `/revision-notes/ib-math-aa/cheat-sheet` | Whole-course cheat sheet (SL/HL toggle) |
| `/revision-notes/ib-math-aa/glossary` | Every glossary term, A–Z, each linking to the lesson that teaches it |
| `/revision-notes/ib-math-aa/command-terms` | IB command terms (state, show that, hence, sketch vs draw…) and what each one needs for marks |

`ib-math-aa` follows the existing `ib-math-aa-hl` / `ib-math-aa-sl` past-paper slugs. The `[subject]/[topic]` route already exists for 0620. The AA course adds a `[lesson]` level, and `cheat-sheet` is a reserved slug. 0620 keeps working unchanged and can be moved to the new format later.

Topic slugs: `number-and-algebra`, `functions`, `geometry-and-trigonometry`, `statistics-and-probability`, `calculus`.

### 6.1 Course home

Chosen 2026-11-01 (mockup `home.html`). The owner rejected the transit map, course trail and mind map as hard to scan, and then preferred topic rows to vertical topic columns. Keep it a simple list.

The first screen has, in order:
- **The level switch:** SL / HL. It is large, obvious and styled like the IGCSE / IB tabs elsewhere. It is remembered in `localStorage`, with HL as the default because AA HL has the most usage. In SL view, AHL lessons are hidden and each topic shows "+N HL-only lessons". In HL view, AHL lessons sit under an "HL only" divider in each topic.
- **Find your place:** one search box. It matches lesson names, syllabus numbers ("2.5"), and synonyms or class wording ("inverse functions", "by parts", "Bayes"). Synonyms are stored per lesson.
- **Continue:** a button to the next lesson not yet understood.
- **Overall progress:** one thin bar, "17 of 83 lessons understood".
- **Topic rows** (owner's pick 2026-11-01, over vertical columns): one full-width row per topic, stacked in syllabus order. A course with more topics just has more rows.
  - The left of each row (about 270px, in the topic tone) has the number and name, a dot strip with one dot per lesson (filled when understood; diamonds for AHL), "6 of 16 understood", and links to the topic page and topic cheat sheet.
  - The right of the row lists every lesson as a plain horizontal line: number, full name and a tick. Lessons flow down, then across, in up to three columns (like a book index). There's an "SL and HL" block, then an "HL only" block, and the next lesson is highlighted "Next up".
  - On tablets the left part narrows and the lessons use two columns. On phones each topic is a collapsible section (header on top, lessons in one column), with the current topic open.
- **Cheat sheet links:** the whole-course sheet, and one per topic.

No hero paragraph and no marketing band. This is a workspace, so the content comes first.

### 6.2 Topic page

Chosen 2026-11-01 (mockup `topic-v2.html`). It keeps the organisation by group that the owner liked in the mind map, and the left-to-right progress of the learning-order view, without the mind-map shape.

- **Header:** topic number and name, "19 lessons · 8 HL only · 156 past-paper questions in the HL bank", the level switch, the topic cheat sheet and a Continue button.
- **Two bands:** "SL and HL", then "HL only". In SL view the HL band is faded with "switch to HL to study these".
- **Groups as stages, left to right** in teaching order. A progress line runs along the top through one node per group. It fills green as groups are understood (half-filled for a partly done group), so progress reads left to right.
  - Each stage shows the group name (left out when the group is a single lesson, so the same name isn't repeated) and its real past-paper count, linked to practice.
  - Below that come its lessons as stacked cards: number, name, a tick or "Next up". Hovering a card shows its one-line summary.
- Names, counts and cards line up across stages (CSS subgrid). On phones the bands turn into a vertical timeline.
- Every visual element is real data: syllabus items, groups, question counts and progress. Prerequisites stay on the lesson page ("Builds on"), not on a graph.

### 6.3 Lesson page

Chosen 2026-11-01 (mockup `lesson-a.html`). Reading column about 68–72 characters wide. On desktop a slim sticky "On this page" contents rail on the left lists the sections, highlights the current one, and shows reading progress. Glossary terms open a pop-up definition. On mobile the rail collapses to a sticky "Contents" bar.

From top to bottom:
1. **Header.** The item number and level badge ("5.16 · AHL"), the title, reading time, and the papers it appears on (P1 no calculator / P2 calculator / P3 HL). Prerequisite chips link to earlier lessons, and "Last reviewed <date>" comes from the changelog.
2. **In a minute.** A two- or three-sentence answer-first summary.
3. **You'll be able to.** 3–6 learning goals in our own words, mapped one-to-one to the guide's content bullets for this item. The coverage check depends on this mapping (§8).
4. **Before you start.** A collapsible block with 2–3 quick questions on the prerequisites. A wrong answer points to the right earlier lesson.
5. **Sections.** For each idea in the lesson: explanation (intuition first, then the formal statement), then any of the content blocks in §7.
6. **Common mistakes.** Drawn from real data where possible: the `mistake` fields of explanations for questions tagged to this item, summarised and rewritten.
7. **Exam tips.** Command-term reminders, how marks are given (M/A/R marks, linking to the explanations' mark-code key), and what to write down.
8. **Calculator box** (where relevant). Steps for TI-84 Plus CE, TI-Nspire CX and Casio fx-CG50, collapsed by model and remembered once chosen.
9. **Key takeaways.** The lesson's mini cheat sheet. These are the same formula and fact blocks flagged for cheat sheets, so there is one source and no drift.
10. **Practise this.** "N past-paper questions on this". The link opens the bank at the right level (`/banks/ib-hl` or `/banks/ib-sl`), filtered to this lesson. It shows honestly how many questions are in free years.
   - **Item-level tags.** The overlay tags questions by group (50 groups), so two lessons in one group would otherwise share a list. During the content phase, an item-level tagging pass gives each of the 934 current-era questions its syllabus items, using the existing classification process (tagger, then blind review). This is a new additive field (`officialItems`) in the overlay. Groups, and so the live filters, don't change.
   - If an item ends up with fewer than 3 questions, the link falls back to its group with honest wording ("Covers 2.4–2.5").
   - Where even the group is thin (some have 1–7 questions), it also links older-syllabus questions whose content still applies, labelled "older syllabus".
   - **Deep link.** The bank page has no filter URL today (`QuestionExplorer` reads only `worksheet`, `mode`, `set`, `save`). Add read-only params `?level=…&item=5.16` (and `?group=<groupId>` for fallbacks). They pre-select the filter on load and then behave like a normal filter change. Cover this with tests, because it is a high-traffic component.
11. **Stuck?** Links to the prerequisite lessons, the glossary, and the next lesson. A "Report a problem" control works like `question_report`: fixed issue choices, no free text, plus the support email shown as visible text.
12. **"I've got this"** marks the lesson understood (`localStorage`), then Previous / Next lesson in syllabus order, skipping AHL lessons in SL view.

## 7. Content blocks

Lessons are structured data, not free-form pages. That lets us validate every block, build cheat sheets automatically, and swap in videos later.

| Block | What it is |
|---|---|
| `text` | Paragraphs with inline maths `$…$`, glossary terms `[[term-id|shown text]]` and lesson links `{{lesson:5.15}}` |
| `definition` | A defined term with a precise statement and a plain-English line |
| `formula` | Display maths plus a tag: **In booklet** or **Learn this**. Optional `cheatSheet: true`, plus SL/AHL applicability |
| `result` | A theorem or rule with a one-line "why it works" (a short proof where the guide expects proof, e.g. 1.15, 2.12, 5.12) |
| `example` | A worked example: question, then steps revealed one at a time ("Try it first", then "Show next step" / "Show all"), then the answer. Optional `video` slot (empty for now) |
| `check` | A "check yourself" question with a hint and a reveal answer. Multiple choice or numeric with tolerance, checked instantly in the browser |
| `figure` | A static SVG diagram with a full text description for screen readers |
| `interactive` | An interactive graph with sliders (see below), with a static fallback and text description |
| `calculator` | Calculator steps per model |
| `hlNote` | Inside an SL lesson: "HL goes further: see 2.13". Hidden in SL view |
| `examTip`, `mistake` | Short callouts |

**Glossary.** A hard term is shown with a dotted underline. Clicking or tapping opens a small popover with a one-line definition and "Learn it in 2.5 →". It is a real `button` and works with the keyboard; Escape closes it and focus returns. About 250–400 terms are expected (domain, asymptote, injective, discriminant, radian, scalar product, PDF…). Each term is underlined only on its first use per section, so pages don't turn into a sea of underlines.

**Interactive graphs** (planned set, about 15–20, chosen where moving something teaches more than a static picture):
- transformations $af(b(x-c))+d$
- the quadratic discriminant against the roots
- exponential and log graphs as reflections
- the unit circle and the sine/cosine graphs together
- radians and arc length
- the tangent as a limit of secants
- the sign of $f'$ against the shape of $f$
- Riemann sums approaching the area
- area between curves
- volume of revolution (2D slice view)
- the binomial and normal distributions with shaded probabilities
- the normal approximation to the binomial, regression line residuals
- complex numbers on the Argand diagram (multiply = rotate and scale)
- De Moivre roots of unity
- vectors and the scalar product angle
- Maclaurin partial sums against the function
- Euler's method step size

They load as client islands only when scrolled into view, and respect reduced motion.

**Maths rendering.** KaTeX renders to HTML+MathML on the server at build time. No KaTeX JavaScript ships to the browser, only its CSS and fonts. MathML gives screen readers real maths.

## 8. Accuracy and sourcing pipeline

This is the most important part of the design. The model is the explanations pipeline (writer → independent verifier → fixer → validator), adapted to teaching content.

**Step 0: acquire and extract the sources.** The registry holds item numbers, names, levels and boundaries, but not the guide's content bullets or guidance notes. The guide PDF it cites (`~/.hermes/cache/scratch/aa-guide.pdf`) is no longer on disk, and no formula booklet copy exists.
1. Re-fetch the current AA guide from the registry's ibo.org URL through ego-browser, as was done on 2026-09-22. Check its sha256 against the registry (`81941821…`). If it differs, stop and report.
2. Fetch the current AA formula booklet the same way.
3. Store both under `../research/aa-course-notes/sources/`, never in Git.
4. Extract each item's content bullets, guidance notes and notation into `items.json`, and each booklet formula with the item it serves into `booklet.json`.
5. A second agent re-extracts blind. Any diff between the two is resolved by hand, and the owner spot-checks 10 items against the PDF.
If ibo.org blocks the fetch, ask the owner to download the two PDFs. This step gates all writing, because the coverage check is only as good as the bullet list.

**Data in the repo.** The site build and CI can't see `../research/`. Commit a derived `src/data/aa-official-subtopics/items.json` containing the 83 items, their bullets (as short paraphrased checklist lines, not guide text), levels, prerequisites and booklet flags. Validators read that file. The 83-item registry is authoritative for item numbers, names and levels. The 50-group `taxonomy.json` is authoritative only for bank filters. A test fails if the two disagree on any item's level or group membership.

**Source pack per lesson** (built by script, kept in `research/`, never shipped):
- the guide item: number, content bullets, guidance notes, level, from the registry and guide PDF
- the relevant formula booklet entries, and whether each formula is in the booklet
- the IB notation list entries the lesson uses
- the bank questions tagged to this lesson's group, with their mark schemes and explanation `mistake` fields. These show what is actually examined and how marks are given. They are input only and are never copied.
- prerequisites and neighbouring lessons

**Steps**
1. **Write.** A writer agent (Opus) drafts the lesson JSON from the source pack, the content spec and the style guide. It covers every guide bullet and writes original examples.
2. **Machine checks** (scripts, run on every change, in CI):
   - schema-valid; every `$…$` parses in KaTeX
   - every glossary id and lesson link exists
   - every guide bullet for the item is mapped to at least one section or learning goal (the coverage matrix)
   - no AHL-only content in an SL lesson. SL lessons may only reference AHL ideas through `hlNote`
   - every `example` and `check` carries a machine-checkable assertion in a sidecar file (not shipped), recomputed with a computer algebra system (SymPy). Examples: the derivative, the integral value, the probability to 3 s.f., the roots.
     - SymPy runs locally through a script, because the repo and CI are Node-only.
     - The script writes a receipt with the sha256 of each lesson file it checked.
     - `npm test` fails if any lesson's current hash has no passing receipt. Changed content must be re-checked before it can merge.
   - formula tags agree with the booklet list
   - an originality check: no long runs of text shared with the guide, the booklet text or bank question text
3. **Verify.** An independent verifier agent (Opus, medium effort, blind to the writer's reasoning) reads the lesson against the source pack. It checks correctness, completeness against the guide, level boundaries, IB notation, and whether a 16-year-old could learn the topic from it. It returns pass / minor / critical with reasons.
4. **Fix.** A fixer applies the verifier's findings. Critical fixes get a second verify.
5. **Human review.** After the whole course passes, the owner has an IB AA teacher review it (§13). Their fixes go back through steps 2–4.
6. **After launch.** "Report a problem" reports and analytics feed a fix queue. Every content change updates "Last reviewed" through the changelog.

**Prerequisites** are drafted by the writer and checked by the verifier. They must form an acyclic graph, which a test enforces.

Batches go topic by topic (5 batches). Each batch is written, verified and fixed before the next starts. The whole course launches only when all 83 lessons, 5 topic cheat sheets and the course cheat sheet have passed.

**Models and budget**
- Writing and verifying run on Opus. Verify uses medium effort, as for explanations.
- This is a deliberate exception to "delegated work on Sonnet": there are only 83 lessons, and the pedagogy is the product.
- Source packs, extraction, formatting, glossary consolidation and receipts run on Sonnet at medium.
- Run one topic batch at a time, through the Workflow tool, with at most about 10 agents in flight.
- Rough size: 83 writer runs, 83 verify runs, about 30% needing a fix and re-verify, plus glossary, cheat sheet and command-term passes. That is roughly 250–300 agent runs in total.

## 9. Cheat sheets

- **Per topic (5) and whole course (1),** each with an SL / HL toggle. The SL version leaves out AHL content. The HL version includes it with AHL badges.
- **Generated from lesson blocks** flagged `cheatSheet: true` (formulas, key facts, method recipes), grouped by lesson in syllabus order. A small amount of sheet-only content, such as "which method when" decision guides, is written per topic and goes through the same verification.
- Each formula shows **In booklet** or **Learn this**. This tells students what they actually need to memorise, which is what they most want from a cheat sheet.
- **Print-first layout:** A4, dense two-column, two pages per topic at most. Students print it with a **Save as PDF** button that opens the browser's print dialog using a print stylesheet. There is no server-side PDF generation, which keeps it static and free on Hobby.
- On screen, each formula links back to its lesson.

## 10. Progress and personal features

- **Progress:** "I've got this" per lesson, stored in `localStorage`, shown on the course home, topic page and lesson. No account needed.
- **Account sync** of progress needs a Supabase table and a production migration. That is a follow-up, and needs owner approval.
- **Study path for a test (follow-up, not this release):** the student picks lessons ("my test is on 5.1–5.11"). The site shows them in order with prerequisites, then one practice link per lesson. For paid users it also offers "Save PDF" of a mixed practice set through the existing worksheets builder. This uses existing pieces only.

## 11. Links into and out of the rest of the site

- **Lesson → bank:** the practice links (§6.3 step 10).
- **Bank → lesson:** each question card on `/banks/ib-hl` and `/banks/ib-sl` gets a small "Learn this topic" link to the lesson for its first `officialItems` entry, or to the group's first lesson if it has no item tag. It also appears on topic landing pages (`/banks/<bank>/topics/<slug>`) and in the bank's topic filter.
- **Paper report → lessons:** the past-paper "See where your marks went" report for AA papers recommends lessons next to practice.
- **Explanations → lessons:** a "Revise <topic>" link under an explanation's mistake note.
- **Navigation:** "Notes" in the IB maths section of the header and footer, and on `/ib`. The syllabus page `/syllabus/ib-hl` and `/syllabus/ib-sl` links each syllabus item to its lesson.

## 12. Access, SEO and analytics

- **Access (decided: free):** all notes, cheat sheets, glossary and interactives are free and public, without sign-in. They are the top of the funnel. The bank's existing free-year rules and the 20-question gate turn practice clicks into sign-ups and purchases. If the owner wants some notes paid, the content can't sit in static public pages, and the build changes (§13).
- **SEO:** each lesson has its own title, a description from its summary, a canonical URL, and `LearningResource` / `Course` structured data (Course on the home page). Breadcrumbs follow Course → Topic → Lesson. Pages go in the sitemap only at launch, all together, once verified. Use honest "Updated" dates from the changelog and no fake freshness.
- **Copy:** use "Follows the IB Maths AA guide (first assessment 2021)", never "official notes". Include the existing "not affiliated with the IB" notice. Keep copy short: no helper paragraphs and no repeated labels.
- **Analytics** (new events, documented in `docs/analytics-events.md`; all carry `lesson` = syllabus number and `level` = sl/hl):
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

  Also add `notes` to `auth_page_view.from`, so sign-ups from notes can be counted.
- **Success measures** (first 60 days after launch): lesson views; share of lesson views that click "Practise this" (target to set after the first two weeks); practice clicks → answer reveals; sign-ups and purchases from notes; reports per 1,000 views; return visits by consented users.

## 13. Owner decisions

1. **Free or paid notes.** Decided 2026-11-01: all notes are free (§12).
2. **Teacher review.** Decided 2026-11-01: once the whole course has passed the pipeline, the owner has it reviewed by an IB AA teacher. The owner arranges this. Fixes from the review go through the same checks, and launch follows the review.
3. **Design options.** Decided 2026-11-01 after two rounds: course home `home.html`, topic page `topic-v2.html`, lesson `lesson-a.html`, cheat sheet `cheatsheet.html` (all in `docs/superpowers/mockups/aa-notes/`). Round-1 options stay there for reference.

## 14. Calls made in this design (owner can override)

- The current guide (first assessment 2021) is the source, with an edition-ready structure for 2029.
- One lesson per official item (83 lessons), in the guide's numbering and order.
- URLs live under `/revision-notes/ib-math-aa/…`.
- HL is the default level view.
- Structured JSON content blocks, not MDX, so content can be validated and cheat sheets built from it.
- Opus writes and verifies; Sonnet does mechanical work; SymPy checks every example.
- Cheat sheets use print CSS plus the browser's Save as PDF, not a PDF generator.
- Progress lives in `localStorage` for now.
- Item-level question tags as an additive overlay field, with fallback to groups.
- Bank deep-link params `level` / `item` / `group`.
- The guide and booklet are re-fetched and double-extracted before any writing.
- The SymPy check runs locally with a hash receipt enforced in `npm test`.
- Opus writes and verifies lessons, as an exception to the Sonnet-for-delegated-work rule.
- The study path is a follow-up, not this release.
- Calculator instructions for three models: TI-84 Plus CE, TI-Nspire CX, Casio fx-CG50.

## 15. Left to the builder

- The content JSON file layout (e.g. `src/content/notes/ib-math-aa/<topic>/<item>.json`) and TypeScript types.
- The interactive graph library. Prefer a small React 2D maths plotting library or hand-written SVG. Check bundle size, and keep it a client island.
- The search implementation, a static index searched in the browser.
- The exact glossary popover and contents-rail components, following the design rules.
- Test structure, as long as the machine checks in §8 run in `npm test` / CI.

## 16. Build order

Step 1 is done (§13.3). Steps 2 and 3 run in parallel.

1. **Design options** (§13.3): done 2026-11-01.
2. **Platform:**
   - routes, the block renderer and server-side KaTeX
   - the glossary, interactive island loader and cheat sheet generator
   - the validator, coverage matrix and SymPy sidecar checker
   - analytics
   - built against a few test lessons that are not published
3. **Content:**
   - guide and booklet acquisition and double extraction (§8 step 0)
   - item-level question tagging
   - source packs for all 83 items
   - then 5 topic batches (write → checks → verify → fix)
   - then the cheat sheets, glossary and command terms
4. **Links:**
   - bank cards, topic pages, the syllabus page, the paper report, explanations and navigation
5. **Launch:**
   - owner review
   - all pages to the sitemap together
   - live checks on desktop, tablet and mobile in light and dark mode
   - an analytics readback
6. **Follow-ups:**
   - account-synced progress
   - the study path
   - videos per worked example
   - the 2029 edition
   - the next course

Each step that touches production (merge, migration, storage, env vars) needs the owner's explicit approval, as usual.
