import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent, ArticlesIndex } from "@/components/Articles";
import { ARTICLES, getArticle } from "@/lib/articles";

describe("article library", () => {
  it("ships a small, intentional starter cluster with unique search-friendly URLs", () => {
    expect(ARTICLES).toHaveLength(6);
    expect(new Set(ARTICLES.map(({ slug }) => slug)).size).toBe(ARTICLES.length);
    expect(ARTICLES.map(({ slug }) => slug)).toEqual([
      "how-to-use-maths-past-papers-effectively",
      "igcse-maths-0580-past-papers-by-topic",
      "ib-math-past-papers-by-topic",
      "pastpaperprep-vs-revision-village",
      "pastpaperprep-vs-save-my-exams",
      "pastpaperprep-vs-exam-mate",
    ]);
    for (const article of ARTICLES) {
      expect(article.description.length).toBeGreaterThan(100);
      expect(article.description.length).toBeLessThanOrEqual(170);
      expect(article.answer.length).toBeGreaterThan(100);
      expect(article.sections.length).toBeGreaterThanOrEqual(4);
      expect(article.faqs.length).toBeGreaterThanOrEqual(2);
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(getArticle(article.slug)).toBe(article);
    }
  });

  it("renders an index that links to every article and relevant question banks", () => {
    render(<ArticlesIndex />);

    expect(screen.getByRole("heading", { level: 1, name: /past paper revision guides/i })).toBeInTheDocument();
    for (const article of ARTICLES) {
      expect(screen.getByRole("link", { name: new RegExp(article.title, "i") })).toHaveAttribute("href", `/articles/${article.slug}`);
    }
    expect(screen.getByRole("link", { name: /igcse mathematics 0580 question bank/i })).toHaveAttribute("href", "/banks/igcse");
    expect(screen.getByRole("link", { name: /ib mathematics question banks/i })).toHaveAttribute("href", "/#question-banks");
  });

  it("puts the direct answer before the supporting detail and shows transparent authorship", () => {
    const article = ARTICLES[0];
    const { container } = render(<ArticleContent article={article} />);

    expect(screen.getByRole("heading", { level: 1, name: article.title })).toBeInTheDocument();
    expect(screen.getByText(article.answer)).toHaveClass("article-answer");
    expect(screen.getByText(/PastPaperPrep team/i)).toBeInTheDocument();
    expect(container.querySelector(".article-answer")?.compareDocumentPosition(container.querySelector(".article-section")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("heading", { name: /frequently asked questions/i })).toBeInTheDocument();
  });

  it("renders factual comparison tables, verification dates, and official sources", () => {
    const article = getArticle("pastpaperprep-vs-revision-village")!;
    render(<ArticleContent article={article} />);

    expect(screen.getByRole("table", { name: /pastpaperprep vs revision village/i })).toBeInTheDocument();
    expect(screen.getByText(/Pricing checked 30 August 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revision Village Gold pricing/i })).toHaveAttribute(
      "href",
      "https://www.revisionvillage.com/revision-village-gold/",
    );
  });
});
