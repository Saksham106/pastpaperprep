import { describe, expect, it } from "vitest";
import { SUBJECT_SLUGS } from "@/lib/past-paper-catalog";
import { FREE_PAPERS_EXPLANATIONS } from "./free-papers-explanations";

describe("free paper and explanation guides", () => {
  it("publishes only the two approved article slugs", () => {
    expect(FREE_PAPERS_EXPLANATIONS.map(({ slug }) => slug)).toEqual([
      "revisiondojo-vs-save-my-exams",
      "best-free-igcse-past-paper-websites",
    ]);
    for (const article of FREE_PAPERS_EXPLANATIONS) expect(article.draft).toBe(false);
  });

  it("cites the primary providers used for each comparison", () => {
    const hosts = (index: number) => FREE_PAPERS_EXPLANATIONS[index].sources?.map(({ href }) => new URL(href).hostname);
    expect(hosts(0)).toEqual(expect.arrayContaining(["www.revisiondojo.com", "www.savemyexams.com"]));
    expect(hosts(1)).toEqual(expect.arrayContaining(["www.cambridgeinternational.org", "www.physicsandmathstutor.com", "pastpapers.papacambridge.com"]));
  });

  it("links readers to canonical archives and matching qualification banks", () => {
    const archiveSubjects = Object.values(SUBJECT_SLUGS);
    const bankSlugs = Object.keys(SUBJECT_SLUGS);
    for (const article of FREE_PAPERS_EXPLANATIONS) {
      const qualification = article.slug === "revisiondojo-vs-save-my-exams" ? "ib" : "igcse";
      const links = [article.answerLink!, ...article.relatedBanks, ...article.sections.flatMap(({ links }) => links ?? [])];
      expect(links.some(({ href }) => href === `/past-papers/${qualification}`)).toBe(true);
      for (const { href } of links) {
        if (href.startsWith("/past-papers/") && href !== `/past-papers/${qualification}`) {
          const slug = href.slice("/past-papers/".length);
          expect(archiveSubjects).toContain(slug);
          expect(slug.startsWith(`${qualification}-`)).toBe(true);
        }
        if (href.startsWith("/banks/")) {
          const slug = href.slice("/banks/".length).split("?")[0];
          expect(bankSlugs).toContain(slug);
          expect(slug.startsWith(qualification)).toBe(true);
        }
      }
    }
  });
});
