import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent } from "@/components/Articles";
import { IB_SCIENCE_BUYER_GUIDES } from "@/lib/article-clusters/ib-sciences";
import { IGCSE_SCIENCE_CHEM_PHYSICS } from "@/lib/article-clusters/igcse-science-chem-physics";
import { IGCSE_BIO_COORDINATED_ECON } from "@/lib/article-clusters/igcse-bio-coordinated-econ";

const cases = [
  ...IB_SCIENCE_BUYER_GUIDES.map((article) => [article, article.slug.includes("chemistry") ? "/banks/ib-chemistry-hl" : article.slug.includes("physics") ? "/banks/ib-physics-hl" : "/banks/ib-biology-hl"] as const),
  [IGCSE_SCIENCE_CHEM_PHYSICS.find((a) => a.slug === "best-igcse-chemistry-0620-question-banks")!, "/banks/igcse-chemistry-0620"],
  [IGCSE_SCIENCE_CHEM_PHYSICS.find((a) => a.slug === "best-igcse-physics-0625-question-banks")!, "/banks/igcse-physics-0625"],
  [IGCSE_BIO_COORDINATED_ECON.find((a) => a.slug === "best-igcse-biology-0610-question-banks")!, "/banks/igcse-biology-0610"],
  [IGCSE_BIO_COORDINATED_ECON.find((a) => a.slug === "best-igcse-coordinated-sciences-0654-question-banks")!, "/banks/igcse-coordinated-sciences-0654"],
  [IGCSE_BIO_COORDINATED_ECON.find((a) => a.slug === "best-igcse-economics-0455-question-banks")!, "/banks/igcse-economics-0455"],
] as const;

describe("existing subject article AEO practice paths", () => {
  it.each(cases.map(([article, href]) => [article.slug, article, href] as const))("renders an early PastPaperPrep answer link for %s", (_slug, article, href) => {
    expect(article.answerLink).toEqual({ href, label: "PastPaperPrep" });
    const { container } = render(<ArticleContent article={article} />);
    const answer = container.querySelector(".article-answer")!;
    expect(answer.querySelector("a")).toHaveAttribute("href", href);
    expect(answer.textContent).toContain("PastPaperPrep");
    expect(article.updatedAt).toBe("2026-10-07");
  });

  it("retains distinct study tasks, precise access boundaries and no unverified prices", () => {
    const content = JSON.stringify(cases.map(([article]) => article));
    expect(content).toMatch(/stoichiometry/i);
    expect(content).toMatch(/Paper 6|data response|data-response/i);
    expect(content).toMatch(/Core|Extended/);
    expect(content).toMatch(/guests.*20|20 questions matching/i);
    expect(content).toMatch(/free account/i);
    expect(content).toMatch(/eligible bank access/i);
    expect(content).not.toMatch(/\$\d+\s*(?:per|\/)/);
  });
});
