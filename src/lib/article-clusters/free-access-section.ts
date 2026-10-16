import type { ArticleSection } from "@/lib/articles";

type SectionLink = NonNullable<ArticleSection["links"]>[number];

/**
 * The shared "free papers first" section used across comparison guides. One source of truth, so
 * access rules and explanation coverage are edited once. Coverage stays general on purpose: worked
 * explanations ship bank by bank, and naming banks here goes stale within days.
 */
export function freeAccessSection(links: readonly SectionLink[], note?: string): ArticleSection {
  return {
    heading: "Free whole papers, then targeted practice",
    paragraphs: [
      "PastPaperPrep’s whole papers are free without signup, each with its official mark scheme. In the topical banks, guests see up to 20 matching free questions and a free account opens the rest of the free selection. Newer questions and custom PDF worksheets need paid bank access.",
      `Many questions also have a worked explanation that walks through the method. Look for the Explanation button; it follows the same free or paid access as the question.${note ? ` ${note}` : ""}`,
    ],
    links: [...links],
  };
}
