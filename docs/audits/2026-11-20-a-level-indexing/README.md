# A Level indexing audit, 2026-11-20

Why: Cambridge A Level (five banks, 2026-11-18 to 11-20) and its free whole-paper library (#501) went live a month
after the 2026-10-26 Google demotion, which was tied to ~3,000 thin templated /past-papers pages
(docs/audits/2026-11-07-past-paper-indexing). This checks that A Level adds only pages with content of their own.

Method: live `https://pastpaperprep.com/sitemap.xml` fetched 2026-11-20 (main at 040590b6, #501 deployed); each
page type fetched and measured (visible words in `<main>`, 5-word shingle overlap with a sibling page, robots,
canonical, JSON-LD types).

## Sitemap, live

| | Before #501 | After #501 (live) | After this PR |
|---|---|---|---|
| Total URLs | 2,058 | 2,214 | 2,130 |
| /past-papers URLs | 1,229 | 1,385 | 1,296 |
| A Level URLs (all types) | 40 | 196 (8.9%) | 112 (5.3%) |

"Before #501" is the live count minus the 156 A Level /past-papers URLs #501 added (it changed nothing else in
the sitemap); its /past-papers figure matches the post-#473 count of 1,229. "After this PR" removes 89 A Level
latest-year paper pages and adds 5 articles.

/past-papers by board (live): IGCSE 785 + hub, IB 441 + hub, A Level 155 + hub, plus /past-papers.

## A Level page types

| Page type | Count | Words (main) | Status before | After this PR |
|---|---|---|---|---|
| /cambridge-a-level hub | 1 | ~100 | index, sitemap | index; adds a paper-led intro, IGCSE routes and guide links |
| /banks/a-level-* | 5 | 1,870–2,130 | index, sitemap | unchanged |
| /banks/…/topics/* (2 per bank) | 10 | 2,280–2,660 | index, sitemap | unchanged |
| /banks/…/papers/paper-N | 19 | 1,640–6,370 | index, sitemap | unchanged |
| /syllabus/a-level-* course guides | 5 | ~500 | index, sitemap | JSON-LD fixed, breadcrumbs added |
| /past-papers/a-level hub | 1 | ~300 | index, sitemap | unchanged |
| /past-papers/<subject> | 5 | ~740 | index, sitemap | unchanged |
| /past-papers/<subject>/paper-N | 19 | 270–280 | index, sitemap | unchanged (collection pages, #473 rule) |
| Free-year papers with worked answers (9709 2020–21 Pure 1–3) | 42 | ~6,850 | index, sitemap | unchanged |
| Latest-year (2026) papers | 89 | 250–520, 34–64% shared with a sibling | index, sitemap | **noindex, follow; out of sitemap** |
| Year lists (/past-papers/<subject>/<year>) | — | ~140 | noindex, follow | unchanged |
| Other papers | 780 | ~250–300 | noindex, follow | unchanged |

The 89 latest-year pages are the only thin indexable type. They carry a paper's metadata, a question-by-question
topic list and the PDF viewer (loaded client-side), with no worked answers in the HTML. #473 keeps latest-year
pages for IGCSE and IB because they held 61% of paper-page clicks before the drop; A Level has no such history.
`LATEST_YEAR_HELD_BACK` in `src/lib/past-paper-indexing.ts` holds A Level back until GSC shows demand for its
paper pages or the pages carry worked answers. The 9709 2026 Pure 1–3 papers have explanations, but only free
years print them in the HTML, so they stay held too.

## Other checks

- Canonical: every A Level page is self-canonical. robots.txt allows all A Level paths.
- JSON-LD: hubs CollectionPage + Course list; bank pages CollectionPage/Course/BreadcrumbList/FAQPage; paper pages
  LearningResource + BreadcrumbList. Fixed: course guides pointed `isPartOf` at `/cambridge-igcse#page` for A Level
  (and at a dangling `#page` id for every board); they now name their own hub and carry a BreadcrumbList and Course.
- llms.txt lists the five A Level banks and their free past papers; new guides are listed automatically.
- IndexNow submits sitemap additions and removals after each production deploy, so the 89 removed URLs are
  re-crawled and seen as noindex.
- Internal links: home hero and footer already name A Level. Added: About links and copy, FAQ (it said A Level
  was not covered), IGCSE course guides and IGCSE past-paper subject pages link to their A Level successor.
