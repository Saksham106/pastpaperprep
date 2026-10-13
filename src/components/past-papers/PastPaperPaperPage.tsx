import Link from 'next/link';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { courseToneForBank } from '@/components/CourseIcon';
import { JsonLd } from '@/components/JsonLd';
import type { PaperReaderConfig } from '@/lib/paper-reader-config';
import { chipLabel, fileAliases, paperHref, paperName, paperNumberSlug, paperOption, qualificationOfBank, sessionRank, shortSession, subjectSlugForBank } from '@/lib/past-paper-catalog';
import type { PaperView } from '@/lib/past-paper-pages';
import { breadcrumbJsonLd, formatDuration, paperCopy, paperJsonLd, subjectSearchName } from '@/lib/past-paper-seo';
import type { WholePaperSummary } from '@/lib/whole-paper-types';
import { PaperWorkspace } from './PaperWorkspace';
import shell from './PastPaperPages.module.css';
import styles from './PastPaperPaperPage.module.css';

const QUALIFICATION = { igcse: { name: 'Cambridge IGCSE', path: '/past-papers/igcse' }, ib: { name: 'IB', path: '/past-papers/ib' } } as const;
const sessionKey = (p: WholePaperSummary) => p.year * 10 + sessionRank(p.session);
/** Short chip text: "42" for IGCSE, "P2 TZ1" for IB. */
const shortName = (p: WholePaperSummary) => p.qualification === 'Cambridge IGCSE' ? p.component : paperName(p).replace('Paper ', 'P');

/** The same paper number in the nearest earlier or later session, preferring the same variant. */
function neighbour(all: readonly WholePaperSummary[], p: WholePaperSummary, direction: 1 | -1): WholePaperSummary | undefined {
  const candidates = all.filter(o => o.paper === p.paper && paperOption(o) === paperOption(p) && Math.sign(sessionKey(o) - sessionKey(p)) === direction);
  if (!candidates.length) return undefined;
  const nearest = direction === 1 ? Math.min(...candidates.map(sessionKey)) : Math.max(...candidates.map(sessionKey));
  const session = candidates.filter(o => sessionKey(o) === nearest);
  return session.find(o => o.variant === p.variant) ?? session.sort((a, b) => chipLabel(a).localeCompare(chipLabel(b), undefined, { numeric: true }))[0];
}

function ChipRow({ label, papers, current, text }: { label: string; papers: WholePaperSummary[]; current?: string; text: (p: WholePaperSummary) => string }) {
  return <nav aria-label={label} className={styles.chipRow}><h3>{label}</h3><div className={styles.pill}>{papers.map(p => <Link key={p.id} href={paperHref(p)} aria-current={p.id === current ? 'page' : undefined}>{text(p)}</Link>)}</div></nav>;
}

