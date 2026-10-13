import type { Metadata } from 'next';
import type { CatalogBank } from './catalog';
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from './seo';
import { paperName, paperSearchCodes, sessionRank, shortSession, slashCode, subjectSlugForBank, type PastPaperQualification } from './past-paper-catalog';
import type { WholePaperSummary } from './whole-paper-types';

/** Copy and structured data for the free past-paper pages. Every fact comes from the papers passed in. */
export const SITE_URL = 'https://pastpaperprep.com';
/** Last change to the past-paper page templates or copy; the sitemap's lastmod for every library page.
 * Bump it with any change to what these pages say, so search engines re-crawl them. */
export const PAST_PAPER_PAGES_UPDATED = '2026-10-13';
/** Titles longer than this drop the " | PastPaperPrep" suffix, so search results show the whole title. */
const TITLE_LIMIT = 60;
export type PageCopy = { title: string; description: string; h1: string; answer: string };
export type FaqItem = { q: string; a: string };

const isIb = (bank: CatalogBank) => bank.qualification === 'IB Diploma';
/** IB Mathematics: Analysis and Approaches was first examined in May 2021; earlier papers in the AA
 * banks are the previous Mathematics HL/SL course, so name them that way on paper pages. */
const FIRST_AA_YEAR = 2021;
const legacyMaths = (bank: CatalogBank, p: WholePaperSummary) => (bank.slug === 'ib-hl' || bank.slug === 'ib-sl') && p.year < FIRST_AA_YEAR;
const paperSubjectName = (bank: CatalogBank, p: WholePaperSummary) => legacyMaths(bank, p) ? `IB Math ${bank.level}` : subjectSearchName(bank);
export const paperCourseTitle = (bank: CatalogBank, p: WholePaperSummary) => legacyMaths(bank, p) ? `IB Mathematics ${bank.level === 'HL' ? 'Higher' : 'Standard'} Level` : bank.title;
/** The first wording that fits a search result in full; the most descriptive comes first. */
export const fitTitle = (...candidates: string[]) => candidates.find(c => c.length <= TITLE_LIMIT) ?? candidates.at(-1)!;
/** Same for descriptions, which search results cut at about 160 characters. */
const fitDescription = (...candidates: string[]) => candidates.find(c => c.length <= 160) ?? candidates.at(-1)!;
const shortIbSession = (session: string) => session === 'November' ? 'Nov' : session;
/** The name students type: "IGCSE Maths 0580", "IB Math AA HL", "IB Chemistry SL". */
export function subjectSearchName(bank: CatalogBank): string {
  if (!isIb(bank)) return `IGCSE ${bank.subject.replace('Mathematics', 'Maths')} ${bank.syllabusCode}`;
  return bank.subject.startsWith('Mathematics ') ? `IB Math ${bank.subject.replace('Mathematics ', '')} ${bank.level}` : `IB ${bank.subject} ${bank.level}`;
}
const fullName = (bank: CatalogBank) => isIb(bank) ? bank.title : `Cambridge IGCSE ${bank.subject} (${bank.syllabusCode})`;
const scheme = (bank: CatalogBank) => isIb(bank) ? 'markscheme' : 'mark scheme';
const years = (papers: readonly WholePaperSummary[]) => papers.map(p => p.year);
export function yearRange(papers: readonly WholePaperSummary[]): string {
  const min = Math.min(...years(papers)), max = Math.max(...years(papers));
  return min === max ? String(min) : `${min}–${max}`;
}
const fromYears = (papers: readonly WholePaperSummary[]) => {
  const min = Math.min(...years(papers)), max = Math.max(...years(papers));
  return min === max ? `from ${min}` : `from ${min} to ${max}`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const list = (items: readonly string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const papersPhrase = (numbers: readonly string[]) => `${numbers.length === 1 ? 'Paper' : 'Papers'} ${list(numbers)}`;
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h && plural(h, 'hour'), m && plural(m, 'minute')].filter(Boolean).join(' ');
}

const HUB: Record<'all' | PastPaperQualification, Pick<PageCopy, 'title' | 'h1'>> = {
  all: { title: 'Free IGCSE & IB Past Papers with Mark Schemes', h1: 'Free IGCSE & IB past papers' },
  igcse: { title: 'Cambridge IGCSE Past Papers with Mark Schemes', h1: 'Cambridge IGCSE past papers' },
  ib: { title: 'IB Past Papers with Markschemes', h1: 'IB past papers' },
};
export function hubCopy(paperCount: number, qualification?: PastPaperQualification): PageCopy {
  const scope = qualification === 'igcse' ? 'Cambridge IGCSE' : qualification === 'ib' ? 'IB Diploma' : 'Cambridge IGCSE and IB';
  return { ...HUB[qualification ?? 'all'], description: `${paperCount.toLocaleString('en-US')} ${scope} past papers with mark schemes. Time them, mark them and see which topics to fix. Free, no sign-up.`, answer: 'Every paper with its mark scheme. Time it, mark it, see what to fix.' };
}

