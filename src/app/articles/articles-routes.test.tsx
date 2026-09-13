import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ArticlesPage, { metadata as articlesMetadata } from "@/app/articles/page";
import ArticlePage, { generateMetadata, generateStaticParams } from "@/app/articles/[slug]/page";
import { ARTICLES } from "@/lib/articles";

describe("article routes", () => {
  it("publishes a canonical article index", () => {
    expect(articlesMetadata.title).toBe("Past Paper Practice Guides and Question Bank Comparisons");
    expect(articlesMetadata.description).toContain("Mathematics, Chemistry, Physics, and Biology");
    expect(articlesMetadata.alternates?.canonical).toBe("/articles");
    expect(articlesMetadata.openGraph).toMatchObject({
      title: "Past Paper Practice Guides and Question Bank Comparisons | PastPaperPrep",
      url: "/articles",
      type: "website",
      images: [{ url: "/pastpaperprep-share.png" }],
    });
    expect(renderToStaticMarkup(<ArticlesPage />)).toContain("Past paper practice guides");
  });

  it("prebuilds every article and emits canonical article metadata", async () => {
    expect(generateStaticParams()).toEqual(ARTICLES.map(({ slug }) => ({ slug })));
    const article = ARTICLES[0];
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: article.slug }) });

    expect(metadata.title).toBe(article.title);
    expect(metadata.description).toBe(article.description);
    expect(metadata.alternates?.canonical).toBe(`/articles/${article.slug}`);
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: `/articles/${article.slug}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ["PastPaperPrep Team"],
      images: [{ url: "/pastpaperprep-share.png" }],
    });
    expect(metadata.twitter).toMatchObject({ images: ["/pastpaperprep-share.png"] });
  });

  it("renders accurate Article, FAQ, and breadcrumb JSON-LD from visible content", async () => {
    const article = ARTICLES[0];
    const markup = renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ slug: article.slug }) }));
    const match = markup.match(/<script type="application\/ld\+json">(.*?)<\/script>/);

    expect(match).not.toBeNull();
    const jsonLd = JSON.parse(match![1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@graph"].map((entry: { "@type": string }) => entry["@type"])).toEqual([
      "Article",
      "FAQPage",
      "BreadcrumbList",
    ]);
    expect(jsonLd["@graph"][0]).toMatchObject({
      headline: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      author: { "@type": "Organization", name: "PastPaperPrep Team" },
    });
    expect(jsonLd["@graph"][1].mainEntity).toHaveLength(article.faqs.length);
    expect(markup).toContain(article.answer);
  });
});
