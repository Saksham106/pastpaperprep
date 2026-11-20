# Indexing audit, 2026-11-20 (A Level and sitewide)

**Why.** Google demoted the site sitewide on 2026-10-26. The demotion was tied to ~3,000 thin templated /past-papers pages (docs/audits/2026-11-07-past-paper-indexing). Since then:

- Cambridge A Level launched: five banks (2026-11-18 to 11-20) and a free whole-paper library (#501).
- The owner asked for a sitewide review: data in the session notes, `seo-review-2026-11-20*.md`.

The owner then decided (2026-11-20):

- One indexed page per subject stands in for that year's individual papers.
- Individual papers are noindex by default.
- A paper stays indexed only with evidence of demand, and prints a free preview of 2–3 worked explanations.

**Method.**

- The live `https://pastpaperprep.com/sitemap.xml` was fetched on 2026-11-20 (main at 040590b6, #501 deployed).
- Page types were sampled and measured: visible words in `<main>`, 5-word shingle overlap with a sibling page, robots, canonical and JSON-LD.
- The "after" counts come from this branch's build (`sitemap.xml`) plus `pastPaperSitemapPaths()` with the archive on.

## Sitemap

| | Before #501 | Live (after #501) | After this PR |
|---|---|---|---|
| Total URLs | 2,058 | 2,214 | **1,932** |
| /past-papers URLs | 1,229 | 1,385 | 1,098 |
| – free-year papers with worked answers | 860 | 902 | 902 |
| – latest-year papers | 261 | 350 | 0 |
| – demand-listed papers (with preview) | — | — | 36 |
| – latest-year lists (one per subject) | 0 | 0 | 27 |
| – paper-number pages | 83 | 102 | 102 |
| – subject pages and hubs | 25 | 31 | 31 |
| A Level URLs (all types) | 40 | 196 (8.9%) | **117 (6.1%)** |
| Articles (incl. /articles) | 51 | 51 | 56 |

"Before #501" is the live count minus the 156 A Level /past-papers URLs that #501 added; #501 changed nothing else in the sitemap. Its /past-papers figure matches the post-#473 count of 1,229.

/past-papers by board after this PR: IGCSE 644, IB 381, A Level 72 (each including its hub), plus /past-papers.

## Latest-year papers → one year page per subject

The 350 latest-year paper pages (IGCSE and IB 2026, 0654 2025, and 89 A Level 2026) were the last thin indexable block:

- 190–540 words each.
- Variants share up to 88% of their text with a sibling (0625/22 vs /23 for 2026).
- IB Paper 1b pages had 187 words.
- No worked answers.

They are now noindex, follow. Each subject's latest year list (`/past-papers/<subject>/<latest year>`) is indexed in their place. It now prints:

- every paper sat that year, by session and component, with each variant's code (e.g. 0625/22/M/J/26), timing and marks, from the cited assessment-structure data;
- that year's grade thresholds, from Cambridge's tables;
- the topics across that year's papers.

So a search for a paper code lands on a page that lists it. Older year lists stay noindex.

## Demand-listed papers

Rule, also stored in `src/data/paper-demand.json`. A paper page is listed when it has any one of:

- ≥3 Google clicks on 2026-10-12..10-25, from Search Console's page report;
- ≥6 search or AI-assistant sessions landing on it in the 60 days to 2026-11-20 (PostHog, first pageview per session, single-page CN direct sessions excluded);
- ≥2 Bing clicks on 2026-10-01..11-18.

Free-year pages already indexed for worked answers are not listed. A listed page is indexed only when at least 2 preview explanations print.

Result: 36 pages, every one with a 2–3 answer preview. All 36 are IB except 0455/21 May/June 2025 and 0654/11 May/June 2024; 30 are 2026 papers.

- Evidence per page is in `paper-demand.json`.
- Raw exports were kept outside the repo (GSC 1,209 page rows, Bing 14, PostHog 150).
- `paper-question-ids.json` here is the question list the preview builder used.

Previews: `scripts/build-paper-previews.mjs` takes the first three explained questions. It rebuilds each explanation exactly as `scripts/explanations/publish.mjs` uploads it, and accepts it only if its SHA-256 matches the newest publish receipt. The page therefore prints the same text the paid bank serves.

The previews are committed in `src/data/paper-preview-explanations.json` (~300 KB). They become public once printed, so the repo doesn't widen access.

## A Level page types

| Page type | Count | Words (main) | After this PR |
|---|---|---|---|
| /cambridge-a-level hub | 1 | ~100 → more | index; paper-led intro, IGCSE routes, guide links |
| /banks/a-level-* | 5 | 1,870–2,130 | index |
| /banks/…/topics/* (2 per bank) | 10 | 2,280–2,660 | index |
| /banks/…/papers/paper-N | 19 | 1,640–6,370 | index |
| /syllabus/a-level-* course guides | 5 | ~500 | index; JSON-LD fixed |
| /past-papers/a-level hub and subjects | 6 | 300–740 | index |
| /past-papers/<subject>/paper-N | 19 | 270–280 | index |
| 9709 2020–21 Pure 1–3 papers (worked answers) | 42 | ~6,850 | index |
| /past-papers/<subject>/2026 | 5 | year page | index |
| Other papers | 869 | ~250–520 | noindex, follow |

## Other fixes in this PR

- **Course-guide JSON-LD.** It pointed `isPartOf` at `/cambridge-igcse#page` for A Level, and at a dangling `#page` id for every board. It now names its own hub and adds a BreadcrumbList and a Course.
- **Article links.** 32 of 51 guides had one inbound link, from /articles. Bank pages, course guides and past-paper subject pages now link up to 3 guides about that bank, derived from each guide's own links. Each board hub lists its board's guides.
- **llms.txt.** Adds revision notes (6 courses plus 0620 summaries) and grade thresholds, and states explanation coverage exactly from `available.json`.
- **Notes.** BreadcrumbList on course, topic and lesson pages. Sitemap lastmod is the date of the course's newest changelog entry.
- **Subject pages.** These shared 83% of their text across subjects. Each now opens with how the subject is examined: the latest sitting's papers with timings and marks, plus that year's most-tested topics.
- **Not changed: `http://www` → `https://www` → apex.** The first hop is Vercel's automatic HTTPS upgrade, before any app or redirect config runs. It can't be removed in code, and it costs one extra hop on a URL nothing links to.