/** Board-level questions for the IGCSE and IB hubs; every claim is general and true for the whole board. */
export function hubFaq(qualification: PastPaperQualification): FaqItem[] {
  if (qualification === 'igcse') return [
    { q: 'Are these Cambridge IGCSE past papers free?', a: 'Yes. Every question paper and its mark scheme opens free, with no sign-up. Most papers can also be timed and self-marked here.' },
    { q: 'What does a code like 0580/42/M/J/24 mean?', a: '0580 is the syllabus (Mathematics), 42 is Paper 4 variant 2, M/J is the May/June series and 24 is 2024. F/M is February/March and O/N is October/November.' },
    { q: 'What do file names like 0580_s24_qp_42 mean?', a: 'They are Cambridge\'s own file names: s is May/June (summer), w is October/November (winter) and m is February/March, followed by the year. qp is the question paper and ms is the mark scheme; the last number is the paper and variant.' },
    { q: 'Which variant should I practise?', a: 'Any of them. Variants such as 41, 42 and 43 are separate papers set for different time zones, at the same level and each with its own mark scheme, so each one is extra practice.' },
    { q: 'What is the difference between Core and Extended?', a: 'In subjects with two tiers, Core covers the main syllabus and Extended adds harder content for the top grades, and each tier sits its own papers, with some (such as practical papers) shared. Every subject page shows which papers each tier takes.' },
    { q: 'Can I practise past-paper questions by topic instead?', a: 'Yes. The question banks sort real past-paper questions by syllabus topic, so you can drill one topic across many years.' },
  ];
  return [
    { q: 'Are these IB past papers free?', a: 'Yes. Every paper and its markscheme opens free, with no sign-up. Most papers can also be timed and self-marked here.' },
    { q: 'What do TZ1 and TZ2 mean on IB papers?', a: 'IB sets different papers for different time zones in the same session. TZ1 and TZ2 are separate papers at the same level, each with its own markscheme, so both are useful practice. TZ0 means one paper for every time zone.' },
    { q: 'When are IB exams sat?', a: 'IB Diploma exams run in two sessions: May, sat by most schools, and November, sat mainly by schools in the southern hemisphere. Papers from both are here.' },
    { q: 'Do HL and SL take the same papers?', a: 'Mostly not. Most subjects set separate Higher Level and Standard Level papers, each with its own markscheme, but some papers are sat by both levels, such as recent Economics Paper 2. Pick the subject page for your level; shared papers appear on both.' },
    { q: 'Why is it spelled markscheme?', a: 'That is the IB\'s own spelling; it means the same as a mark scheme.' },
    { q: 'Can I practise past-paper questions by topic instead?', a: 'Yes. The question banks sort real past-paper questions by syllabus topic, so you can drill one topic across many years.' },
  ];
}

export function subjectCopy(bank: CatalogBank, papers: readonly WholePaperSummary[]): PageCopy {
  const name = subjectSearchName(bank), n = papers.length;
  return {
    title: fitTitle(`${name} Past Papers & Mark Schemes (${yearRange(papers)})`, `${name} Past Papers & Mark Schemes`, `${name} Past Papers`),
    h1: `${name} past papers`,
    description: `Every ${name} past paper from ${yearRange(papers)} with its ${scheme(bank)}.${papers.some(p => p.reportAvailable) ? ' Time it, mark it and see which topics to fix.' : ''} Free, no sign-up.`,
    answer: `${n} ${fullName(bank)} past ${n === 1 ? 'paper' : 'papers'} ${fromYears(papers)}, ${n === 1 ? 'with its' : 'each with its'} ${scheme(bank)}. Free, no sign-up.`,
  };
}

export function yearCopy(bank: CatalogBank, year: number, papers: readonly WholePaperSummary[]): PageCopy {
  const name = subjectSearchName(bank), n = papers.length;
  const sessions = list([...new Set(papers.map(p => p.session))].sort((a, b) => sessionRank(a) - sessionRank(b)));
  return {
    title: fitTitle(`${name} Past Papers ${year} & Mark Schemes`, `${name} Past Papers ${year}`),
    h1: `${name} past papers ${year}`,
    description: `${name} past papers from ${year}: ${sessions}, with ${scheme(bank)}s. Free, no sign-up.`,
    answer: `${n} ${fullName(bank)} past ${n === 1 ? 'paper' : 'papers'} from ${year}: ${sessions}, ${n === 1 ? 'with its' : 'each with its'} ${scheme(bank)}.`,
  };
}

