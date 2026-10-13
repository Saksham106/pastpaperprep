# Free Past Papers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild PR #216's whole-paper workspace into an indexable free past-paper library: hub, qualification, subject, year, paper-number and paper pages. It gets a calm matrix, a paper-first reader and one-CTA self-marking.

**Architecture:**
- A pure, client-safe module (`past-paper-catalog.ts`) owns the public slugs, labels, query parsing and matrix grouping.
- A second pure module (`past-paper-seo.ts`) owns titles, answer sentences, FAQs and JSON-LD.
- Server pages are statically generated from the memoised, validated manifests, using a server-only resolver (`past-paper-pages.ts`). They are gated by the existing `wholePaperArchiveEnabled()`.
- Client components (`PaperMatrix`, `PaperFinder`, `PaperWorkspace`, `PaperMarkingWorkspace`) handle interaction. The data back end doesn't change.

**Tech Stack:** Next.js 16 App Router (React 19), TypeScript, CSS Modules, Vitest + Testing Library, `@phosphor-icons/react`, PostHog via `trackProductEvent`.

**Spec:** `docs/superpowers/specs/2026-10-12-free-past-papers-design.md`

## Global Constraints

- Work in `.worktrees/free-paper-preview` on branch `feat/free-paper-preview` (PR #216). Never touch other worktrees or stashes.
- No changes to the production gate, R2 delivery, manifests, environment variables or Stripe. Turning the archive on in production needs the owner's approval.
- Every dynamic `/past-papers` page: `dynamicParams = false` with `generateStaticParams`, and empty params when `wholePaperArchiveEnabled()` is false.
- Route count must not grow: `page.tsx` at `/past-papers`, `/past-papers/[slug]`, `/past-papers/[slug]/[entry]`, plus one `document/route.ts`. The `preview` routes stay.
- The layout and the header/footer must not import `@/lib/whole-paper-archive`.
- Titles rely on the layout template `"%s | PastPaperPrep"`, so pages never add the suffix themselves.
- Copy is short; one primary CTA per state; Young Serif headings (`var(--font-serif)`), Geist body text, pastel tones through `data-subject-tone`. No burgundy (`--burgundy`, `--public-action`) on these pages.
- Links are relative (no `https://pastpaperprep.com` in hrefs). Absolute URLs appear only in canonical/JSON-LD.
- Before the PR update: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must all pass.

## Review Focus

1. **Paper codes typed different ways:** `0580/42/M/J/24`, `0580_s24_qp_42`, `s24 42`, `may june 2024 42`, `may 2017 paper 1 tz2` must all find the right paper. Junk must show nothing rather than a wrong paper. *Test: Task 2 query cases.*
2. **Odd IB papers:** AA HL 2017–18 Paper 3 options (four `tz0` papers in one cell), Biology/Chemistry/Physics `1a`/`1b`, `tzn`/`none` variants. Each needs a distinct, readable chip and a unique slug. *Test: Task 2 slug uniqueness across all 19 real manifests, plus chip labels.*
3. **Corrupt or old localStorage marks:** must never crash the matrix or show ticks for papers with only null marks. *Test: Task 6 tick test with corrupt JSON and all-null entries.*
4. **Held papers (no report):** show one plain line, never the internal `reportReason`, and no Mark entry points. *Test: Task 5 route test + Task 8 workspace test.*
5. **Archive disabled at build:** every page returns 404, the sitemap has no `/past-papers` URLs, and the nav shows no link. *Test: Task 5 route test + Task 10 sitemap and nav tests.*

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/past-paper-catalog.ts` (new) | Slugs, labels, session order, matrix data, query parsing/matching, file-name aliases. Pure. |
| `src/lib/past-paper-seo.ts` (new) | Display names, titles, descriptions, answer sentence, FAQ, JSON-LD objects. Pure. |
| `src/lib/past-paper-pages.ts` (new, server-only) | Gate + resolve slugs/entries for pages, params and the sitemap. |
| `src/lib/past-paper-nav.ts` (new) | `pastPaperLinksEnabled()`: environment-only check for nav links. |
| `src/lib/whole-paper-archive.ts` (modify) | Memoise manifests; `findWholePaperBySlug`; document URLs use public slugs. |
| `src/app/past-papers/page.tsx` (rewrite) | Hub. |
| `src/app/past-papers/[slug]/page.tsx` (new) | Qualification hub or subject page. |
| `src/app/past-papers/[slug]/[entry]/page.tsx` (new) | Year, paper-number or paper page. |
| `src/app/past-papers/[slug]/[entry]/document/route.ts` (moved) | PDF bytes by public slugs. |
| `src/components/past-papers/*` (new) | `PastPaperHub`, `PastPaperListPage`, `PaperLibraryTools`, `PaperMatrix`, `PaperFinder`, `PastPaperPaperPage`, `PaperWorkspace` (+ CSS modules + tests). |
| `src/components/PastPaperReader.tsx`, `PaperAttemptTimer.tsx`, `PaperMarkingWorkspace.tsx` (+ css, tests) | Restyled; logic kept. |
| `src/lib/paper-marking-report.ts` | Relative practice link. |
| `src/app/sitemap.ts`, `SiteFooter.tsx`, `HeaderNavigation.tsx`, `src/app/banks/[slug]/papers/[paperSlug]/page.tsx` | Sitemap, links, cross-links. |
| Deleted | `WholePaperBrowser.*`, `WholePaperHub.*`, `src/app/past-papers/[bankSlug]/**`. |

---

### Task 1: Make private-fixture tests skip on CI

**Files:** Modify the five suites that failed in CI run 38204157181: `scripts/build-chemistry-paper-archive.integration.test.ts`, `scripts/build-chemistry-paper-archive.test.ts`, `src/lib/chemistry-paper-archive.test.ts`, `src/lib/paper-marking-preview.test.ts`, `src/app/past-papers/preview/document/route.test.ts`.

- [ ] **Step 1:** In each file, find the private path the failing `describe` reads. Wrap that `describe` with:

```ts
import { existsSync } from 'node:fs';
const hasPrivateSources = existsSync(join(process.cwd(), '<exact private path the suite reads>'));
describe.skipIf(!hasPrivateSources)('<unchanged name>', () => { /* unchanged */ });
```

Only the failing suites get this. Fail-closed suites that don't need private files stay as they are.
- [ ] **Step 2:** Run the five files with `npx vitest run <files>`. Expected: PASS (the private files exist locally).
- [ ] **Step 3:** Simulate CI: `mv private private.off`, run again, expect "skipped" and no failures, then `mv private.off private`.
- [ ] **Step 4:** Commit: `test(papers): skip private-source suites when the sources are absent`.

### Task 2: Public catalog module (slugs, labels, matrix, query)

**Files:** Create `src/lib/past-paper-catalog.ts`, `src/lib/past-paper-catalog.test.ts`.

**Interfaces — Produces:**

```ts
export type PastPaperQualification = 'igcse' | 'ib';
export const SUBJECT_SLUGS: Record<BankSlug, string>;
export function subjectSlugForBank(bank: BankSlug): string;
export function bankForSubjectSlug(slug: string): BankSlug | null;
export function qualificationOfBank(bank: BankSlug): PastPaperQualification;
export function sessionRank(session: string): number;      // Feb/Mar 1, May(/June) 2, Oct/Nov|Nov 3
export function shortSession(session: string): string;      // 'Feb/March' | 'May/June' | 'Oct/Nov' | 'May' | 'November'
export function paperSlug(p: WholePaperSummary): string;
export function chipLabel(p: WholePaperSummary): string;    // '42' | 'TZ1' | 'Calculus' | 'P1'
export function paperName(p: WholePaperSummary): string;    // 'Paper 42' | 'Paper 1 TZ1' | 'Paper 3 Calculus'
export function paperNumberSlug(paper: string): string;     // '4' -> 'paper-4'
export function paperHref(p: WholePaperSummary): string;
export function fileAliases(p: WholePaperSummary): { question: string; markscheme: string } | null;
export type MatrixLink = { href: string; label: string; title: string; markPrefix: string; route: 'Core' | 'Extended' | 'Shared' | null };
export type MatrixColumn = { paper: string; label: string; note: string; href: string };
export type MatrixRow = { key: string; session: string; label: string; latest: boolean; cells: MatrixLink[][] };
export type MatrixYear = { year: number; rows: MatrixRow[] };
export type PaperMatrixData = { columns: MatrixColumn[]; years: MatrixYear[]; total: number; tiers: boolean };
export function buildPaperMatrix(papers: readonly WholePaperSummary[], subjectSlug: string): PaperMatrixData;
export type PaperQuery = { code?: string; year?: number; session?: 'feb-march' | 'may-june' | 'oct-nov'; component?: string; paper?: string; tz?: string };
export function parsePaperQuery(input: string): PaperQuery;
export function matchPapers<T extends WholePaperSummary>(papers: readonly T[], query: PaperQuery, limit?: number): T[];
```

- [ ] **Step 1: Failing tests.** These cover:
  - every bank gets a unique, reversible subject slug (`igcse` → `igcse-maths-0580`, `ib-hl` → `ib-math-aa-hl`, and `bankForSubjectSlug('igcse')` is null);
  - every real paper in all 19 manifests has a unique slug matching `/^\d{4}-[a-z0-9-]+$/`;
  - exact slug, chip, name and file names for `0580-2024-june-42` (`2024-may-june-42`, `42`, `Paper 42`, `0580_s24_qp_42`/`0580_s24_ms_42`), `ib-sl 2017-may-p1-tz1` (`2017-may-paper-1-tz1`, `TZ1`, no file names) and `ib-hl 2017-may-tz0-p3-calculus` (`2017-may-paper-3-calculus`, `Calculus`, `Paper 3 Calculus`);
  - the Biology `1a` slug ends `-paper-1a(-tzN)?`;
  - the 0580 matrix: columns Paper 1–4, Paper 4 note "Extended" with href `/past-papers/igcse-maths-0580/paper-4`, the first year 2026 with the May/June row marked latest, 2025 rows `Oct/Nov, May/June, Feb/March`, the May/June 2026 Paper 2 cell `21,22,23` with the right href, markPrefix and route, the Paper 1 cell empty, total 216, tiers true;
  - IB SL: no tiers, timezone chips sorted;
  - Biology HL columns ordered `1,1a,1b,2,3`;
  - query cases `0580/42/M/J/24`, `0580_s24_qp_42`, `0580_w23_ms_41`, `s24 42` and `may june 2024 42` each resolve first to their slug;
  - `oct nov 2025 paper 4` lists `41,42,43`;
  - `feb march 2025 paper 2` resolves first to `2025-feb-march-22`;
  - `''`, `banana` and `1999 paper 9` return `[]`;
  - IB `may 2017 paper 1 tz2` resolves first to `2017-may-paper-1-tz2`, and `nov 2019 p2` returns only November 2019 papers.

  Tests read real manifests from `src/data/paper-archives/*.json`, which are committed.
- [ ] **Step 2:** Run `npx vitest run src/lib/past-paper-catalog.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
  - `SUBJECT_SLUGS` comes from the spec table.
  - Session slugs: `February/March → feb-march`, `May/June → may-june`, `October/November → oct-nov`, `May → may`, `November → november`.
  - `paperSlug`: IGCSE → `${year}-${sessionSlug}-${component}`; IB → `[year, sessionSlug, 'paper', paper, tz?, option?].join('-')`. `tz` is set only when the variant matches `/^tz[1-9]$/`. The option is captured from the id by `/-p\d[a-z]?-([a-z][a-z-]*)$/`, excluding `english` and `tzN`.
  - Option labels: calculus → Calculus, discrete-mathematics → Discrete, sets-relations-and-groups → Sets, statistics-and-probability → Statistics. Fallback: capitalise the first word.
  - `chipLabel`: IGCSE component; IB option label, else TZ, else `P{paper}`.
  - `fileAliases`: only IGCSE with `sessionCode` in `m|s|w`, giving `${code}_${sessionCode}${yy}_qp|ms_${component}`.
  - `buildPaperMatrix`:
    - columns are the distinct `paper` values, sorted by `parseInt` then string;
    - a column's note is its single route (`Shared` shows as "Core & Extended"), else empty;
    - papers are sorted year desc, sessionRank desc, paper number, then chip label (numeric);
    - rows are grouped by year, then session, and cells are aligned to the columns;
    - `markPrefix` = `pastpaperprep:marks:${bankSlug}:${id}:`;
    - the first row is marked latest;
    - `tiers` = some Core and some Extended.
  - `parsePaperQuery`:
    1. Cambridge slash code `(\d{4})/(\d{2})/(f/m|m/j|o/n)/(\d{2})`.
    2. Otherwise a file name `(\d{4})_([msw])(\d{2})_(qp|ms)_(\d{2})`.
    3. Otherwise consume tokens in this order: syllabus code `0\d{3}`; year `20\d{2}`, or short `[msw]\d{2}` (which also sets the session); session words (feb/march → feb-march, may/june/summer → may-june, oct/nov/winter → oct-nov); `tz[0-3]`; `paper|p` + `\d[ab]?`; a two-digit component `[1-6][1-3]`, which also sets the paper.
  - `matchPapers`: `[]` for an empty query; otherwise filter on every present field (sessions compared by group: may and may/june are both `may-june`; nov and oct/nov are both `oct-nov`), sort newest first, then component and variant, and slice to the limit.
- [ ] **Step 4:** Run. Expected: PASS. If real data contradicts an expectation, check the data and fix the code; only change the expectation if the data proves it wrong.
- [ ] **Step 5:** Commit: `feat(papers): public slugs, matrix data and paper-code search`.

### Task 3: Archive memoisation and slug lookups

**Files:** Modify `src/lib/whole-paper-archive.ts`, `src/lib/whole-paper-archive.test.ts`.

**Produces:** `findWholePaperBySlug(bank: BankSlug, slug: string): WholePaperDetail | null`. Document sources become `/past-papers/${subjectSlug}/${paperSlug}/document?kind=…`.

- [ ] **Step 1:** Tests:
  - `findWholePaperBySlug('igcse','2024-may-june-42')?.summary.id === '0580-2024-june-42'`;
  - an unknown slug gives null;
  - `getWholePaper('igcse','0580-2024-june-42')?.sources.question === '/past-papers/igcse-maths-0580/2024-may-june-42/document?kind=question'`;
  - repeated reads reuse the parsed manifest (`getWholePaper` twice returns the same `questions` array reference).

  Update the existing "internal document URLs" expectation.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Add a module-level `Map<string, WholePaperManifest>` cache in `readManifest`. It caches only successful parses and is bypassed in development so rebuilt manifests show without a restart. Point `sources` at public slugs and add `findWholePaperBySlug`.
- [ ] **Step 4:** Run. Expected: PASS (including all existing tests in the file).
- [ ] **Step 5:** Commit: `feat(papers): memoise manifests and look papers up by public slug`.

### Task 4: SEO copy, FAQ and JSON-LD builders

**Files:** Create `src/lib/past-paper-seo.ts`, `src/lib/past-paper-seo.test.ts`.

**Produces:**

```ts
export const SITE_URL = 'https://pastpaperprep.com';
export function subjectSearchName(bank: CatalogBank): string;      // 'IGCSE Maths 0580' | 'IB Math AA HL' | 'IB Chemistry SL'
export function yearRange(papers: readonly WholePaperSummary[]): string;
export type PageCopy = { title: string; description: string; h1: string; answer: string };
export function hubCopy(paperCount: number, qualification?: PastPaperQualification): PageCopy;
export function subjectCopy(bank: CatalogBank, papers: readonly WholePaperSummary[]): PageCopy;
export function yearCopy(bank: CatalogBank, year: number, papers: readonly WholePaperSummary[]): PageCopy;
export function paperNumberCopy(bank: CatalogBank, paper: string, papers: readonly WholePaperSummary[]): PageCopy;
export function paperCopy(bank: CatalogBank, p: WholePaperSummary): PageCopy;
export type FaqItem = { q: string; a: string };
export function subjectFaq(bank: CatalogBank, papers: readonly WholePaperSummary[]): FaqItem[];
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown>;
export function collectionJsonLd(copy: PageCopy, path: string, items: { name: string; path: string }[]): Record<string, unknown>;
export function faqJsonLd(faq: FaqItem[]): Record<string, unknown>;
export function paperJsonLd(bank: CatalogBank, p: WholePaperSummary, path: string): Record<string, unknown>;
```

- [ ] **Step 1:** Tests, with exact expectations:
  - `subjectSearchName`: `igcse` → "IGCSE Maths 0580", `ib-hl` → "IB Math AA HL", `ib-chemistry-sl` → "IB Chemistry SL", `igcse-additional` → "IGCSE Additional Maths 0606".
  - For a two-paper fixture (2016 Core P12 and 2024 Extended P42), `subjectCopy` gives:
    - title "IGCSE Maths 0580 Past Papers & Mark Schemes (2016–2024)";
    - answer "2 Cambridge IGCSE Mathematics (0580) past papers from 2016 to 2024, each with its mark scheme. Free, no sign-up.".
  - `yearCopy(2024)` title: "IGCSE Maths 0580 Past Papers 2024: All Sessions & Mark Schemes".
  - `paperNumberCopy('4')` title: "IGCSE Maths 0580 Paper 4 Past Papers (Extended), All Years".
  - `paperCopy` title: "0580/42 May/June 2024: IGCSE Maths Paper 4 & Mark Scheme".
  - IB paper title: "IB Math AA HL May 2024 Paper 1 TZ1: Paper & Markscheme".
  - `hubCopy(2463).title` is "Free IGCSE & IB Past Papers with Mark Schemes".
  - No title contains "PastPaperPrep".
  - The FAQ includes "Which 0580 papers do Core and Extended students take?", answered "Core students take Paper 1. Extended students take Paper 4.".
  - `paperJsonLd` has `@type` LearningResource, `isAccessibleForFree: true`, `timeRequired: 'PT2H30M'` and an absolute url, and no `author`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the strings exactly as the spec and tests say:
  - Descriptions are one sentence; they mention duration and marks only when verified.
  - `yearCopy` answer: "{n} {fullName} past papers from {year}: {sessions joined with ', ' and ' and '}, each with its mark scheme."
  - `paperNumberCopy` answer: "Every {name} Paper {P} from {range}, {n} papers, with mark schemes."
  - `paperCopy` h1 is `${session} ${year} ${paperName}`.
  - FAQ questions, as the spec says:
    - where to find papers;
    - what the paper numbers or timezones mean;
    - Core and Extended (only when tiers exist, built from per-paper routes, with a "both routes" sentence for Shared);
    - how to mark.
  - JSON-LD objects carry `@context`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(papers): titles, answer sentences, FAQs and structured data`.

### Task 5: Routes and server resolver

**Files:**
- Create: `src/lib/past-paper-pages.ts`, `src/app/past-papers/[slug]/page.tsx`, `src/app/past-papers/[slug]/[entry]/page.tsx`, `src/app/past-papers/[slug]/[entry]/document/route.ts` (+ moved test)
- Rewrite: `src/app/past-papers/page.tsx`, `src/app/past-papers/whole-paper-routes.test.tsx`
- Delete: `src/app/past-papers/[bankSlug]/**`
- Create stubs, returning `null`, filled in by Tasks 6–9: `src/components/past-papers/{PastPaperHub,PastPaperListPage,PastPaperPaperPage}.tsx`

**Produces** (`past-paper-pages.ts`, `import 'server-only'`):

```ts
export type HubBank = { bankSlug: BankSlug; subjectSlug: string; name: string; qualification: PastPaperQualification; paperCount: number; years: string; tone: CourseTone };
export type SubjectView = { kind: 'subject'; bank: CatalogBank; papers: WholePaperSummary[] };
export type YearView = { kind: 'year'; bank: CatalogBank; year: number; papers: WholePaperSummary[]; all: WholePaperSummary[] };
export type PaperNumberView = { kind: 'paperNumber'; bank: CatalogBank; paper: string; papers: WholePaperSummary[]; all: WholePaperSummary[] };
export type PaperView = { kind: 'paper'; bank: CatalogBank; detail: WholePaperDetail; all: WholePaperSummary[] };
export type ListView = SubjectView | YearView | PaperNumberView;
export async function hubBanks(qualification?: PastPaperQualification): Promise<HubBank[]>; // [] when disabled
export async function resolveSubject(slug: string): Promise<SubjectView | null>;          // null when disabled/unknown
export async function resolveEntry(slug: string, entry: string): Promise<YearView | PaperNumberView | PaperView | null>;
export async function pastPaperParams(): Promise<{ slugs: string[]; entries: { slug: string; entry: string }[] }>;
export async function pastPaperSitemapPaths(): Promise<string[]>;
```

- [ ] **Step 1:** Rewrite the route tests. Mock `@/lib/past-paper-pages`, the three page components (render a `data-testid` plus the view kind) and `next/navigation` `notFound`. Assert:
  - disabled params → `generateStaticParams()` returns `[]` for both dynamic routes, and the pages throw `NOT_FOUND` when resolvers return null or hub banks are empty;
  - `igcse` → hub with qualification `igcse`;
  - a subject slug → list page of kind `subject`;
  - year/number/paper entries → the right component and kind;
  - `generateMetadata` titles never contain "PastPaperPrep" and include canonical paths.

  Move the document-route test to the new location, with params `{ slug, entry }`.
- [ ] **Step 2:** Run `npx vitest run src/app/past-papers`. Expected: FAIL.
- [ ] **Step 3:** Implement the resolver, using the catalog functions and `getWholePaperSummaries`, `findWholePaperBySlug` and `wholePaperArchiveEnabled`.
  - Entry rules: `/^\d{4}$/` → year, when papers exist that year; `/^paper-([0-9a-z]+)$/` → paper number, when it exists; otherwise `findWholePaperBySlug`.
  - Pages:
    - `/past-papers`: hub, `notFound()` when `hubBanks()` is empty;
    - `[slug]`: `igcse|ib` gives the qualification hub, otherwise the subject list;
    - `[slug]/[entry]`: list page or paper page;
    - all of them set `dynamicParams = false` and `generateStaticParams` from `pastPaperParams()`, and `generateMetadata` uses Task 4 copy with `alternates.canonical`.
  - Remove the per-page `Young_Serif` imports.
  - Document route: resolve with `bankForSubjectSlug` + `findWholePaperBySlug`, then `getWholePaperDocument(bank, detail.summary.id, kind)`, with the same headers as today.
- [ ] **Step 4:** Run. Expected: PASS. Then `npm run typecheck`.
- [ ] **Step 5:** Commit: `feat(papers): search-friendly routes for subjects, years, paper numbers and papers`.

### Task 6: PaperMatrix, PaperFinder, PaperLibraryTools

**Files:** Create in `src/components/past-papers/`: `PaperMatrix.tsx`, `PaperMatrix.module.css`, `PaperFinder.tsx`, `PaperFinder.module.css`, `PaperLibraryTools.tsx`, `PaperLibraryTools.module.css`, plus tests `PaperMatrix.test.tsx` and `PaperFinder.test.tsx`.

**Interfaces:**
- `PaperMatrix({ data, tier }: { data: PaperMatrixData; tier: 'all' | 'core' | 'ext' })`
- `PaperFinder(props: { mode: 'papers'; papers: readonly WholePaperSummary[] } | { mode: 'subjects'; subjects: { name: string; code: string; href: string }[] })`. The hub never receives paper summaries (2,463 would add ~600 KB to the page).
- `PaperLibraryTools({ data, papers }: { data: PaperMatrixData; papers: readonly WholePaperSummary[] })`: a client component that owns tier state and renders the finder and tier toggle in one row (toggle only when `data.tiers`), then the matrix.

**Behaviour:**
- Matrix markup:
  - a card with a top area: the progress line "{n} of {total} marked" (only when n > 0) and a header row of an empty year cell, "Session", then column links (`label` + `note`);
  - one `<section>` per year, holding a sticky year `<h2>` and rows;
  - each row has a session `<h3>` (with a "New" badge when latest), then cells;
  - each non-empty cell has a phone-only label and a joined `.pill` of links (`data-route`, `data-done`).
- Grid columns are set inline with `--cols: 96px 150px repeat(${columns.length}, minmax(0,1fr))`.
- Tier dimming happens in CSS through `[data-tier]` on the card (`opacity:.18; pointer-events:none`). On phones it becomes `display:none`, and Shared stays visible under both tiers.
- Column hover is CSS only: `.card:has(.head [data-col="N"]:hover) .cell:not([data-col="N"]) { opacity:.35 }` for N = 0–7.
- Ticks:
  - after mount, scan `localStorage` keys;
  - a key counts if it starts with a link's `markPrefix` and `JSON.parse(value)` is a non-array object with at least one numeric value;
  - every parse is wrapped in try/catch;
  - storage being unavailable means no ticks.
- Phones (`max-width: 760px`): the header row is hidden, each row becomes a bordered card, the cell is a grid of `118px 1fr` with its label shown, empty cells are hidden, and chips are 42px tall.
- Finder (combobox): `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; listbox options are links.
  - Papers mode: `matchPapers(papers, parsePaperQuery(q), 6)`, each labelled `${paperName} · ${shortSession} ${year}`.
  - Subjects mode: subjects whose name or code contains the query. When the query also carries paper details (`parsePaperQuery` returns more than `code`), the matching subject's option links to `{href}?q={encoded query}`. Papers mode reads `?q` after mount, pre-fills the box and opens its suggestions; the subject page's canonical URL stays clean.
  - Enter opens the active option, or the first one, via `useRouter().push`. Arrow keys move the active option and Escape clears.
  - At 2+ characters with no results, show "No paper matches. Try 0580/42/M/J/24." (in subjects mode: "Try a subject or 0580/42/M/J/24.").
  - It fires `past_paper_search` with `{ found }` on a commit.
  - The placeholder has a short phone variant using two spans with CSS display.

- [ ] **Step 1:** Tests:
  - Matrix (fixture built with `buildPaperMatrix` from 5 inline summaries): link hrefs and titles; "New" only on the first row; column links; ticks with one valid key, one corrupt key and one all-null key give exactly one `[data-done]` and "1 of 5 marked".
  - Tools: clicking "Core" sets the card's `data-tier="core"`; an IB fixture renders no toggle.
  - Finder: `0580/42/M/J/24` gives the first option "Paper 42 · May/June 2024"; Enter pushes `/past-papers/igcse-maths-0580/2024-may-june-42`; `banana` gives the no-match line; ArrowDown changes `aria-activedescendant`; a subjects-mode query "chem" lists Chemistry 0620; `0580/42/M/J/24` in subjects mode links to `/past-papers/igcse-maths-0580?q=0580%2F42%2FM%2FJ%2F24`; papers mode with `?q=s24 42` in the URL pre-fills and shows Paper 42.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with the CSS values from `bank-f.html?joined`:
  - pill background `var(--subject-panel-tint)`, padding 3px, radius 12px;
  - chip 42×34, radius 9px, `font: 600 15px var(--font-body)`, tabular numbers;
  - hover: white background, `var(--course-accent)` text, small shadow;
  - divider `box-shadow: -1px 0 0 color-mix(in srgb, var(--course-pastel) 90%, #fff)`;
  - done: `--success-soft`/`--success` plus a 14px SVG tick badge;
  - card: `var(--surface-raised)`, `1px solid var(--line)`, radius 22px.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(papers): calm paper matrix with tier toggle, ticks and code search`.

### Task 7: Hub and list pages

**Files:**
- Implement: `PastPaperHub.tsx` + `.module.css`, `PastPaperListPage.tsx` + `.module.css`, tests `PastPaperHub.test.tsx` and `PastPaperListPage.test.tsx`
- Delete: `src/components/WholePaperHub.*`, `src/components/WholePaperBrowser.*` (+ tests)

**Hub:**
- centred H1 and one line (from `hubCopy`);
- a row with qualification links (All / IGCSE / IB as a segmented link group; the current one is active) and the `PaperFinder` in subjects mode;
- subject cards: the homepage look, grouped by tone, with a pastel header, Young Serif name, `CourseIcon`, tinted body and white rows ("{name}", "{n} papers", caret) linking to `/past-papers/{subjectSlug}`;
- the three-item "why" row;
- JSON-LD: Breadcrumb + CollectionPage/ItemList.

**List page:**
- breadcrumbs;
- centred header: 60px pastel icon tile, H1, answer sentence;
- `PaperLibraryTools`:
  - subject: all papers;
  - year: that year, with previous/next year links;
  - paper number: only that paper's papers;
- "Browse by year" links (year/number views link back to the subject);
- "Browse by paper" links with notes;
- one quiet link, "Practise {name} questions by topic →" `/banks/{bankSlug}`;
- FAQ `<details>` (subject view only);
- JSON-LD: Breadcrumb + CollectionPage/ItemList (first 100 papers) + FAQPage (subject view).

The root carries `data-subject-tone`.

- [ ] **Step 1:** Tests:
  - Hub (qualification `igcse`): only IGCSE cards, with the right hrefs.
  - Subject view: H1, answer sentence, year links, paper links, the FAQ question, `/banks/igcse` link, JSON-LD containing `FAQPage`.
  - Year view: prev/next links, no FAQ.
  - Paper-number view: an H1 with "Paper 4".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; delete the old components and any imports of them.
- [ ] **Step 4:** Run `npx vitest run src/components/past-papers src/app/past-papers`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(papers): library hub and subject, year and paper-number pages`.

### Task 8: Paper page (workspace, reader toolbar, rail, dock, timer)

**Files:**
- Implement: `PastPaperPaperPage.tsx`, `PaperWorkspace.tsx` + `.module.css` + `.test.tsx`
- Modify: `PastPaperReader.tsx` (+ css, test), `PaperAttemptTimer.tsx` (+ css, test), `src/lib/paper-reader-config.ts`

**Server page:**
- breadcrumbs (Past papers / {name} / {year} / {paperName});
- eyebrow (IGCSE: `Cambridge IGCSE {subject} · {code}/{component}`; IB: `{name} · {paperName}`);
- H1 `paperCopy().h1`;
- fact pills: route if Core/Extended, duration if verified, marks if verified, and `Variant N` (IGCSE numeric variant) or `TZN`;
- `PaperWorkspace` with `rail` children:
  - other variants (same year, session and paper) as a pill row, with the current one ink-filled;
  - same session (other papers) as a pill row;
  - the same paper in the previous and next sessions as two cards;
  - links to the year page and the paper-number page;
  - the quiet "Practise Paper {n} questions by topic →" `/banks/{bankSlug}/papers/paper-{n}`;
- below, "What's in this paper" (only with questions): `Q{n}`, the topics joined with ", ", and `{m} mark(s)` in two columns;
- the file names line (IGCSE);
- JSON-LD: Breadcrumb + `paperJsonLd`.

The held-paper message lives in `PaperWorkspace` (marking null).

**`PaperWorkspace`** (client), with props `{ reader: PaperReaderConfig; marking: PaperMarkingPaper | null; bank: string; children: ReactNode }`:
- state: `kind` and `marking`;
- `past_paper_open` once on mount; `past_paper_mark_open` with `{ bank }` when marking opens;
- desktop grid `minmax(0,1fr) 320px`;
- rail top box: "Finished?" with one line and a "Mark this paper" button, or for held papers "Self-marking isn't available for this paper yet.";
- marking replaces the rail with `<PaperMarkingWorkspace paper={marking} onClose={...} />` and sets `kind` to `markscheme`;
- phones: a fixed bottom dock (Paper/Scheme segment, the timer, "Mark it" when available); marking becomes a bottom sheet with `max-height: 62vh`; the page gets bottom padding of 96px.

**`PastPaperReader`:**
- removes its breadcrumb, header, sidebar and note;
- takes optional controlled `kind`/`onKindChange` (with internal fallback, so `/past-papers/preview` still works);
- one sticky toolbar row (`top: 82px`): document segment, compact timer, `‹ n / N ›`, a "View" `<details>` (Scroll pages / Single page, Fit width / 100%), a download icon link (`aria-label` "Download question paper PDF" / "Download mark scheme PDF") and a focus icon button;
- the page scrolls instead of an inner stage (desktop), so the IntersectionObserver root becomes `null`, `goTo` uses `scrollIntoView`, and pages get `scroll-margin-top: 150px`;
- focus view is unchanged.

**`PaperAttemptTimer`:**
- idle: a pill "▶ h:mm:ss" (`aria-label` "Start {n}-minute timer"), plus a "⋯" `<details>` with the custom minutes input and Start;
- running: the countdown, pause/resume and finish;
- ended: a status line and "New timer";
- a new prop `analyticsBank?: string`, which fires `past_paper_timer_start`;
- the logic module is unchanged.

- [ ] **Step 1:** Tests:
  - reader: controlled kind changes the source; the download label follows kind; the View popover switches to single page;
  - timer: all existing behaviours with the new labels (start, pause, resume, finish, custom validation 1–360);
  - workspace: Mark swaps the rail for the marking panel, switches to the mark scheme and fires `past_paper_mark_open`; a held paper shows the plain line with no Mark button and no reason text; `past_paper_open` fires once.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with the `paper-a.html` styling:
  - toolbar: `rgb(250 250 247 / .92)` (dark: `color-mix` with `--surface`), `backdrop-filter: blur(10px)`, `1px solid var(--line)`, radius 14px;
  - rail boxes: radius 18px; the "Finished?" box tinted with `--subject-panel-tint`;
  - dock: ink `#191917` background, radius 18px.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(papers): paper-first reader with sticky toolbar, rail and phone dock`.

### Task 9: Marking panel

**Files:** Modify `PaperMarkingWorkspace.tsx` (+ css, test), `src/lib/paper-marking-report.ts` (+ test).

- [ ] **Step 1:** Tests:
  - `topicPracticeHref('Algebra','igcse')` starts with `/banks/igcse?`;
  - + increments and clamps at max; − at blank sets 0 and stays at 0;
  - the report has exactly one link named `Practise {top topic}`, with an href starting `/banks/`;
  - "Lost marks in 1 of 1 questions" is shown;
  - `onClose` shows "Back to paper";
  - the storage restore test keeps passing.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - header: "Your marks", "Saved on this device. No account needed.", and a live total `{markedTotal} / {maxMarks}`;
  - each row: `Q{n}`, the first topic, and a stepper (−, text input `inputMode="numeric"` with the current validation, `/ max`, +), with a done tint once filled;
  - button "See where your marks went";
  - report: score line; top 3 topics, each with "Lost marks in X of Y questions", a bar, and the question numbers; "Show all"; one primary CTA `Practise {top} →` firing `past_paper_practice_click`; "Edit marks";
  - `past_paper_report_view` with `{ bank, complete }` when the report opens;
  - keep clear-confirm, storage failure, successful topics and the policy details.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(papers): stepper marking and a single next-step report`.

### Task 10: Sitemap, gated nav links, bank cross-links, docs

**Files:**
- Create: `src/lib/past-paper-nav.ts` (+ test)
- Modify: `src/app/sitemap.ts` (+ test), `SiteFooter.tsx`, `HeaderNavigation.tsx` (+ tests), `src/app/banks/[slug]/papers/[paperSlug]/page.tsx`, `docs/analytics-events.md`, `docs/seo-strategy.md`

- [ ] **Step 1:** Tests:
  - `pastPaperLinksEnabled()` is false with the environment unset, true with `NODE_ENV=development` + `LOCAL_PAPER_PREVIEW=true`, and true with production + both archive flags (use `vi.stubEnv`);
  - the footer/header render the "Free past papers" / "Past papers" link only when enabled;
  - the sitemap includes the mocked `pastPaperSitemapPaths()` URLs and none when empty.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement:

```ts
export function pastPaperLinksEnabled(): boolean {
  if (process.env.NODE_ENV === 'development' && process.env.LOCAL_PAPER_PREVIEW === 'true') return true;
  return process.env.NODE_ENV === 'production' && process.env.PAPER_ARCHIVE_ENABLED === 'true' && process.env.PAPER_ARCHIVE_STORAGE_VERIFIED === 'true';
}
```

Then:
- the sitemap appends `(await pastPaperSitemapPaths()).map(path => ({ url: SITE_URL + path }))`;
- the bank paper-number landing gets "Full Paper {n} past papers with mark schemes →" when enabled;
- the docs get the six events and a short "Free past-paper library" section listing the page types and query clusters.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(papers): sitemap, gated nav links and bank cross-links`.

### Task 11: Visual QA, gates, PR update

- [ ] **Step 1:** Using the `free-paper-preview` preview (port 3117), check:
  - `/past-papers`, `/past-papers/igcse`, `/past-papers/ib`
  - `/past-papers/igcse-maths-0580`, its `/2024` and `/paper-4`, and `/2024-may-june-42`
  - `/past-papers/ib-math-aa-hl` and `/2017-may-paper-3-calculus`
  - `/past-papers/igcse-chemistry-0620` (six columns)

  Check each at 1280 and 375px, light and dark. Look for overflow, sticky collisions, dock overlap and console errors, and run the full marking flow (mark, report, CTA href, back on the bank page with a tick).
- [ ] **Step 2:** Fix the findings. Add a regression test for logic issues.
- [ ] **Step 3:** Run `npm run lint && npm run typecheck && npm test && npm run build`. All must pass.
- [ ] **Step 4:** Local-only static-generation check: temporarily make `wholePaperArchiveEnabled` return true, run `npx next build`, record the `/past-papers` page count and build time, then `git checkout -- src/lib/whole-paper-archive.ts`.
- [ ] **Step 5:** Push and update the PR #216 description: the changes, page map, screenshots, gating and the build numbers. Check CI via `get_status`.
