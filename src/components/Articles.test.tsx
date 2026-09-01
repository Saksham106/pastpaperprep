import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent, ArticlesIndex } from "@/components/Articles";
import { ALL_ARTICLES, ARTICLES, getArticle, isPublicArticle } from "@/lib/articles";

describe("article library", () => {
  it("keeps scheduled drafts out of public article collections", () => {
    expect(isPublicArticle({ draft: false })).toBe(true);
    expect(isPublicArticle({ draft: true })).toBe(false);
    expect(ALL_ARTICLES).toHaveLength(9);
    expect(ARTICLES).toHaveLength(7);
    expect(getArticle("how-to-mark-maths-past-paper-mistake-log")?.draft).toBe(false);
    expect(getArticle("topic-questions-vs-full-past-papers")).toBeUndefined();
    expect(getArticle("best-free-ib-maths-aa-hl-resources")).toBeUndefined();

    const topicDraft = ALL_ARTICLES.find(({ slug }) => slug === "topic-questions-vs-full-past-papers");
    const ibDraft = ALL_ARTICLES.find(({ slug }) => slug === "best-free-ib-maths-aa-hl-resources");
    expect(topicDraft).toMatchObject({ draft: true, publishedAt: "2026-09-02", updatedAt: "2026-09-02" });
    expect(ibDraft).toMatchObject({ draft: true, publishedAt: "2026-09-03", updatedAt: "2026-09-03" });
    expect(topicDraft?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf" }),
      expect.objectContaining({ href: "https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/" }),
    ]));
    expect(ibDraft?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "https://www.christosnikolaidis.com/en/maa/" }),
      expect.objectContaining({ href: "https://www.revisionvillage.com/ib-math/analysis-and-approaches-hl/questionbank/" }),
      expect.objectContaining({ href: "https://pastpaperprep.com/pricing" }),
    ]));
  });

  it("ships a small, intentional public cluster with unique search-friendly URLs", () => {
    expect(ARTICLES).toHaveLength(7);
    expect(new Set(ALL_ARTICLES.map(({ slug }) => slug)).size).toBe(ALL_ARTICLES.length);
    expect(ARTICLES.map(({ slug }) => slug)).toEqual([
      "how-to-mark-maths-past-paper-mistake-log",
      "how-to-use-maths-past-papers-effectively",
      "igcse-maths-0580-past-papers-by-topic",
      "ib-math-past-papers-by-topic",
      "pastpaperprep-vs-revision-village",
      "pastpaperprep-vs-save-my-exams",
      "pastpaperprep-vs-exam-mate",
    ]);
    for (const article of ALL_ARTICLES) {
      expect(article.description.length).toBeGreaterThan(100);
      expect(article.description.length).toBeLessThanOrEqual(170);
      expect(article.answer.length).toBeGreaterThan(100);
      expect(article.sections.length).toBeGreaterThanOrEqual(4);
      expect(article.faqs.length).toBeGreaterThanOrEqual(2);
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(getArticle(article.slug)).toBe(isPublicArticle(article) ? article : undefined);
    }
  });

  it("keeps every internal article and bank link on a registered route", () => {
    const bankRoutes = new Set([
      "/banks/igcse",
      "/banks/igcse-additional",
      "/banks/ib-hl",
      "/banks/ib-sl",
      "/banks/ib-ai-hl",
      "/banks/ib-ai-sl",
    ]);
    const articleRoutes = new Set(ALL_ARTICLES.map(({ slug }) => `/articles/${slug}`));

    for (const article of ALL_ARTICLES) {
      for (const { href } of article.relatedBanks) {
        expect(href === "/#question-banks" || href === "/pricing" || bankRoutes.has(href), `${article.slug}: ${href}`).toBe(true);
      }
      for (const { href } of article.sources ?? []) {
        const url = new URL(href);
        if (url.hostname !== "pastpaperprep.com") continue;
        expect(
          url.pathname === "/" || url.pathname === "/pricing" || bankRoutes.has(url.pathname) || articleRoutes.has(url.pathname),
          `${article.slug}: ${href}`,
        ).toBe(true);
      }
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

  it("grounds the IGCSE topical guide in the free resources students actually search for", () => {
    const article = getArticle("igcse-maths-0580-past-papers-by-topic")!;

    expect(article.sections.map(({ heading }) => heading)).toContain("Use free resources without building a resource pile");
    expect(article.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "https://mathsgenie.co.uk/igcse/maths/cie" }),
      expect.objectContaining({ href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/past-papers/" }),
    ]));
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