export function paperNumberCopy(bank: CatalogBank, paper: string, papers: readonly WholePaperSummary[]): PageCopy {
  const name = subjectSearchName(bank), label = paper.toUpperCase();
  const routes = new Set(papers.map(p => p.route));
  const only = routes.size === 1 ? [...routes][0] : null;
  const note = only === 'Core' || only === 'Extended' ? ` (${only})` : '';
  return {
    title: fitTitle(`${name} Paper ${label} Past Papers${note}`, `${name} Paper ${label} Past Papers`),
    h1: `${name} Paper ${label} past papers`,
    description: `Every ${name} Paper ${label} from ${yearRange(papers)} with its ${scheme(bank)}. Free, no sign-up.`,
    answer: `Every ${name} Paper ${label} ${fromYears(papers)}: ${plural(papers.length, 'paper')}, each with its ${scheme(bank)}.`,
  };
}

/** Only mention the timer and self-marking when this paper actually has them. */
function paperTail(p: WholePaperSummary): string {
  if (p.reportAvailable) return p.durationMinutes !== null ? ' Time it, mark it and see which topics to fix.' : ' Mark it and see which topics to fix.';
  return p.durationMinutes !== null ? ' Time yourself with the real exam duration.' : '';
}

export function paperCopy(bank: CatalogBank, p: WholePaperSummary): PageCopy {
  const name = paperSubjectName(bank, p), label = paperName(p);
  const facts = [p.durationMinutes !== null && formatDuration(p.durationMinutes), p.maxMarks !== null && plural(p.maxMarks, 'mark')].filter(Boolean).join(', ');
  if (isIb(bank)) return {
    title: fitTitle(`${name} ${p.session} ${p.year} ${label}: Paper & Markscheme`, `${name} ${shortIbSession(p.session)} ${p.year} ${label}: Paper & Markscheme`, `${name} ${shortIbSession(p.session)} ${p.year} ${label} & Markscheme`, `${name} ${shortIbSession(p.session)} ${p.year} ${label}`),
    h1: `${name} ${p.session} ${p.year} ${label}`,
    description: `${paperCourseTitle(bank, p)} ${label}, ${p.session} ${p.year}, with its markscheme.${facts ? ` ${facts}.` : ''}${paperTail(p)}`,
    answer: `${paperCourseTitle(bank, p)} ${label} from ${p.session} ${p.year}, with its markscheme.`,
  };
  const subject = name.replace(` ${bank.syllabusCode}`, '');
  const code = slashCode(p);
  return {
    title: fitTitle(
      `${p.syllabusCode}/${p.component} ${p.session} ${p.year}: ${subject} Paper ${p.paper.toUpperCase()} & Mark Scheme`,
      `${p.syllabusCode}/${p.component} ${shortSession(p.session)} ${p.year}: ${subject} Paper ${p.paper.toUpperCase()} & Mark Scheme`,
      `${p.syllabusCode}/${p.component} ${shortSession(p.session)} ${p.year}: ${subject.replace('IGCSE ', '')} Paper ${p.paper.toUpperCase()} & Mark Scheme`,
      `${p.syllabusCode}/${p.component} ${shortSession(p.session)} ${p.year}: ${subject} Paper ${p.paper.toUpperCase()}`,
    ),
    h1: `${subject} ${p.syllabusCode}/${p.component} ${p.session} ${p.year}`,
    description: fitDescription(
      `${code ? `${code}: ` : ''}${subject} ${p.syllabusCode} Paper ${p.component}, ${p.session} ${p.year}, with its mark scheme.${facts ? ` ${facts}.` : ''}${paperTail(p)}`,
      `${code ? `${code}: ` : ''}${subject} ${p.syllabusCode} Paper ${p.component}, ${shortSession(p.session)} ${p.year}, with its mark scheme.${facts ? ` ${facts}.` : ''}${paperTail(p)}`,
      `${code ? `${code}: ` : ''}${subject} ${p.syllabusCode} Paper ${p.component}, ${shortSession(p.session)} ${p.year}, with its mark scheme.${facts ? ` ${facts}.` : ''}`,
    ),
    answer: `Cambridge IGCSE ${bank.subject} ${bank.syllabusCode} ${label} from ${p.session} ${p.year}, with its mark scheme.`,
  };
}

