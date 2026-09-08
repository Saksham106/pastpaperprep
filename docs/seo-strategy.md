# PastPaperPrep SEO + AEO operating plan

## The call

PastPaperPrep should win on **high-intent course and topic pages**, not a high-volume generic blog. The product already has the defensible asset: thousands of accurately classified IGCSE, IB Mathematics, IB Chemistry, IB Physics, and IB Biology questions. Search pages should expose that utility clearly, then articles should answer the revision questions that lead students into those banks.

Google's own guidance is boring but correct: make pages crawlable, use descriptive titles and URLs, link related pages, and publish genuinely useful original content rather than content made mainly to attract search traffic. [1][2] The same fundamentals apply to Google's AI features; there is no separate AEO trick or special markup that guarantees inclusion. [5]

## What this implementation establishes

- Crawlable `robots.txt` and a root `sitemap.xml` containing canonical public pages only.
- Canonical URLs, unique metadata, Open Graph, and Twitter metadata.
- `noindex` protection for login, account, auth, and dashboard routes.
- Twelve indexable course-bank pages with visible explanatory copy and internal links.
- An `/articles` hub, seven public first-party guides, and three source-checked competitor comparisons.
- Visible FAQ answers and matching Article, FAQ, Breadcrumb, Organization, Website, and CollectionPage JSON-LD. Structured data must describe visible page content and should be validated after deployment. [4]
- Vercel Web Analytics and Speed Insights instrumentation.
- Optional `GOOGLE_SITE_VERIFICATION` metadata support.

## Search architecture

### Tier 1 — money and product pages

These are the priority pages because they satisfy the user's task directly:

1. `/banks/igcse` — IGCSE Maths 0580 past papers by topic
2. `/banks/igcse-additional` — IGCSE Additional Maths 0606 past papers by topic
3. `/banks/ib-hl` — IB Math AA HL past papers by topic
4. `/banks/ib-sl` — IB Math AA SL past papers by topic
5. `/banks/ib-ai-hl` — IB Math AI HL past papers by topic
6. `/banks/ib-ai-sl` — IB Math AI SL past papers by topic
7. `/banks/ib-chemistry-hl` — IB Chemistry HL past papers by topic
8. `/banks/ib-chemistry-sl` — IB Chemistry SL past papers by topic
9. `/banks/ib-physics-hl` — IB Physics HL past papers by topic
10. `/banks/ib-physics-sl` — IB Physics SL past papers by topic
11. `/banks/ib-biology-hl` — IB Biology HL past papers by topic
12. `/banks/ib-biology-sl` — IB Biology SL past papers by topic

### Tier 2 — durable topic landing pages

Build these from the verified question taxonomy, not from invented keyword lists. Start with the largest and most exam-relevant topics per course. Each page must contain:

- a clear topic definition and syllabus context;
- real question results from that course and topic;
- useful filters;
- concise study guidance based on the actual question set;
- links back to its course bank and relevant guide;
- one stable canonical URL.

Do **not** index every filter combination or query-string state. That creates duplicate and thin pages. Topic pages should be curated, stable routes with enough real inventory to deserve indexing.

### Tier 3 — supporting articles

Seeded now:

- How to use maths past papers effectively
- How to mark a maths past paper and build a mistake log
- IGCSE Maths 0580 past papers by topic
- IB Math past papers by topic
- PastPaperPrep vs Revision Village
- PastPaperPrep vs Save My Exams
- PastPaperPrep vs Exam-Mate
- IB Biology past papers by topic
- Topic questions vs full past papers: 2 September 2026
- Best free IB Maths AA HL practice resources: 3 September 2026

These additions came from anonymous ChatGPT web searches run in Ego Browser with natural student prompts about repeated IGCSE mistakes and affordable IB Maths AA HL practice. The anonymous response stream exposed the searched sources and answer, but not the literal hidden `queries` array shown in the X demo; the research audit records that limitation instead of inventing query data.

Next articles, in order:

1. IGCSE Maths 0580 Core vs Extended: which papers should you practise?
2. IB Math AA vs AI: how the courses and exam questions differ
3. Calculator vs non-calculator maths practice
4. A guide tied to each newly launched high-value topic page

Every article needs a direct answer near the top, original examples or product-backed evidence, a named accountable author/team, updated dates, useful internal links, and citations to official curriculum material when factual course claims are made. Publishing frequency is not a goal; usefulness is. [2]

Competitor pages must compare the products users can actually buy, not manufacture a straw man. Check prices and features against each company's official page, show the verification date, acknowledge where the competitor is stronger, and link the source. Re-check every comparison at least quarterly and immediately after a reported pricing change.

## Query clusters to measure

No fake search-volume numbers. Use Search Console's real query and page data after indexing. [6]

