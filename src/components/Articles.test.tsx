import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContent, ArticlesIndex } from "@/components/Articles";
import { ALL_ARTICLES, ARTICLES, getArticle, isPublicArticle } from "@/lib/articles";
import { BANK_CATALOG, getCatalogBanksForDisplay } from "@/lib/catalog";

describe("article library", () => {
  it("keeps Topic questions vs full past papers as the only featured guide", () => {
    render(<ArticlesIndex />);

    const featured = document.querySelector(".article-featured-card");
    expect(featured).toHaveTextContent(/Topic Questions vs Full Past Papers/i);
    expect(document.querySelectorAll(".article-featured-card")).toHaveLength(1);
    expect(document.querySelector(".article-latest"))
      .not.toHaveTextContent(/Topic Questions vs Full Past Papers/i);
  });
  it("keeps scheduled drafts out of public article collections", () => {
    expect(isPublicArticle({ draft: false })).toBe(true);
    expect(isPublicArticle({ draft: true })).toBe(false);
    expect(ALL_ARTICLES).toHaveLength(31);
    expect(ARTICLES).toHaveLength(28);
    expect(getArticle("how-to-mark-maths-past-paper-mistake-log")?.draft).toBe(false);
    expect(getArticle("topic-questions-vs-full-past-papers")?.draft).toBe(false);
    expect(getArticle("best-free-ib-maths-aa-hl-resources")?.draft).toBe(false);

    const topicDraft = ALL_ARTICLES.find(({ slug }) => slug === "topic-questions-vs-full-past-papers");
    const ibDraft = ALL_ARTICLES.find(({ slug }) => slug === "best-free-ib-maths-aa-hl-resources");
    expect(topicDraft).toMatchObject({ draft: false, publishedAt: "2026-09-02", updatedAt: "2026-09-02" });
    expect(ibDraft).toMatchObject({ draft: false, publishedAt: "2026-09-03", updatedAt: "2026-09-15" });
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

  it("keeps the commercial cluster behind an explicit release matrix", () => {
    const releaseMatrix = [
      ["best-ib-question-banks-maths-sciences", "2026-09-15", "2026-09-15", true],
      ["best-ib-maths-question-banks-aa-ai", "2026-09-15", "2026-09-15", false],
      ["best-ib-chemistry-question-banks", "2026-09-15", "2026-09-15", false],
      ["best-ib-physics-question-banks", "2026-09-15", "2026-09-15", false],
      ["best-ib-biology-question-banks", "2026-09-15", "2026-09-15", false],
      ["improve-ib-grades-past-paper-practice", "2026-09-15", "2026-09-15", false],
      ["best-save-my-exams-alternatives-topical-past-papers", "2026-09-15", "2026-09-21", false],
      ["pastpaperprep-vs-physics-and-maths-tutor", "2026-09-15", "2026-09-21", false],
      ["real-past-papers-vs-exam-style-questions", "2026-09-30", "2026-09-12", true],
      ["physics-and-maths-tutor-vs-save-my-exams", "2026-09-15", "2026-09-15", false],
      ["revision-village-vs-save-my-exams", "2026-09-15", "2026-09-15", false],
      ["exam-mate-vs-save-my-exams", "2026-09-15", "2026-09-15", false],
      ["pastpaperprep-for-tutors-printable-practice-sets", "2026-09-15", "2026-09-15", false],
      ["pastpaperprep-pricing-which-plan", "2026-09-15", "2026-09-15", false],
      ["best-igcse-maths-past-paper-websites", "2026-09-15", "2026-09-15", false],
      ["best-igcse-science-question-banks", "2026-09-15", "2026-09-15", true],
      ["best-igcse-chemistry-0620-question-banks", "2026-09-15", "2026-09-15", false],
      ["best-igcse-physics-0625-question-banks", "2026-09-15", "2026-09-15", false],
      ["best-igcse-biology-0610-question-banks", "2026-09-15", "2026-09-15", false],
      ["best-igcse-coordinated-sciences-0654-question-banks", "2026-09-15", "2026-09-15", false],
      ["best-igcse-economics-0455-question-banks", "2026-09-15", "2026-09-21", false],
    ] as const;

    expect(ALL_ARTICLES).toHaveLength(31);
    expect(ARTICLES).toHaveLength(28);
    expect(ALL_ARTICLES.filter(({ draft }) => draft)).toHaveLength(3);

    for (const [slug, publishedAt, updatedAt, draft] of releaseMatrix) {
      const article = ALL_ARTICLES.find((candidate) => candidate.slug === slug);
      expect(article, slug).toMatchObject({ slug, publishedAt, updatedAt, draft });
      if (draft) expect(getArticle(slug), slug).toBeUndefined();
      else expect(getArticle(slug), slug).toBe(article);
    }
  });

  it("keeps every intentionally hidden draft complete, current, and renderer-safe", () => {
    const expectedHiddenSlugs = [
      "best-ib-question-banks-maths-sciences",
      "real-past-papers-vs-exam-style-questions",
      "best-igcse-science-question-banks",
    ];
    const hiddenDrafts = ALL_ARTICLES.filter(({ draft }) => draft);

    expect(hiddenDrafts.map(({ slug }) => slug)).toEqual(expectedHiddenSlugs);
    for (const article of hiddenDrafts) {
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

      expect(article.sections.length, article.slug).toBeGreaterThanOrEqual(4);
      expect(article.faqs.length, article.slug).toBeGreaterThanOrEqual(2);
      expect(renderedTextFields, article.slug).not.toMatch(
        /not (?:yet )?live|not currently (?:live|available)|launch-gated|no (?:available |live )?.*bank route|must be fact-refreshed|from this draft/i,
      );
      expect(renderedTextFields, article.slug).not.toMatch(
        /\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|\[\d+\]|\b(?:heading|content):\s*[`'"]/,
      );
    }
  });

  it("keeps the new IGCSE guides aligned with the live bank catalog", () => {
    const liveBankGuides = [
      ["best-igcse-chemistry-0620-question-banks", "/banks/igcse-chemistry-0620"],
      ["best-igcse-physics-0625-question-banks", "/banks/igcse-physics-0625"],
      ["best-igcse-biology-0610-question-banks", "/banks/igcse-biology-0610"],
      ["best-igcse-coordinated-sciences-0654-question-banks", "/banks/igcse-coordinated-sciences-0654"],
      ["best-igcse-economics-0455-question-banks", "/banks/igcse-economics-0455"],
    ] as const;

    for (const [slug, route] of liveBankGuides) {
      const article = ALL_ARTICLES.find((candidate) => candidate.slug === slug);
      expect(article, slug).toBeDefined();
      if (!article) continue;

      const content = JSON.stringify(article);
      expect(content, slug).toContain(route);

      expect(content, slug).not.toMatch(/not (?:yet )?live|not currently (?:live|available)|launch-gated|no (?:available |live )?.*bank route/i);
    }

    const scienceGuide = ALL_ARTICLES.find(({ slug }) => slug === "best-igcse-science-question-banks");
    expect(scienceGuide).toBeDefined();
    const scienceCopy = JSON.stringify(scienceGuide);
    for (const [, route] of liveBankGuides.slice(0, 3)) expect(scienceCopy).toContain(route);
    expect(scienceCopy).not.toMatch(/not (?:yet )?live|launch-gated|no .*bank routes/i);
  });

  it("keeps the newly published IGCSE banks available under the verified production release gates", () => {
    const publishedIgcseSlugs = [
      "igcse-biology-0610",
      "igcse-economics-0455",
      "igcse-chemistry-0620",
      "igcse-physics-0625",
      "igcse-coordinated-sciences-0654",
    ];
    const productionBanks = getCatalogBanksForDisplay({
      NODE_ENV: "production",
      PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
      PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
    });

    for (const slug of publishedIgcseSlugs) {
      expect(BANK_CATALOG.find((bank) => bank.slug === slug), slug).toMatchObject({
        release: "gated",
        delivery: "hosted",
      });
      expect(productionBanks.some((bank) => bank.slug === slug), slug).toBe(true);
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

  it("ships an intentional public cluster with unique search-friendly URLs", () => {
    expect(ARTICLES).toHaveLength(28);
    expect(new Set(ALL_ARTICLES.map(({ slug }) => slug)).size).toBe(ALL_ARTICLES.length);
    expect(ARTICLES.map(({ slug }) => slug)).toEqual([
      "best-ib-maths-question-banks-aa-ai",
      "improve-ib-grades-past-paper-practice",
      "best-ib-chemistry-question-banks",
      "best-ib-physics-question-banks",
      "best-ib-biology-question-banks",
      "best-save-my-exams-alternatives-topical-past-papers",
      "pastpaperprep-vs-physics-and-maths-tutor",
      "physics-and-maths-tutor-vs-save-my-exams",
      "revision-village-vs-save-my-exams",
      "exam-mate-vs-save-my-exams",
      "pastpaperprep-for-tutors-printable-practice-sets",
      "pastpaperprep-pricing-which-plan",
      "best-igcse-maths-past-paper-websites",
      "best-igcse-chemistry-0620-question-banks",
      "best-igcse-physics-0625-question-banks",
      "best-igcse-biology-0610-question-banks",
      "best-igcse-coordinated-sciences-0654-question-banks",
      "best-igcse-economics-0455-question-banks",
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

    expect(publicArticleMarketingContent).not.toMatch(
      /PastPaperPrep[^.!?\n]{0,180}\b(?:10|ten|12|twelve)\b[^.!?\n]{0,120}\bbanks?\b/i,
    );

    const allSubjectBankClaims = publicArticleMarketingContent.match(
      /\b(?:19|nineteen)\b[^.!?\n]*\b(?:Cambridge IGCSE|Mathematics)\b[^.!?\n]*\b(?:IB|Chemistry|Physics|Biology)\b[^.!?\n]*\bbanks?\b/gi,
    ) ?? [];
    expect(allSubjectBankClaims.length).toBeGreaterThan(0);
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
    const bankRoutes = new Set(BANK_CATALOG.map(({ slug }) => `/banks/${slug}`));
    const syllabusRoutes = new Set(BANK_CATALOG.map(({ slug }) => `/syllabus/${slug}`));
    const searchHubRoutes = new Set(["/cambridge-igcse", "/ib"]);
    const articleRoutes = new Set(ALL_ARTICLES.map(({ slug }) => `/articles/${slug}`));

    for (const article of ALL_ARTICLES) {
      for (const { href } of article.relatedBanks) {
        expect(
          href === "/#question-banks"
            || href === "/pricing"
            || bankRoutes.has(href)
            || syllabusRoutes.has(href)
            || searchHubRoutes.has(href)
            || articleRoutes.has(href),
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
      expect(screen.getByRole("link", { name: article.title })).toHaveAttribute("href", `/articles/${article.slug}`);
    }
    expect(screen.getByRole("link", { name: /cambridge igcse maths question banks/i })).toHaveAttribute("href", "/#question-banks");
    expect(screen.getByRole("link", { name: /ib maths and science question banks/i })).toHaveAttribute("href", "/#question-banks");
  });

  it("puts the direct answer before the supporting detail and shows transparent authorship", () => {
    const article = ARTICLES[0];
    const { container } = render(<ArticleContent article={article} />);

    expect(screen.getByRole("heading", { level: 1, name: article.title })).toBeInTheDocument();
    expect(container.querySelector(".article-answer")).toHaveTextContent(article.answer);
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