/** Every code and name this paper is searched by (see paperSearchCodes). */
export const paperCodes = (bank: CatalogBank, p: WholePaperSummary) => paperSearchCodes(p, paperSubjectName(bank, p));

function routeAnswer(papers: readonly WholePaperSummary[]): string | null {
  const numbers = (route: WholePaperSummary['route']) => [...new Set(papers.filter(p => p.route === route).map(p => p.paper.toUpperCase()))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
  const core = numbers('Core'), extended = numbers('Extended'), shared = numbers('Shared');
  if (!core.length || !extended.length) return null;
  const sharedLine = shared.length ? ` ${papersPhrase(shared)} ${shared.length === 1 ? 'is' : 'are'} taken by both.` : '';
  return `Core students take ${papersPhrase(core)}. Extended students take ${papersPhrase(extended)}.${sharedLine}`;
}

export function subjectFaq(bank: CatalogBank, papers: readonly WholePaperSummary[]): FaqItem[] {
  const code = isIb(bank) ? subjectSearchName(bank) : bank.syllabusCode;
  const faq: FaqItem[] = [{ q: `Where can I find ${code} past papers with ${scheme(bank)}s?`, a: `Here: ${subjectCopy(bank, papers).answer.replace(' Free, no sign-up.', '')} Open any paper free, with no sign-up.` }];
  const example = papers.find(p => /^\d\d$/.test(p.component));
  if (!isIb(bank) && example) faq.push({ q: `What do the ${code} paper numbers mean?`, a: `The first digit is the paper and the second is the variant: ${example.component} is Paper ${example.component[0]}, variant ${example.component[1]}. Each variant is a separate paper set for different time zones, with its own mark scheme.` });
  if (isIb(bank) && papers.some(p => /^tz[1-9]$/i.test(p.variant))) faq.push({ q: 'What do TZ1 and TZ2 mean on IB papers?', a: 'IB sets separate papers for different time zones. Each has its own markscheme.' });
  const routes = routeAnswer(papers);
  if (routes) faq.push({ q: `Which ${code} papers do Core and Extended students take?`, a: routes });
  if (papers.some(p => p.reportAvailable)) faq.push({ q: 'How do I mark a past paper here?', a: 'Open a paper, switch to the mark scheme, then tap Mark this paper and enter your marks for each question. Your marks stay on this device.' });
  return faq;
}

const absolute = (path: string) => `${SITE_URL}${path}`;
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(item.path) })) };
}
export function collectionJsonLd(copy: PageCopy, path: string, items: { name: string; path: string }[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: copy.title, description: copy.description, url: absolute(path), mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, url: absolute(item.path) })) } };
}
export function faqJsonLd(faq: FaqItem[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}
export function paperJsonLd(bank: CatalogBank, p: WholePaperSummary, path: string): Record<string, unknown> {
  const copy = paperCopy(bank, p);
  const time = p.durationMinutes === null ? null : `PT${Math.floor(p.durationMinutes / 60) ? `${Math.floor(p.durationMinutes / 60)}H` : ''}${p.durationMinutes % 60 ? `${p.durationMinutes % 60}M` : ''}`;
  return {
    '@context': 'https://schema.org', '@type': 'LearningResource', name: copy.title, alternateName: paperCodes(bank, p), description: copy.description, url: absolute(path),
    learningResourceType: 'Past exam paper', educationalLevel: isIb(bank) ? 'IB Diploma Programme' : 'Cambridge IGCSE', about: paperSubjectName(bank, p),
    inLanguage: 'en', isAccessibleForFree: true, ...(time ? { timeRequired: time } : {}),
    isPartOf: { '@type': 'CollectionPage', url: absolute(`/past-papers/${subjectSlugForBank(bank.slug)}`) },
  };
}

/** The layout adds " | PastPaperPrep"; skip it when the full title would run past what search results show. */
export function pageTitle(title: string): string | { absolute: string } {
  return `${title} | PastPaperPrep`.length > TITLE_LIMIT ? { absolute: title } : title;
}

/** Page metadata with the layout's full social card. A page-level openGraph replaces the layout's object, so rebuild it. */
export function pastPaperMetadata(copy: Pick<PageCopy, 'title' | 'description'>, path: string): Metadata {
  return {
    title: pageTitle(copy.title),
    description: copy.description,
    alternates: { canonical: path },
    openGraph: { siteName: 'PastPaperPrep', type: 'website', locale: 'en_US', url: path, title: copy.title, description: copy.description, images: [SOCIAL_IMAGE] },
    twitter: { card: 'summary_large_image', title: copy.title, description: copy.description, images: [SOCIAL_IMAGE_URL] },
  };
}
