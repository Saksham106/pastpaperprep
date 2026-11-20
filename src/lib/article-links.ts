import { ARTICLES, getArticleIndexDetail, type Article } from "@/lib/articles";
import type { BankSlug } from "@/lib/catalog";
import { subjectSlugForBank } from "@/lib/past-paper-catalog";

/**
 * Guides to link from bank, course-guide and past-paper pages, so no guide hangs off /articles alone
 * (2026-11-20 review: 32 of 51 guides had one inbound link). Derived from each article's own practice and
 * related links, never hand-listed, so a new guide is linked as soon as it names a bank.
 */
export type ArticleLink = { href: string; title: string };

const link = (article: Article): ArticleLink => ({ href: `/articles/${article.slug}`, title: article.title });

function bankScore(article: Article, slug: BankSlug): number {
  const subject = subjectSlugForBank(slug);
  const own = (href: string) => href === `/banks/${slug}` || href.startsWith(`/banks/${slug}?`) || href === `/syllabus/${slug}` || (subject !== undefined && href.startsWith(`/past-papers/${subject}`));
  const practice = getArticleIndexDetail(article.slug)?.practiceLinks.filter((l) => own(l.href)).length ?? 0;
  const related = article.relatedBanks.filter((l) => own(l.href)).length;
  return practice * 2 + related;
}

/** Up to `limit` guides about this bank, the most specific first, then the newest. */
export function articlesForBank(slug: BankSlug, limit = 3): ArticleLink[] {
  return ARTICLES.map((article) => ({ article, score: bankScore(article, slug) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.article.publishedAt.localeCompare(a.article.publishedAt))
    .slice(0, limit)
    .map(({ article }) => link(article));
}

/** Every guide written for one board, newest first, for that board's hub. */
export function articlesForExam(exam: "Cambridge IGCSE" | "Cambridge A Level" | "IB Diploma"): ArticleLink[] {
  return ARTICLES.filter((article) => getArticleIndexDetail(article.slug)?.exam === exam).map(link);
}
