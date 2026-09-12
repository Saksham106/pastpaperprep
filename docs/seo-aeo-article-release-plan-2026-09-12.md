# PastPaperPrep SEO/AEO article release plan

Updated: 2026-09-12

## Principle

Publish one article every two days, but never publish solely because its target date arrived. The date is an editorial target. Each release requires a current-facts check, focused tests, and an explicit `draft: true` to `draft: false` change.

This avoids two bad outcomes: mass-publishing thin pages and accidentally claiming that an unreleased question bank is live.

## Release queue

| Target date | Article | Release condition |
| --- | --- | --- |
| 2026-09-14 | Best IB Question Banks for Maths and Sciences (2026) | Recheck live bank catalog, pricing, and competitor claims |
| 2026-09-16 | Best IB Maths Question Banks for AA and AI (2026) | Recheck AA/AI routes and competitor claims |
| 2026-09-18 | Best IB Chemistry Question Banks for HL and SL (2026) | Recheck Chemistry HL/SL routes and sources |
| 2026-09-20 | Best IB Physics Question Banks for HL and SL (2026) | Recheck Physics HL/SL routes and sources |
| 2026-09-22 | Best IB Biology Question Banks for HL and SL (2026) | Recheck Biology HL/SL routes and sources |
| 2026-09-24 | How to Improve Your IB Grades With Past-Paper Practice | Recheck learning-science citations and product workflow |
| 2026-09-26 | Best Save My Exams Alternatives for Topical Past Papers | Refresh competitor access and pricing claims |
| 2026-09-28 | PastPaperPrep vs PMT: Free PDFs or Custom Practice Sets? | Refresh PMT coverage and PastPaperPrep workflow |
| 2026-09-30 | Real Past Papers vs Exam-Style Questions: What Works Better? | Recheck source language and avoid universal outcome claims |
| 2026-10-02 | PastPaperPrep for Tutors: Build Printable Practice Sets | Verify PDF export and answer/mark-scheme behavior live |
| 2026-10-04 | PastPaperPrep Pricing: Which Plan Is Right for You? | Reconcile copy against live checkout prices immediately before release |
| 2026-10-06 | Best IGCSE Maths Past-Paper Websites for 0580 and 0606 | Recheck both live banks and competitors |
| 2026-10-08 | Best IGCSE Science Question Banks for Biology, Chemistry and Physics | **Hold until all claimed IGCSE science banks are live** |
| 2026-10-10 | Best IGCSE Chemistry 0620 Question Banks and Past-Paper Websites | **Hold until 0620 is live and verified** |
| 2026-10-12 | Best IGCSE Physics 0625 Question Banks and Past-Paper Websites | **Hold until 0625 is live and verified** |
| 2026-10-14 | Best IGCSE Biology 0610 Question Banks and Past-Paper Websites | **Hold until 0610 is live and verified** |
| 2026-10-16 | Best IGCSE Co-ordinated Sciences 0654 Question Banks | **Hold until 0654 is live and verified** |
| 2026-10-18 | Best IGCSE Economics 0455 Question Banks and Past-Paper Websites | **Hold until 0455 is live and verified** |

A missed target date does not justify releasing an inaccurate page. The IGCSE launch-gated pages stay drafts until their matching production bank exists, loads, filters correctly, and has a valid public route.

## Release gate for each article

1. Refresh all dated pricing, inventory, and competitor-feature claims from primary sources.
2. Confirm every PastPaperPrep bank named as available is present in the production catalog.
3. Confirm every internal link resolves to a registered route.
4. Confirm the page has a distinct query intent and does not duplicate an existing article.
5. Change only that article to `draft: false` and set `updatedAt` to the release date.
6. Run the article tests, full test suite, lint, type-check, production build, and `git diff --check`.
7. Review the rendered page, canonical URL, structured data, article index, and sitemap before merge.
8. After deployment, read back the live article URL and sitemap entry.

## Research evidence caveat

The anonymous ChatGPT sessions informed topic selection through visible answers, cited sources, and competitor mentions. They did not expose a literal hidden `queries` field. These themes are qualitative evidence, not search-volume data. Search Console impressions, clicks, signups, and AI-answer mentions should decide which pages get refreshed or expanded after publication.