- `igcse maths past papers by topic`
- `igcse maths 0580 topical past papers`
- `igcse maths topical questions pdf`
- `ib math aa past papers by topic`
- `ib math ai past papers by topic`
- `how to use past papers effectively`
- `ib maths aa vs ai`
- `pastpaperprep vs revision village`
- `pastpaperprep vs save my exams`
- `pastpaperprep vs exam mate`
- course + topic combinations discovered from the on-site taxonomy

Track brand and non-brand queries separately.

## Google Search Console launch checklist

1. Deploy this branch to production.
2. Add a **Domain property** for `pastpaperprep.com` in the correct Google account.
3. Complete DNS TXT ownership verification. Keep the record permanently.
4. Submit `https://pastpaperprep.com/sitemap.xml` in the Sitemaps report. Google recommends putting the sitemap at the site root, using absolute canonical URLs, and including only URLs intended for search. [3][7]
5. Inspect the homepage, all twelve bank pages, the article index, and each article with URL Inspection. Confirm Google's selected canonical and request indexing for the key launch pages. [8]
6. Check Pages/Indexing weekly for accidental `noindex`, redirect, duplicate-canonical, 404, and crawled-not-indexed patterns.
7. Check Performance monthly by query, page, country, and device. Search Console reports clicks, impressions, click-through rate, and average position. [6]

A sitemap aids discovery; it does not force indexing. Google's decision still depends on page quality, duplication, and usefulness. [3]

## Analytics operating view

Vercel Web Analytics should answer: which pages receive visits, where users came from, device/browser mix, geography, and engagement trends. Its visitor metric is privacy-oriented and not a persistent named-user identity. [9]

Speed Insights supplies real-user Core Web Vitals and route-level performance after production traffic begins. [10]

Monthly scorecard:

- Search Console non-brand clicks and impressions
- indexed canonical pages vs submitted sitemap URLs
- top landing pages and their conversion to question-bank use
- article-to-bank click-through
- organic signup and purchase conversion
- mobile Core Web Vitals by route

## 30 / 60 / 90 days

### Days 0–30

- Ship and verify this technical foundation.
- Finish Search Console ownership, sitemap submission, and URL inspection.
- Establish the baseline scorecard.
- Audit the real taxonomy and select 10 topic-page candidates based on inventory depth, student value, and observed queries.
- Improve weak snippets only after impression data exists.

### Days 31–60

- Launch the first 5 curated topic pages.
- Publish 2–3 supporting guides that link to those pages.
- Add explicit organic funnel events: article → bank, bank use, signup, and checkout.
- Review pages that earn impressions but weak CTR; test titles and descriptions without changing URLs.

### Days 61–90

- Launch the next 5 topic pages if the first set is indexed and useful.
- Consolidate or improve pages that remain thin or duplicative; do not keep them merely to inflate page count.
- Seek a small number of legitimate links from tutors, revision communities, school resources, and education creators by offering genuinely useful free access or resources—not mass link spam.
- Use Search Console data to choose the next course/topic cluster.

## Article publishing workflow

Articles currently live in `src/lib/articles.ts` and render through `src/app/articles/[slug]/page.tsx`.

For every new article:

1. Add one unique slug, title, description, direct answer, dates, sections, FAQs, and related bank links.
2. Cite official sources for factual exam-board or syllabus claims.
3. For competitor comparisons, include a dated table, a fit-based verdict, and the competitor's official pricing or product page.
4. Keep FAQ markup identical to the visible FAQ copy.
5. Ensure the article answers a real student question and points to the most relevant practice bank.
6. Run tests and a production build; verify its canonical, JSON-LD, internal links, and sitemap entry.
7. After deployment, inspect the URL in Search Console. Request indexing for important launches rather than blindly requesting every page.

## Guardrails

- No mass-generated pages from every filter combination.
- No copied exam-board or competitor prose.
- No misleading “we win everything” comparison pages; state meaningful competitor advantages.
- No FAQ/schema text hidden from users.
- No claims that schema, sitemaps, or “AEO optimization” guarantee rankings or AI citations.
- No article treadmill. Product-backed landing pages are the main asset.
- No backlink buying or spam outreach.

## Sources

[1] [Google Search Central: SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

[2] [Google Search Central: Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

[3] [Google Search Central: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

[4] [Google Search Central: Introduction to structured data markup](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)

[5] [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

[6] [Google Search Console: About Search Console](https://search.google.com/search-console/about)

[7] [Google Search Console Help: Manage your sitemaps](https://support.google.com/webmasters/answer/7451001)

[8] [Google Search Console Help: URL Inspection tool](https://support.google.com/webmasters/answer/9012289)

[9] [Vercel Web Analytics documentation](https://vercel.com/docs/analytics)

[10] [Vercel Speed Insights documentation](https://vercel.com/docs/speed-insights)
