import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent } from "@/components/Articles";
import { getArticle } from "@/lib/articles";

const changedSlugs = ["pastpaperprep-vs-revision-village", "pastpaperprep-vs-exam-mate", "best-igcse-physics-0625-question-banks"];

describe("targeted article SEO improvements", () => {
  it.each(changedSlugs)("puts a natural PastPaperPrep practice link in the first answer for %s", slug => {
    const article = getArticle(slug)!;
    const { container } = render(<ArticleContent article={article} />);
    const answer = container.querySelector(".article-answer") as HTMLElement;
    expect(answer.textContent).toMatch(/^PastPaperPrep/);
    expect(within(answer).getByRole("link", { name: "PastPaperPrep" })).toHaveAttribute("href", expect.stringMatching(/^\/(?!\/)/));
    expect(container.textContent).not.toMatch(/Disclosure:|publishes this comparison/i);
    expect(screen.getByText("By the PastPaperPrep team")).toBeInTheDocument();
  });

  it("distinguishes actual RV monthly billing from full-course monthly equivalents", () => {
    const article = getArticle("pastpaperprep-vs-revision-village")!;
    const copy = JSON.stringify(article);
    expect(copy).toContain("$70");
    expect(copy).toContain("$249");
    expect(copy).toContain("$140");
    expect(copy).not.toContain("payment is shown as a one-time charge");
    expect(article.updatedAt).toBe("2026-10-05");
  });

  it.each(["pastpaperprep-vs-revision-village", "best-ib-maths-question-banks-aa-ai"])("links the indexed %s guide to RV alternatives before the FAQ", slug => {
    const { container } = render(<ArticleContent article={getArticle(slug)!} />);
    const link = container.querySelector('a[href="/articles/best-revision-village-alternatives"]')!;
    expect(link).not.toBeNull();
    expect(link.compareDocumentPosition(container.querySelector(".article-faq")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("provides calculation practice routes rather than inventing a calculation-only filter", () => {
    render(<ArticleContent article={getArticle("best-igcse-physics-0625-question-banks")!} />);
    expect(screen.getByRole("heading", { name: "Physics 0625 calculation questions by topic" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Motion, forces and energy calculation practice" })).toHaveAttribute("href", "/banks/igcse-physics-0625/topics/motion-forces-and-energy");
    expect(screen.getByRole("link", { name: "Electricity and magnetism practice" })).toHaveAttribute("href", "/banks/igcse-physics-0625/topics/electricity-and-magnetism");
  });
});
