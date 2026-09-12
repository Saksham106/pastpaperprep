import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ARTICLES, type Article } from "@/lib/articles";
import { Breadcrumbs } from "@/components/Breadcrumbs";

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="article-card">
      <p className="eyebrow">{article.eyebrow}</p>
      <h2><Link href={`/articles/${article.slug}`}>{article.title}</Link></h2>
      <p>{article.description}</p>
      <div className="article-card-meta">
        <time dateTime={article.updatedAt}>Updated {article.updatedAt}</time>
        <span>{article.readingMinutes} min read</span>
      </div>
      <Link className="text-link" href={`/articles/${article.slug}`}>Read guide <ArrowRight aria-hidden="true" weight="bold" /></Link>
    </article>
  );
}

export function ArticlesIndex() {
  return (
    <div className="articles-page shell">
      <header className="articles-hero">
        <p className="eyebrow">PastPaperPrep articles</p>
        <h1>Past paper practice guides</h1>
        <p>Clear methods and honest resource comparisons for Cambridge IGCSE Maths and IB Maths, Chemistry, Physics, and Biology.</p>
      </header>

      <section className="article-grid" aria-label="Revision guides">
        {ARTICLES.map((article) => <ArticleCard article={article} key={article.slug} />)}
      </section>

      <aside className="article-bank-cta" aria-labelledby="article-bank-heading">
        <div>
          <p className="eyebrow">Put it into practice</p>
          <h2 id="article-bank-heading">Build a focused question set</h2>
          <p>Filter real questions by course, topic, year, paper, marks, and other available exam details.</p>
        </div>
        <div>
          <Link href="/#question-banks">Cambridge IGCSE Maths question banks</Link>
          <Link href="/#question-banks">IB Maths and science question banks</Link>
        </div>
      </aside>
    </div>
  );
}

export function ArticleContent({ article }: { article: Article }) {
  return (
    <article className="article-page shell">
      <header className="article-header">
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Articles", href: "/articles" },
          { label: article.title },
        ]} />
        <p className="eyebrow">{article.eyebrow}</p>
        <h1>{article.title}</h1>
        <p className="article-description">{article.description}</p>
        <div className="article-byline">
          <span>By the PastPaperPrep team</span>
          <span>Published <time dateTime={article.publishedAt}>{article.publishedAt}</time></span>
          <span>Updated <time dateTime={article.updatedAt}>{article.updatedAt}</time></span>
          <span>{article.readingMinutes} min read</span>
        </div>
      </header>

      <p className="article-answer">{article.answer}</p>

      <div className="article-body">
        {article.comparison ? (
          <div className="comparison-table-wrap">
            <table className="comparison-table" aria-label={article.comparison.caption}>
              <caption>{article.comparison.caption}</caption>
              <thead><tr>{article.comparison.headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{article.comparison.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.pastPaperPrep}</td>
                  <td>{row.competitor}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}

        {article.sections.map((section) => (
          <section className="article-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </section>
        ))}

        <section className="article-faq" aria-labelledby="article-faq-heading">
          <h2 id="article-faq-heading">Frequently asked questions</h2>
          {article.faqs.map((faq) => (
            <section key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </section>
          ))}
        </section>

        <aside className="article-related" aria-labelledby="article-related-heading">
          <h2 id="article-related-heading">Practise with PastPaperPrep</h2>
          <div>{article.relatedBanks.map((bank) => <Link href={bank.href} key={bank.href}>{bank.label}</Link>)}</div>
        </aside>

        {article.sources?.length ? (
          <section className="article-sources" aria-labelledby="article-sources-heading">
            <h2 id="article-sources-heading">Sources and verification</h2>
            <ul>{article.sources.map((source) => <li key={source.href}><a href={source.href} rel="noreferrer">{source.label}</a></li>)}</ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
