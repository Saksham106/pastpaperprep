import type { CatalogBank } from './catalog';
import { paperName, sessionRank, subjectSlugForBank, type PastPaperQualification } from './past-paper-catalog';
import type { WholePaperSummary } from './whole-paper-types';

/** Copy and structured data for the free past-paper pages. Every fact comes from the papers passed in. */
export const SITE_URL = 'https://pastpaperprep.com';
export type PageCopy = { title: string; description: string; h1: string; answer: string };
export type FaqItem = { q: string; a: string };

const isIb = (bank: CatalogBank) => bank.qualification === 'IB Diploma';
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

export function subjectCopy(bank: CatalogBank, papers: readonly WholePaperSummary[]): PageCopy {
  const name = subjectSearchName(bank), n = papers.length;
  return {
    title: `${name} Past Papers & Mark Schemes (${yearRange(papers)})`,
    h1: `${name} past papers`,
    description: `Every ${name} past paper from ${yearRange(papers)} with its ${scheme(bank)}. Time it, mark it and see which topics to fix. Free, no sign-up.`,
    answer: `${n} ${fullName(bank)} past ${n === 1 ? 'paper' : 'papers'} ${fromYears(papers)}, ${n === 1 ? 'with its' : 'each with its'} ${scheme(bank)}. Free, no sign-up.`,
  };
}

export function yearCopy(bank: CatalogBank, year: number, papers: readonly WholePaperSummary[]): PageCopy {
  const name = subjectSearchName(bank), n = papers.length;
  const sessions = list([...new Set(papers.map(p => p.session))].sort((a, b) => sessionRank(a) - sessionRank(b)));
  return {
    title: `${name} Past Papers ${year}: All Sessions & Mark Schemes`,
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
    title: `${name} Paper ${label} Past Papers${note}, All Years`,
    h1: `${name} Paper ${label} past papers`,
    description: `Every ${name} Paper ${label} from ${yearRange(papers)} with its ${scheme(bank)}. Free, no sign-up.`,
    answer: `Every ${name} Paper ${label} ${fromYears(papers)}: ${plural(papers.length, 'paper')}, each with its ${scheme(bank)}.`,
  };
}

export function paperCopy(bank: CatalogBank, p: WholePaperSummary): PageCopy {
  const name = subjectSearchName(bank), label = paperName(p);
  const facts = [p.durationMinutes !== null && formatDuration(p.durationMinutes), p.maxMarks !== null && plural(p.maxMarks, 'mark')].filter(Boolean).join(', ');
  const who = isIb(bank) ? bank.title : `Cambridge IGCSE ${bank.subject} ${bank.syllabusCode}`;
  return {
    title: isIb(bank) ? `${name} ${p.session} ${p.year} ${label}: Paper & Markscheme` : `${p.syllabusCode}/${p.component} ${p.session} ${p.year}: ${name.replace(` ${bank.syllabusCode}`, '')} Paper ${p.paper.toUpperCase()} & Mark Scheme`,
    h1: `${p.session} ${p.year} ${label}`,
    description: `${who} ${label}, ${p.session} ${p.year}, with its ${scheme(bank)}.${facts ? ` ${facts}.` : ''} Time it, mark it and see which topics to fix.`,
    answer: `${who} ${label} from ${p.session} ${p.year}, with its ${scheme(bank)}.`,
  };
}

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
  if (!isIb(bank) && example) faq.push({ q: `What do the ${code} paper numbers mean?`, a: `The first digit is the paper and the second is the variant: ${example.component} is Paper ${example.component[0]}, variant ${example.component[1]}. Variants are set for different time zones and are equally hard.` });
  if (isIb(bank) && papers.some(p => /^tz[1-9]$/i.test(p.variant))) faq.push({ q: 'What do TZ1 and TZ2 mean on IB papers?', a: 'IB sets different papers for different time zones. They cover the same syllabus and are marked the same way.' });
  const routes = routeAnswer(papers);
  if (routes) faq.push({ q: `Which ${code} papers do Core and Extended students take?`, a: routes });
  faq.push({ q: 'How do I mark a past paper here?', a: 'Open a paper, switch to the mark scheme, then tap Mark this paper and enter your marks for each question. Your marks stay on this device.' });
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
    '@context': 'https://schema.org', '@type': 'LearningResource', name: copy.title, description: copy.description, url: absolute(path),
    learningResourceType: 'Past exam paper', educationalLevel: isIb(bank) ? 'IB Diploma Programme' : 'Cambridge IGCSE', about: subjectSearchName(bank),
    inLanguage: 'en', isAccessibleForFree: true, ...(time ? { timeRequired: time } : {}),
    isPartOf: { '@type': 'CollectionPage', url: absolute(`/past-papers/${subjectSlugForBank(bank.slug)}`) },
  };
}
