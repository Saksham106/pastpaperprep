import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import type { NoteTopic, NotesSubject } from "@/lib/revision-notes";

const SITE_URL = "https://pastpaperprep.com";

/** Practice and paper links resolved by the page so notes stay plain data. */
export type NotesLinks = { practiceHref: string; papersHref?: string; thresholdsHref?: string };

export function RevisionNotesIndex({ subject, papersHref, thresholdsHref }: { subject: NotesSubject; papersHref?: string; thresholdsHref?: string }) {
  const path = `/revision-notes/${subject.subjectSlug}`;
  return (
    <div className="public-surface">
      <article className="article-page shell">
        <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${subject.name} revision notes`, url: `${SITE_URL}${path}`, hasPart: subject.topics.map((topic) => ({ "@type": "LearningResource", name: topic.title, url: `${SITE_URL}${path}/${topic.slug}` })) }} />
        <header className="article-header">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cambridge IGCSE", href: "/cambridge-igcse" }, { label: `${subject.name} revision notes` }]} />
          <p className="eyebrow">Revision notes</p>
          <h1>{subject.name} revision notes</h1>
          <p className="article-description">Short notes for every syllabus topic, with Extended content marked. Read a topic, then practise it with real past-paper questions.</p>
        </header>
        <div className="article-body">
          <ol className="notes-topic-list">
            {subject.topics.map((topic) => (
              <li key={topic.slug}>
                <Link href={`${path}/${topic.slug}`}><span>{topic.number}</span><strong>{topic.topic}</strong><ArrowRight aria-hidden="true" weight="bold" /></Link>
              </li>
            ))}
          </ol>
          <NotesNextSteps practiceHref={`/banks/${subject.bankSlug}`} papersHref={papersHref} thresholdsHref={thresholdsHref} subjectName={subject.name} />
        </div>
      </article>
    </div>
  );
}

export function RevisionNotesTopic({ subject, topic, links }: { subject: NotesSubject; topic: NoteTopic; links: NotesLinks }) {
  const base = `/revision-notes/${subject.subjectSlug}`;
  const index = subject.topics.findIndex((entry) => entry.slug === topic.slug);
  const previous = subject.topics[index - 1];
  const next = subject.topics[index + 1];
  return (
    <div className="public-surface">
      <article className="article-page shell">
        <JsonLd data={{ "@context": "https://schema.org", "@type": "LearningResource", name: topic.title, description: topic.description, url: `${SITE_URL}${base}/${topic.slug}`, dateModified: subject.updatedAt, educationalLevel: "Cambridge IGCSE", learningResourceType: "Revision notes", author: { "@type": "Organization", name: "PastPaperPrep" } }} />
        <header className="article-header">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: `${subject.name} notes`, href: base }, { label: topic.topic }]} />
          <p className="eyebrow">{subject.name} · Topic {topic.number}</p>
          <h1>{topic.topic}</h1>
          <div className="article-byline"><span>By the PastPaperPrep team</span><span>Updated <time dateTime={subject.updatedAt}>{subject.updatedAt}</time></span></div>
        </header>

        <p className="article-answer">{topic.summary}</p>

        <div className="article-body">
          {topic.sections.map((section) => (
            <section className="article-section" key={section.heading}>
              <h2>{section.heading}{section.extended ? <span className="notes-extended">Extended</span> : null}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.points?.length ? <ul>{section.points.map((point) => <li key={point}><NotePoint point={point} /></li>)}</ul> : null}
            </section>
          ))}

          <section className="article-section">
            <h2>Exam tips</h2>
            <ul>{topic.examTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </section>
          <section className="article-section">
            <h2>Common mistakes</h2>
            <ul>{topic.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
          </section>

          <NotesNextSteps practiceHref={links.practiceHref} papersHref={links.papersHref} thresholdsHref={links.thresholdsHref} subjectName={subject.name} topic={topic.topic} />

          <nav className="notes-pager" aria-label="More topics">
            {previous ? <Link href={`${base}/${previous.slug}`}>← {previous.topic}</Link> : <span />}
            {next ? <Link href={`${base}/${next.slug}`}>{next.topic} →</Link> : <Link href={base}>All topics</Link>}
          </nav>
        </div>
      </article>
    </div>
  );
}

/** Writers mark single Extended points with an "(Extended)" prefix; show it as the same badge as a section. */
function NotePoint({ point }: { point: string }) {
  const extended = point.startsWith("(Extended) ");
  return extended ? <><span className="notes-extended notes-extended-inline">Extended</span>{point.slice("(Extended) ".length)}</> : <>{point}</>;
}

function NotesNextSteps({ practiceHref, papersHref, thresholdsHref, subjectName, topic }: NotesLinks & { subjectName: string; topic?: string }) {
  return (
    <aside className="article-related" aria-labelledby="notes-practice-heading">
      <h2 id="notes-practice-heading">Now practise it</h2>
      <div>
        <Link href={practiceHref}>{topic ? `${topic} past-paper questions` : `${subjectName} questions by topic`}</Link>
        {papersHref ? <Link href={papersHref}>Free {subjectName} past papers</Link> : null}
        {thresholdsHref ? <Link href={thresholdsHref}>{subjectName} grade thresholds</Link> : null}
      </div>
    </aside>
  );
}
