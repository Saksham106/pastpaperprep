# Past-paper indexing: 2026-11-07

Why `/past-papers` now asks Google to index only some pages, and how to check whether it worked.

## What happened

- Google clicks fell about 90% on 2026-10-26 and had not recovered by 2026-11-07.
  - GSC, Oct 19–25: 696 clicks, 15.6K impressions.
  - GSC, Oct 31–Nov 6: 68 clicks, 319 impressions. Only the brand name ("pastpaperprep", "past paper prep") gets clicks.
- The site isn't broken:
  - No manual action or security issue, and Lumen lists no takedown notices.
  - 1.78K pages are indexed.
  - Robots, canonicals and responses are clean when fetched as Googlebot.
- Other traffic held up, so the drop is Google-only (PostHog sessions per week, Oct 19 → Oct 26 → Nov 2):
  - Bing: 117 → 125 → 106.
  - ChatGPT: 98 → 186 → 216.
- Google has not confirmed any ranking update since the September 2026 spam update.
- Most likely cause: Google downgraded the whole site because most of it was template pages.
  - 3,056 of the 3,491 sitemap URLs (88%) were `/past-papers` pages.
  - Each had about 220 words, roughly 93% of them shared with every other page, wrapped around an official PDF that loads client-side.
  - Timeline: the site launched 2026-08-25, these pages went up 2026-10-12, IndexNow pushed them 2026-10-16, traffic surged Oct 19–25, then everything dropped together.
  - GSC also shows 1,502 pages as "Discovered – currently not indexed".

## Clicks by page type before the drop (GSC, Oct 12–25)

| Pages | Clicks |
|---|---|
| Single papers from 2026 (219 pages) | 172 |
| Single papers from 2025 (408) | 46 |
| Single papers from 2016–2024 (2,127) | 66 |
| Year lists (194) | ~0 |
| Paper-number lists (83) | 13 |
| `/banks` pages | 263 |
| Articles | 131 |

## What other sites do

- **Physics & Maths Tutor:** one page per paper number, listing every session's PDFs.
- **Revision Village:** one past-papers page per course.
- **Save My Exams:** indexes paper-number hubs. Its only single-paper pages are teacher-written model-answer pages.
- Sites that recovered from this kind of drop cut or noindexed their thin pages, then rewrote them and indexed them again (see sources below). Pruning alone did not bring growth; the rewritten pages did.
- Google's John Mueller has said several times that Google judges site quality only from indexed pages, so noindexed pages are left out of that judgment.

## The rule (`src/lib/past-paper-indexing.ts`)

**Indexed, and listed in the sitemap:**
- The `/past-papers` hub, the IGCSE and IB hubs, and every subject page.
- Every paper-number page. These now include "What Paper N tests" and, for IGCSE, Cambridge's grade thresholds for that paper.
- A single-paper page that either:
  - prints worked explanations for at least 80% of its questions (free years only, fetched at prebuild from the public free bucket), or
  - is from its subject's latest exam year.

**`noindex, follow`, still live and linked:**
- Year lists.
- Every other single-paper page.

Measured on a production build on 2026-11-07:
- The sitemap drops from 3,491 to 1,672 URLs.
- `/past-papers` now lists 1,237 of them:
  - 25 hubs and subject pages.
  - 83 paper-number pages.
  - 1,129 single papers. Of those, 864 print worked answers (3,800–9,800 words each); the rest are from each subject's latest year.
- About 1,820 pages turn `noindex, follow`.

Every paper page also gains an "At a glance" section: question count, marks per topic, and that paper's grade thresholds where Cambridge publishes them.

Paid explanations never appear in the HTML. `scripts/generate-free-explanations.mts` fetches only questions listed in the free asset index, and `src/lib/free-explanations.ts` re-checks `isPreviewQuestion` before rendering.

## How to check it (weekly, in GSC for `sc-domain:pastpaperprep.com`)

1. **Pages → Not indexed → "Excluded by 'noindex' tag"** should climb towards about 1,800 as Google re-crawls.
2. **Performance, non-brand queries** (filter out queries containing "pastpaperprep" or "past paper prep"): watch whether impressions return.
3. **Performance by page:** paper-number pages and worked-answer pages should start earning impressions.

Expect weeks to months. Recovery often only shows at the next Google core update.

## Undo

- Make `paperIndexing` return `indexed: true` for every paper.
- Index year lists again in `src/app/past-papers/[slug]/[entry]/page.tsx`.
- Restore all entries in `pastPaperSitemapPaths`.

## Sources

- Google, [core updates guidance](https://developers.google.com/search/docs/appearance/core-updates) and [spam policies (scaled content abuse)](https://developers.google.com/search/docs/essentials/spam-policies)
- Search Engine Land, [content pruning case study](https://searchengineland.com/content-pruning-case-study-497056)
- Search Engine Journal, [programmatic SEO site deindexed, then recovered](https://www.searchenginejournal.com/why-website-deindexed-by-google-for-programmatic-seo-bounced-back/552179/)
- Mueller on noindexed pages and site quality: [SER](https://www.seroundtable.com/google-site-quality-indexed-pages-25593.html), [GSQI](https://www.gsqi.com/marketing-blog/remove-versus-improve-low-quality-thin-content/), [SEJ 2026](https://www.searchenginejournal.com/google-explains-seo-connection-of-site-quality-to-non-indexed-pages/582683/)