export function PastPaperPaperPage({ view }: { view: PaperView }) {
  const { bank, detail, all, practice } = view;
  const p = detail.summary;
  const subject = subjectSlugForBank(bank.slug);
  const name = subjectSearchName(bank);
  const copy = paperCopy(bank, p);
  const path = paperHref(p);
  const qualification = QUALIFICATION[qualificationOfBank(bank.slug)];
  const label = paperName(p);
  const crumbs = [{ name: 'Past papers', path: '/past-papers' }, qualification, { name, path: `/past-papers/${subject}` }, { name: String(p.year), path: `/past-papers/${subject}/${p.year}` }, { name: label, path }];
  const sameSitting = all.filter(o => o.year === p.year && o.session === p.session);
  const variants = sameSitting.filter(o => o.paper === p.paper).sort((a, b) => chipLabel(a).localeCompare(chipLabel(b), undefined, { numeric: true }));
  // Suggest the student's own route: a Core paper lists Core and shared papers, an Extended paper Extended and shared.
  const otherRoute = p.route === 'Core' ? 'Extended' : p.route === 'Extended' ? 'Core' : null;
  const session = sameSitting.filter(o => o.paper !== p.paper && (!otherRoute || o.route !== otherRoute)).sort((a, b) => a.component.localeCompare(b.component, undefined, { numeric: true }) || a.variant.localeCompare(b.variant));
  const previous = neighbour(all, p, -1), next = neighbour(all, p, 1);
  const tz = /^tz[1-9]$/i.test(p.variant) ? p.variant.toUpperCase() : null;
  const facts = [p.route === 'Core' || p.route === 'Extended' ? p.route : null, p.durationMinutes !== null ? formatDuration(p.durationMinutes) : null, p.maxMarks !== null ? `${p.maxMarks} marks` : null, p.qualification === 'Cambridge IGCSE' && /^\d$/.test(p.variant) ? `Variant ${p.variant}` : tz].filter((fact): fact is string => !!fact);
  const aliases = fileAliases(p);
  const reader: PaperReaderConfig = { id: p.id, title: `${name} · ${copy.h1}`, subject: p.subject, syllabusCode: p.syllabusCode, qualification: p.qualification, sessionLabel: `${p.session} ${p.year}`, component: p.paper, paperName: label, variant: p.variant, durationMinutes: p.durationMinutes, maxMarks: p.maxMarks, sources: detail.sources, bankSlug: bank.slug, reportAvailable: p.reportAvailable };
  const marking = p.reportAvailable && p.maxMarks !== null ? { id: p.id, version: detail.version, bankSlug: bank.slug, title: copy.h1, maxMarks: p.maxMarks, questions: detail.questions } : null;
  const paperNumber = p.paper.toUpperCase();
  return <article className={`${shell.page} ${styles.page}`} data-subject-tone={courseToneForBank(bank)}>
    <JsonLd data={breadcrumbJsonLd(crumbs)} />
    <JsonLd data={paperJsonLd(bank, p, path)} />
    <nav aria-label="Breadcrumb" className={shell.crumbs}>
      <Link href="/past-papers">Past papers</Link><span aria-hidden="true">/</span>
      <Link href={qualification.path}>{qualification.name}</Link><span aria-hidden="true">/</span>
      <Link href={`/past-papers/${subject}`}>{name}</Link><span aria-hidden="true">/</span>
      <Link href={`/past-papers/${subject}/${p.year}`}>{p.year}</Link><span aria-hidden="true">/</span>
      <span>{label}</span>
    </nav>
    <header className={styles.head}>
      <p className={styles.eyebrow}>{p.qualification === 'Cambridge IGCSE' ? `${name} · ${p.syllabusCode}/${p.component}` : name}</p>
      <h1>{copy.h1}</h1>
      <ul className={styles.facts} aria-label="Paper facts">{facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
    </header>
    <PaperWorkspace reader={reader} marking={marking} bank={bank.slug} practice={practice}>
      <section className={styles.box} aria-label="Related papers">
        {variants.length > 1 && <ChipRow label="Other variants" papers={variants} current={p.id} text={chipLabel} />}
        {session.length > 0 && <ChipRow label="Same session" papers={session} text={shortName} />}
        {(previous || next) && <nav aria-label={`Paper ${paperNumber} in other sessions`} className={styles.neighbours}>
          <h3>Paper {paperNumber} · other sessions</h3>
          <div>{previous ? <Link href={paperHref(previous)}><small><ArrowLeft aria-hidden="true" /> Previous · {shortSession(previous.session)} {previous.year}</small><b>{paperName(previous)}</b></Link> : <span />}
            {next ? <Link href={paperHref(next)}><small>Next · {shortSession(next.session)} {next.year} <ArrowRight aria-hidden="true" /></small><b>{paperName(next)}</b></Link> : <span />}</div>
        </nav>}
        <div className={styles.more}><Link href={`/past-papers/${subject}/${p.year}`}>All {p.year} papers</Link><Link href={`/past-papers/${subject}/${paperNumberSlug(p.paper)}`}>Every Paper {paperNumber}</Link></div>
      </section>
      {practice && <Link className={styles.practice} href={`/banks/${bank.slug}?paper=${encodeURIComponent(String(parseInt(p.paper, 10)))}`}>Practise Paper {paperNumber} questions by topic <ArrowRight aria-hidden="true" weight="bold" /></Link>}
    </PaperWorkspace>
    {detail.questions.length > 0 && <section className={styles.questions} aria-labelledby="paper-questions">
      <h2 id="paper-questions">What&apos;s in this paper</h2>
      <p>{detail.questions.length} questions{p.maxMarks !== null && ` · ${p.maxMarks} marks`}. Topics come from our question bank.</p>
      <ol aria-label="Questions in this paper">{detail.questions.map(q => <li key={q.id}><b>Q{q.number}</b><span>{q.topics.join(', ')}</span><em>{q.maxMarks} {q.maxMarks === 1 ? 'mark' : 'marks'}</em></li>)}</ol>
    </section>}
    {aliases && <p className={styles.aliases}><span>Cambridge file names</span>{aliases.question} · {aliases.markscheme}</p>}
  </article>;
}
