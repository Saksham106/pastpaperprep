import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleContent } from "@/components/Articles";
import { ARTICLES, getArticle } from "@/lib/articles";

const SITE_URL = "https://pastpaperprep.com";

export function generateStaticParams() {
  return ARTICLES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const path = `/articles/${article.slug}`;

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      title: `${article.title} | PastPaperPrep`,
      description: article.description,
      url: path,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ["PastPaperPrep Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const url = `${SITE_URL}/articles/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "PastPaperPrep Team" },
        publisher: { "@type": "Organization", name: "PastPaperPrep", url: SITE_URL },
      },
      {
        "@type": "FAQPage",
        mainEntity: article.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Articles", item: `${SITE_URL}/articles` },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ArticleContent article={article} />
    </>
  );
}
