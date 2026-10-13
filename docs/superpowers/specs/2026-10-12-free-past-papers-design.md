# Free past papers: design and search pages

Date: 2026-10-12 · Status: approved in conversation (owner asked to write the spec, self-review the plan, and build on PR #216)

## Goal

Turn the whole-paper workspace from PR #216 into a free tool that students understand at a glance and that search engines can index:

- a past-paper library that is quick to scan;
- a calm paper page that puts the paper first;
- self-marking that ends in one clear next step, topic practice;
- a set of indexable pages, one for each kind of search students make.

The back end from PR #216 stays as it is: manifests, document delivery, the production gate and the rights statuses. This work changes routes, UI, metadata and tests.

## Decisions (from the owner)

- **Hub:** the homepage-style pastel subject cards, a search box that takes a subject or a paper code, and an IGCSE / IB toggle.
- **Subject page:** "bank F", the calm matrix (mockup in `private/paper-preview/design-mockups/bank-f.html?joined`, not committed). Details:
  - centred header with a subject icon tile, H1 and one line of copy;
  - **the search box and the All / Core / Extended toggle sit side by side under the header, outside the matrix**;
  - one card holding the matrix: a row per session and a column per paper number;
  - **each cell is one joined pill**, with the variants split by thin dividers (no separate tiles);
  - the year label stays pinned while its rows scroll;
  - column headers link to that paper's page;
  - a "New" tag on the latest session;
  - a green tick on papers the student has marked on this device, plus "N of M marked".
- **Paper page:** "paper A", reader plus rail (the rail ends with one quiet link, "Practise Paper N questions by topic", for students who never mark):
  - the H1 is the session and paper (e.g. "May/June 2026 Paper 21"), with fact pills underneath;
  - a slim sticky toolbar: question paper / mark scheme, timer, page, download, focus;
  - the PDF comes first;
  - the rail holds "Mark this paper", other variants, the same session's other papers, and the same paper in the previous and next sessions;
  - on phones the toolbar becomes a floating bottom dock (from "paper B").
- **Marking:** the mark scheme is on the left. Per-question −/+ steppers and a live total replace the rail on desktop, or open in a bottom sheet on phones. The report then shows the topics to review and **one** button to practise the top topic.
- **Copy** stays short. Fonts and colours are the site's existing ones: Young Serif headings, Geist body text, pastel subject tones. No brown or burgundy accents on these pages.

## URLs and search pages

The current routes (`/past-papers/[bankSlug]/[paperId]`) were never public, so they are replaced outright and need no redirects.

| Page | Path | Example search | Contents |
|---|---|---|---|
| Hub | `/past-papers` | igcse past papers, ib past papers with mark schemes | Subject cards, search, three-point "why" row |
| Qualification | `/past-papers/igcse`, `/past-papers/ib` | cambridge igcse past papers, ib past papers | The hub filtered to one qualification |
| Subject | `/past-papers/igcse-maths-0580` | 0580 past papers, igcse maths past papers | Matrix (all years), year links, paper links, FAQ |
| Year | `/past-papers/igcse-maths-0580/2024` | 0580 past papers 2024, 0580 may june 2024 | That year's matrix, previous and next year links |
| Paper number | `/past-papers/igcse-maths-0580/paper-4` | 0580 paper 4 past papers, ib math aa hl paper 1 | One column across all years, listed by session |
| Paper | `/past-papers/igcse-maths-0580/2024-may-june-42` | 0580/42/m/j/24, 0580_s24_qp_42 | Reader, rail, question list, file-name aliases |

**Subject slugs** are written out in full in one table:

| Bank slug | Subject slug |
|---|---|
| `igcse` | `igcse-maths-0580` |
| `igcse-additional` | `igcse-additional-maths-0606` |
| `ib-hl` | `ib-math-aa-hl` |
| `ib-sl` | `ib-math-aa-sl` |
| `ib-ai-hl` | `ib-math-ai-hl` |
| `ib-ai-sl` | `ib-math-ai-sl` |
| everything else | unchanged (e.g. `igcse-biology-0610`, `ib-chemistry-hl`) |

**Paper slugs**:
- IGCSE: `{year}-{feb-march|may-june|oct-nov}-{component}`.
- IB: `{year}-{may|november}-paper-{n}[-tzN][-{option}]`.
  - `tz0`, `tzn` and `none` add no timezone suffix.
  - AA HL Paper 3 options keep their option name, e.g. `2017-may-paper-3-calculus`.
- A unit test proves the slugs are unique within every bank.

**Second URL segment.** One dynamic segment decides the page type:
- `^\d{4}$` is a year page;
- `^paper-[0-9a-z]+$` is a paper-number page;
- anything else is looked up as a paper slug.

All three page types live in one `[slug]/[entry]` route, so the route count stays at today's level (Vercel Hobby allows 12 functions).

**The PDF route** moves to `/past-papers/[slug]/[entry]/document?kind=…`. It behaves exactly as before (no-store, noindex).

## Rendering and gating

- Every page is statically generated: `generateStaticParams` with `dynamicParams = false`, as the `/banks` landing pages already do.
- The params are empty unless `wholePaperArchiveEnabled()` returns true. While the archive is off, every route returns 404 and nothing is added to the sitemap.
- The production gate (R2 readback receipt and environment variables) is unchanged. Turning it on still needs the owner's approval.
- Manifests are parsed and validated once per process (memoised), not once per page. This keeps a build of about 2,700 pages fast.
- In local dev with `LOCAL_PAPER_PREVIEW=true` the pages render as today.
- Header and footer links to `/past-papers` appear only when an environment-only check says the archive is enabled. The layout must not import the archive module, because its file tracing would pull data into every function.

## Metadata, structured data and AEO

- **Titles** use the layout template, which appends "| PastPaperPrep". The current pages add the suffix themselves and end up with it twice; that's fixed here. Examples:
  - Hub: "Free IGCSE & IB Past Papers with Mark Schemes"
  - Subject: "IGCSE Maths 0580 Past Papers & Mark Schemes (2016–2026)"
  - Year: "IGCSE Maths 0580 Past Papers 2024: All Sessions & Mark Schemes"
  - Paper number: "IGCSE Maths 0580 Paper 4 Past Papers (Extended), All Years"
  - Paper: "0580/42 May/June 2024: IGCSE Maths Paper 4 & Mark Scheme"
  - IB paper: "IB Math AA HL May 2024 Paper 1 TZ1: Paper & Markscheme"
- **Descriptions** are one sentence, built from real counts and year ranges.
- **Canonical URLs:** every page has a self canonical. Query strings (search text) are never indexed.
- **Answer first:** each list page opens with one plain sentence answering the query. Example: "216 Cambridge IGCSE Mathematics (0580) past papers from 2016 to 2026, each with its mark scheme. Free, no sign-up."
- **FAQ (3–4 questions):** subject pages get FAQs built only from manifest facts:
  - what the paper numbers or timezones mean;
  - which papers Core and Extended candidates take, derived from each paper's `route`;
  - whether the papers are free;
  - how to mark a paper.

  The visible FAQ and the `FAQPage` JSON-LD say the same thing.
- **JSON-LD** uses the existing `JsonLd` component:
  - `BreadcrumbList` on every page;
  - `CollectionPage` + `ItemList` on hub, qualification, subject, year and paper-number pages;
  - `LearningResource` on paper pages, with `name`, `educationalLevel`, `learningResourceType: "Past exam paper"`, `timeRequired` (ISO 8601, only when the duration is verified), `isAccessibleForFree: true` and `inLanguage: "en"`.
  - It never claims an author.
- **Paper pages also show:**
  - the question list (number, topics, marks) rendered on the server, when topics exist;
  - the Cambridge file names as visible text (`0580_s24_qp_42 · 0580_s24_ms_42`) on IGCSE pages;
  - links to sibling variants, the same session's papers, the same paper in the previous and next sessions, the year page and the paper-number page.
- **Sitemap:** every page above is added to `/sitemap.xml` when the archive is enabled (about 2,700 URLs, well under the 50,000 limit).
- **Cross-links:** the `/banks/[slug]/papers/[paperSlug]` question pages (topic practice) and the new paper-number pages (full papers) link to each other. Their titles stay distinct (questions vs full papers), so they don't compete.

## Components

| Unit | Kind | Purpose |
|---|---|---|
| `src/lib/past-paper-catalog.ts` | pure, client-safe | Subject slugs, paper slugs, chip labels, session order, matrix grouping, query parsing, file-name aliases, copy and FAQ builders |
| `src/lib/whole-paper-archive.ts` | server | Existing module plus memoised manifests and lookups by public slug |
| `PastPaperHub` | server + small client search | Hub and qualification pages |
| `PaperFinder` | client | Search box: subject or paper code (e.g. `0580/42/M/J/24`, `0580_s24_qp_42`, `may 2024 paper 1 tz1`). Suggestions open the paper |
| `PaperMatrix` | client (SSR'd) | Matrix, tier toggle (papers with route `Shared` stay visible under both tiers; banks with no tiers hide the toggle; IB uses no toggle because HL and SL are separate banks), ticks for marked papers, column links, pinned year labels; stacked cards on phones |
| `PastPaperListPage` | server | Shared shell for subject, year and paper-number pages: header, finder, matrix, links, FAQ, JSON-LD |
| `PaperWorkspace` | client | Holds reader and marking state: reader (restyled `PastPaperReader`), rail, marking panel |
| `PaperMarkingWorkspace` | client | Keeps its storage, validation and report logic. New UI: steppers, live total, report with one CTA |
| `PaperAttemptTimer` | client | Same logic, compact pill UI with custom duration in a small popover |

Removed: `WholePaperBrowser` and `WholePaperHub`, with their CSS and tests. These are replaced.

## Marked state

- Marks already save under `pastpaperprep:marks:{bankSlug}:{paperId}:{version}`.
- A paper counts as marked when its latest saved entry has at least one mark.
- The matrix reads these keys after hydration, so the first render is deterministic and nothing changes on the server.

## Report wording

- The existing heuristic is unchanged, and marks are still never allocated to topics.
- Each topic shows "Lost marks in N of M questions", with a small bar for N/M and the question numbers.
- One primary button: "Practise {top topic}", linking to the bank's free preview filtered to that topic. Links are relative; today they hard-code `https://pastpaperprep.com`.
- Papers without a report show one line: "Self-marking isn't available for this paper yet." Internal reasons are not shown to students.

## Analytics

These are browser events through `trackProductEvent`, documented in `docs/analytics-events.md`:

| Event | Properties |
|---|---|
| `past_paper_search` | `found` |
| `past_paper_open` | `bank`, `paper` |
| `past_paper_timer_start` | `bank` |
| `past_paper_mark_open` | `bank` |
| `past_paper_report_view` | `bank`, `complete` |
| `past_paper_practice_click` | `bank` |

## Testing

- **Unit tests:** slugs (unique, round-trip), query parsing, matrix grouping, chip labels, file names, metadata and FAQ builders, and JSON-LD shape.
- **Route tests:** 404 when disabled; correct page type for each segment; titles without a doubled suffix.
- **Component tests:**
  - matrix links and tick state;
  - finder suggestions;
  - marking steppers, clamping and the report CTA;
  - the timer still works.
- **Private-fixture tests:** tests that need private PDFs skip themselves when those files are missing, which is the current CI failure.
- **Browser QA** (local preview): hub, subject, year, paper-number and paper pages at desktop and 375 px, light and dark; the marking flow; the timer.
- **Release gates:** lint, typecheck, test, build.

## Out of scope

- Turning on production, uploading to R2 and changing environment variables (owner approval).
- The four other free tools (topic frequency, code decoder, mark-scheme decoder, grade calculator).
- Examiner reports and grade thresholds on paper pages.
