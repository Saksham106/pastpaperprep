import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent, ArticlesIndex } from "@/components/Articles";
import { ALL_ARTICLES, ARTICLES, getArticle, isPublicArticle } from "@/lib/articles";

describe("article library", () => {
  it("keeps scheduled drafts out of public article collections", () => {
    expect(isPublicArticle({ draft: false })).toBe(true);
    expect(isPublicArticle({ draft: true })).toBe(false);
    expect(ALL_ARTICLES).toHaveLength(28);
    expect(ARTICLES).toHaveLength(10);
    expect(getArticle("how-to-mark-maths-past-paper-mistake-log")?.draft).toBe(false);
    expect(getArticle("topic-questions-vs-full-past-papers")?.draft).toBe(false);
    expect(getArticle("best-free-ib-maths-aa-hl-resources")?.draft).toBe(false);

    const topicDraft = ALL_ARTICLES.find(({ slug }) => slug === "topic-questions-vs-full-past-papers");
    const ibDraft = ALL_ARTICLES.find(({ slug }) => slug === "best-free-ib-maths-aa-hl-resources");
    expect(topicDraft).toMatchObject({ draft: false, publishedAt: "2026-09-02", updatedAt: "2026-09-02" });
    expect(ibDraft).toMatchObject({ draft: false, publishedAt: "2026-09-03", updatedAt: "2026-09-12" });
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

  it("keeps the new commercial cluster drafted behind an explicit release matrix", () => {
    const plannedDrafts = [
      ["best-ib-question-banks-maths-sciences", "Best IB Question Banks for Maths and Sciences (2026)", "2026-09-14"],
      ["best-ib-maths-question-banks-aa-ai", "Best IB Maths Question Banks for AA and AI (2026)", "2026-09-16"],
      ["best-ib-chemistry-question-banks", "Best IB Chemistry Question Banks for HL and SL (2026)", "2026-09-18"],
      ["best-ib-physics-question-banks", "Best IB Physics Question Banks for HL and SL (2026)", "2026-09-20"],
      ["best-ib-biology-question-banks", "Best IB Biology Question Banks for HL and SL (2026)", "2026-09-22"],
      ["improve-ib-grades-past-paper-practice", "How to Improve Your IB Grades With Past-Paper Practice", "2026-09-24"],
      ["best-save-my-exams-alternatives-topical-past-papers", "Best Save My Exams Alternatives for Topical Past Papers", "2026-09-26"],
      ["pastpaperprep-vs-physics-and-maths-tutor", "PastPaperPrep vs PMT: Free PDFs or Custom Practice Sets?", "2026-09-28"],
      ["real-past-papers-vs-exam-style-questions", "Real Past Papers vs Exam-Style Questions: What Works Better?", "2026-09-30"],
      ["pastpaperprep-for-tutors-printable-practice-sets", "PastPaperPrep for Tutors: Build Printable Practice Sets", "2026-10-02"],
      ["pastpaperprep-pricing-which-plan", "PastPaperPrep Pricing: Which Plan Is Right for You?", "2026-10-04"],
      ["best-igcse-maths-past-paper-websites", "Best IGCSE Maths Past-Paper Websites for 0580 and 0606", "2026-10-06"],
      ["best-igcse-science-question-banks", "Best IGCSE Science Question Banks for Biology, Chemistry and Physics", "2026-10-08"],
      ["best-igcse-chemistry-0620-question-banks", "Best IGCSE Chemistry 0620 Question Banks and Past-Paper Websites", "2026-10-10"],
      ["best-igcse-physics-0625-question-banks", "Best IGCSE Physics 0625 Question Banks and Past-Paper Websites", "2026-10-12"],
      ["best-igcse-biology-0610-question-banks", "Best IGCSE Biology 0610 Question Banks and Past-Paper Websites", "2026-10-14"],
      ["best-igcse-coordinated-sciences-0654-question-banks", "Best IGCSE Co-ordinated Sciences 0654 Question Banks", "2026-10-16"],
      ["best-igcse-economics-0455-question-banks", "Best IGCSE Economics 0455 Question Banks and Past-Paper Websites", "2026-10-18"],
    ] as const;

    expect(ALL_ARTICLES.filter(({ draft }) => draft)).toHaveLength(plannedDrafts.length);
    for (const [slug, title, publishedAt] of plannedDrafts) {
      const article = ALL_ARTICLES.find((candidate) => candidate.slug === slug);
      expect(article, slug).toMatchObject({ slug, title, publishedAt, updatedAt: "2026-09-12", draft: true });
      expect(getArticle(slug), slug).toBeUndefined();
    }
  });

  it("keeps unreleased IGCSE bank guides explicitly launch-gated across every field", () => {
    const launchGatedSlugs = [
      "best-igcse-science-question-banks",
      "best-igcse-chemistry-0620-question-banks",
      "best-igcse-physics-0625-question-banks",
      "best-igcse-biology-0610-question-banks",
      "best-igcse-coordinated-sciences-0654-question-banks",
      "best-igcse-economics-0455-question-banks",
    ];
    const unreleasedBankCode = /0610|0620|0625|0654|0455/;

    for (const slug of launchGatedSlugs) {
      const article = ALL_ARTICLES.find((candidate) => candidate.slug === slug);
      expect(article, slug).toMatchObject({ draft: true });
      expect(article, slug).toBeDefined();
      if (!article) continue;

      const content = [
        article.title,
        article.description,
        article.eyebrow,
        article.answer,
        ...article.sections.flatMap(({ heading, paragraphs, bullets = [] }) => [heading, ...paragraphs, ...bullets]),
        ...article.faqs.flatMap(({ question, answer }) => [question, answer]),
        ...article.relatedBanks.flatMap(({ label, href }) => [label, href]),
        ...(article.sources ?? []).flatMap(({ label, href }) => [label, href]),
        ...(article.comparison
          ? [
              article.comparison.caption,
              ...article.comparison.headings,
              ...article.comparison.rows.flatMap(({ label, pastPaperPrep, competitor }) => [label, pastPaperPrep, competitor]),
            ]
          : []),
      ].join("\n");

      expect(content, slug).toMatch(/(?:not (?:yet )?live|not currently (?:live|available)|launch-gated)/i);
      expect(content, slug).not.toMatch(/\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|\[\d+\]/);

      const internalLinks = [...article.relatedBanks, ...(article.sources ?? [])]
        .map(({ href }) => new URL(href, "https://pastpaperprep.com"))
        .filter(({ hostname }) => hostname === "pastpaperprep.com");
      expect(internalLinks.some(({ pathname }) => unreleasedBankCode.test(pathname)), slug).toBe(false);

      const contentWithoutNegativeStatus = content
        .replace(/not (?:yet )?live/gi, "")
        .replace(/not currently (?:live|available)/gi, "")
        .replace(/launch-gated/gi, "");
      expect(contentWithoutNegativeStatus, slug).not.toMatch(
        /PastPaperPrep[^.!?\n]{0,120}\b(?:is|are|now|currently)\b[^.!?\n]{0,40}\b(?:live|available)\b/i,
      );
    }
  });

  it("does not ship article markup that the plain-text renderer would expose", () => {
    for (const article of ALL_ARTICLES) {
      const renderedTextFields = [
        article.title,
        article.description,
        article.eyebrow,
        article.answer,
        ...article.sections.flatMap(({ heading, paragraphs, bullets = [] }) => [heading, ...paragraphs, ...bullets]),
        ...article.faqs.flatMap(({ question, answer }) => [question, answer]),
        ...article.relatedBanks.flatMap(({ label, href }) => [label, href]),
        ...(article.sources ?? []).flatMap(({ label, href }) => [label, href]),
        ...(article.comparison
          ? [
              article.comparison.caption,
              ...article.comparison.headings,
              ...article.comparison.rows.flatMap(({ label, pastPaperPrep, competitor }) => [label, pastPaperPrep, competitor]),
            ]
          : []),
      ].join("\n");
      expect(renderedTextFields, article.slug).not.toMatch(
        /\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|\[\d+\]|\b(?:heading|content):\s*[`'"]/,
      );
    }
  });

  it("ships a small, intentional public cluster with unique search-friendly URLs", () => {
    expect(ARTICLES).toHaveLength(10);
    expect(new Set(ALL_ARTICLES.map(({ slug }) => slug)).size).toBe(ALL_ARTICLES.length);
    expect(ARTICLES.map(({ slug }) => slug)).toEqual([
      "ib-biology-past-papers-by-topic",
      "best-free-ib-maths-aa-hl-resources",
      "topic-questions-vs-full-past-papers",
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

  it("keeps public article bank-count claims current and complete", () => {
    const publicArticleMarketingContent = ARTICLES.flatMap((article) => [
      article.title,
      article.description,
      article.eyebrow,
      article.answer,
      ...article.sections.flatMap(({ heading, paragraphs, bullets = [] }) => [heading, ...paragraphs, ...bullets]),
      ...article.faqs.flatMap(({ question, answer }) => [question, answer]),
      ...article.relatedBanks.map(({ label }) => label),
      ...(article.comparison
        ? [
            article.comparison.caption,
            ...article.comparison.headings,
            ...article.comparison.rows.flatMap(({ label, pastPaperPrep, competitor }) => [label, pastPaperPrep, competitor]),
          ]
        : []),
    ]).join("\n");

    expect(publicArticleMarketingContent).not.toMatch(/(?<!\$)\b(?:10|ten)\b[^.!?\n]*\bbanks?\b/i);

    const allSubjectBankClaims = publicArticleMarketingContent.match(
      /\b(?:12|twelve)\b[^.!?\n]*\bMathematics\b[^.!?\n]*\bChemistry\b[^.!?\n]*\bPhysics\b[^.!?\n]*\bbanks?\b/gi,
    ) ?? [];
    expect(allSubjectBankClaims.length).toBeGreaterThan(0);
    for (const claim of allSubjectBankClaims) {
      expect(claim).toMatch(/\bBiology\b/i);
    }
  });

  it("keeps current PastPaperPrep pricing in every price-sensitive public article", () => {
    const priceSensitiveSlugs = [
      "pastpaperprep-vs-revision-village",
      "pastpaperprep-vs-save-my-exams",
      "pastpaperprep-vs-exam-mate",
      "best-free-ib-maths-aa-hl-resources",
    ];
    const stalePastPaperPrepPhrases = [
      "$5 monthly for one bank",
      "$5/month for one bank",
      "$5 one bank",
      "$8 for a subject pair",
      "$8/month for a two-bank subject pair",
      "$8 monthly for a related subject pair",
      "$12 for all twelve banks",
      "$12 monthly for all twelve banks",
      "$96 all twelve banks",
      "PastPaperPrep starts at $5",
      "current paid options start at $5/month",
      "current listed $5/month",
    ];

    for (const slug of priceSensitiveSlugs) {
      const article = getArticle(slug);
      expect(article, slug).toBeDefined();
      const copy = JSON.stringify(article);
      expect(copy, slug).toContain("$6");
      expect(copy, slug).toContain("$25");
      for (const stalePhrase of stalePastPaperPrepPhrases) {
        expect(copy, `${slug}: ${stalePhrase}`).not.toContain(stalePhrase);
      }
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
      "/banks/ib-chemistry-hl",
      "/banks/ib-chemistry-sl",
      "/banks/ib-physics-hl",
      "/banks/ib-physics-sl",
      "/banks/ib-biology-hl",
      "/banks/ib-biology-sl",
    ]);
    const articleRoutes = new Set(ALL_ARTICLES.map(({ slug }) => `/articles/${slug}`));

    for (const article of ALL_ARTICLES) {
      for (const { href } of article.relatedBanks) {
        expect(
          href === "/#question-banks" || href === "/pricing" || bankRoutes.has(href) || articleRoutes.has(href),
          `${article.slug}: ${href}`,
        ).toBe(true);
      }
      for (const { href } of article.sources ?? []) {
        const url = new URL(href, "https://pastpaperprep.com");
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

    expect(screen.getByRole("heading", { level: 1, name: /past paper practice guides/i })).toBeInTheDocument();
    for (const article of ARTICLES) {
      expect(screen.getByRole("link", { name: new RegExp(article.title, "i") })).toHaveAttribute("href", `/articles/${article.slug}`);
    }
    expect(screen.getByRole("link", { name: /cambridge igcse maths question banks/i })).toHaveAttribute("href", "/#question-banks");
    expect(screen.getByRole("link", { name: /ib maths and science question banks/i })).toHaveAttribute("href", "/#question-banks");
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
    expect(screen.getByText(/Pricing checked 12 September 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revision Village Gold pricing/i })).toHaveAttribute(
      "href",
      "https://www.revisionvillage.com/revision-village-gold/",
    );
  });
});
