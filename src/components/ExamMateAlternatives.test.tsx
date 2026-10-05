import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent } from "@/components/Articles";
import { ALTERNATIVES_COMPARISONS } from "@/lib/article-clusters/alternatives-comparisons";

const article = ALTERNATIVES_COMPARISONS.find(({ slug }) => slug === "best-exam-mate-alternatives")!;

describe("Exam-Mate alternatives article", () => {
  it("leads with PastPaperPrep practice and an early inline bank link", () => {
    const { container } = render(<ArticleContent article={article} />);
    const answer = container.querySelector(".article-answer")!;

    expect(answer).toHaveTextContent(/^PastPaperPrep is the first alternative/);
    expect(answer.querySelector("a")).toHaveAttribute("href", "/#question-banks");
    expect(container.querySelector(".comparison-table")).toBeInTheDocument();
  });

  it("compares provenance, access, printable practice, and links to the separate pricing guide", () => {
    const content = JSON.stringify(article);
    expect(article).toMatchObject({
      draft: false,
      publishedAt: "2026-10-05",
      updatedAt: "2026-10-05",
      title: "Best Exam-Mate Alternatives for IB and IGCSE: Free and Paid Topical Practice",
    });
    expect(article.answerLink).toEqual({ href: "/#question-banks", label: "PastPaperPrep" });
    expect(content).toMatch(/actual exam sessions/);
    expect(content).toMatch(/exam-style/);
    expect(content).toMatch(/not downloadable/);
    expect(content).toMatch(/USD \$12/);
    expect(content).toContain("/articles/pastpaperprep-vs-exam-mate");
    expect(content).not.toMatch(/the universal best|(?<!no question bank )guarantees? (?:a|your) grade/);
    expect(article.faqs[0].answer).toMatch(/^PastPaperPrep offers/);
  });
});