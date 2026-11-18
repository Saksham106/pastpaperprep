import type { ArticleSection } from "@/lib/articles";

type SectionLink = NonNullable<ArticleSection["links"]>[number];

/**
 * The shared "free papers first" section used across comparison guides. One source of truth, so
 * access rules and explanation coverage are edited once. The coverage claim is scoped to IGCSE and IB,
 * where every bank is fully explained; A Level Maths 9709 launched with partial explanations (owner,
 * 2026-11-17). articles-explanation-coverage.test.ts guards both.
 */
export function freeAccessSection(links: readonly SectionLink[], note?: string): ArticleSection {
  return {
    heading: "Free whole papers, then targeted practice",
    paragraphs: [
      "PastPaperPrep’s whole papers are free without signup, each with its official mark scheme. In the topical banks, guests see up to 20 matching free questions and a free account opens the rest of the free selection. Newer questions and custom PDF worksheets need paid bank access.",
      `Every IGCSE and IB question has a worked explanation that walks through the method. Look for the Explanation button; it follows the same free or paid access as the question, and free-year paper pages print the worked answers below the paper.${note ? ` ${note}` : ""}`,
    ],
    links: [...links],
  };
}
