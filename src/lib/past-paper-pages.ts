import 'server-only';
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, type BankSlug, type CatalogBank } from './catalog';
import { courseToneForBank, type CourseTone } from '@/components/CourseIcon';
import { bankForSubjectSlug, closestPaperEntry, paperNumberSlug, paperSlug, qualificationOfBank, subjectSlugForBank, type PastPaperQualification } from './past-paper-catalog';
import { subjectSearchName, yearRange } from './past-paper-seo';
import { findWholePaperBySlug, getWholePaperSummaries, wholePaperArchiveEnabled } from './whole-paper-archive';
import type { WholePaperDetail, WholePaperSummary } from './whole-paper-types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_BANK_INDEX_FILES } from './bank-index-manifest';
import { archiveQuestions, archivePaperKey, questionPaperKey, type PaperQuestion } from './paper-question-links';
import type { Explanation } from './explanation-format';
import { freeExplanations } from './free-explanations';
import { paperIndexing, type PaperIndexing } from './past-paper-indexing';
import { demandPage, previewExplanations } from './paper-previews';
import { completeInventory } from './past-paper-insights';
import reprintAliases from '@/data/reprint-question-aliases.json';

/** Resolves public /past-papers URLs for pages, static params and the sitemap.
 * Everything is empty while the archive gate is closed, so no page is built or linked. */
export type HubBank = { bankSlug: BankSlug; subjectSlug: string; name: string; qualification: PastPaperQualification; paperCount: number; years: string; tone: CourseTone };
/** `practice` is false for banks whose /banks page isn't published yet, so no link points at a 404. */
/** `latestSets`: the latest year's complete question lists, for the subject page's topic summary (subject route only). */
export type SubjectView = { kind: 'subject'; bank: CatalogBank; papers: WholePaperSummary[]; practice: boolean; latestSets?: PaperQuestion[][] };
/** `questionSets`: each listed paper's questions when complete (else empty), for the year's topic table. */
export type YearView = { kind: 'year'; bank: CatalogBank; year: number; papers: WholePaperSummary[]; all: WholePaperSummary[]; practice: boolean; questionSets?: PaperQuestion[][] };
/** `questionSets` holds each listed paper's questions when they are the whole paper (else empty), for the topic table. */
export type PaperNumberView = { kind: 'paperNumber'; bank: CatalogBank; paper: string; papers: WholePaperSummary[]; all: WholePaperSummary[]; practice: boolean; questionSets?: PaperQuestion[][] };
/** A free-year question with its worked explanation, printed in the page. */
export type WorkedAnswer = { number: number; marks: number | null; topics: readonly string[]; explanation: Explanation };
/** `complete`: `questions` is the whole paper (completeInventory), so whole-paper shares can be stated. */
/** `preview`: the worked answers are a free preview of a paid paper (demand-listed), not a free year's full set. */
export type PaperView = { kind: 'paper'; bank: CatalogBank; detail: WholePaperDetail; all: WholePaperSummary[]; practice: boolean; questions?: PaperQuestion[]; complete?: boolean; workedAnswers?: WorkedAnswer[]; preview?: boolean; indexing?: PaperIndexing };
export type ListView = SubjectView | YearView | PaperNumberView;

async function availableBanks(): Promise<{ bank: CatalogBank; papers: WholePaperSummary[] }[]> {
  if (!await wholePaperArchiveEnabled()) return [];
  return BANK_CATALOG.map(bank => ({ bank, papers: getWholePaperSummaries(bank.slug) })).filter(entry => entry.papers.length > 0);
}

export async function hubBanks(qualification?: PastPaperQualification): Promise<HubBank[]> {
  return (await availableBanks())
    .filter(({ bank }) => !qualification || qualificationOfBank(bank.slug) === qualification)
    .map(({ bank, papers }) => ({ bankSlug: bank.slug, subjectSlug: subjectSlugForBank(bank.slug), name: subjectSearchName(bank), qualification: qualificationOfBank(bank.slug), paperCount: papers.length, years: yearRange(papers), tone: courseToneForBank(bank) }));
}

export async function resolveSubject(slug: string): Promise<SubjectView | null> {
  const bankSlug = bankForSubjectSlug(slug);
  const bank = bankSlug ? getCatalogBank(bankSlug) : undefined;
  if (!bank || !await wholePaperArchiveEnabled()) return null;
  const papers = getWholePaperSummaries(bank.slug);
  return papers.length ? { kind: 'subject', bank, papers, practice: getCatalogBanksForDisplay().some(b => b.slug === bank.slug) } : null;
}

export async function resolveEntry(slug: string, entry: string): Promise<YearView | PaperNumberView | PaperView | null> {
  const subject = await resolveSubject(slug);
  if (!subject) return null;
  const { bank, papers: all, practice } = subject;
  if (/^\d{4}$/.test(entry)) {
    const papers = all.filter(p => p.year === Number(entry));
    return papers.length ? { kind: 'year', bank, year: Number(entry), papers, all, practice, questionSets: completeQuestionSets(bank.slug, papers) } : null;
  }
  const number = /^paper-([0-9a-z]+)$/.exec(entry)?.[1];
  if (number) {
    const papers = all.filter(p => p.paper.toLowerCase() === number);
    if (!papers.length) return null;
    return { kind: 'paperNumber', bank, paper: papers[0].paper, papers, all, practice, questionSets: completeQuestionSets(bank.slug, papers) };
  }
  const detail = findWholePaperBySlug(bank.slug, entry);
  if (!detail) return null;
  const questions = paperQuestions(bank.slug, detail);
  const free = paperWorkedAnswers(bank.slug, questions);
  const preview = free.length ? [] : paperPreviewAnswers(bank.slug, detail.summary.id, questions);
  const workedAnswers = free.length ? free : preview;
  return { kind: 'paper', bank, detail, all, practice, questions, complete: completeInventory(detail.summary, questions), workedAnswers, preview: preview.length > 0, indexing: indexingFor(bank.slug, detail.summary, free, preview) };
}

/** Each paper's questions when they are the whole paper (completeInventory), else empty: for topic tables. */
export function completeQuestionSets(slug: BankSlug, papers: readonly WholePaperSummary[]): PaperQuestion[][] {
  return papers.map(p => {
    const d = findWholePaperBySlug(slug, paperSlug(p));
    const questions = d ? paperQuestions(slug, d) : [];
    return completeInventory(p, questions) ? questions : [];
  });
}

export const latestYear = (papers: readonly WholePaperSummary[]) => Math.max(...papers.map(p => p.year));

function paperPreviewAnswers(slug: BankSlug, paperId: string, questions: readonly PaperQuestion[]): WorkedAnswer[] {
  const explanations = previewExplanations(slug, paperId);
  return questions.flatMap(q => { const explanation = explanations.get(q.id); return explanation ? [{ number: q.number, marks: q.marks, topics: q.topics, explanation }] : []; });
}

function paperWorkedAnswers(slug: BankSlug, questions: readonly PaperQuestion[]): WorkedAnswer[] {
  const explanations = freeExplanations(slug);
  return questions.flatMap(q => { const explanation = explanations.get(q.id); return explanation ? [{ number: q.number, marks: q.marks, topics: q.topics, explanation }] : []; });
}

/** Coverage is measured against the archive's whole-paper question count, not the (possibly partial) list we hold. */
function indexingFor(slug: BankSlug, p: WholePaperSummary, free: readonly WorkedAnswer[], preview: readonly WorkedAnswer[]): PaperIndexing {
  const answered = new Set(free.map(w => w.number)).size;
  return paperIndexing({ questionCount: p.questionCount > 0 ? p.questionCount : null, workedAnswers: answered, demand: !!demandPage(slug, p.id), previewAnswers: new Set(preview.map(w => w.number)).size });
}

/** Where an unknown entry under a real subject should go: the paper's real URL, else that year's or the subject's list. */
export async function pastPaperFallback(slug: string, entry: string): Promise<{ href: string; permanent: boolean } | null> {
  const subject = await resolveSubject(slug);
  if (!subject) return null;
  const closest = closestPaperEntry(entry, entriesFor(subject.papers));
  return closest ? { href: `/past-papers/${slug}/${closest.entry}`, permanent: closest.exact } : { href: `/past-papers/${slug}`, permanent: false };
}

function entriesFor(papers: readonly WholePaperSummary[]): string[] {
  return [...new Set([...papers.map(p => String(p.year)), ...papers.map(p => paperNumberSlug(p.paper)), ...papers.map(paperSlug)])];
}

export async function pastPaperParams(): Promise<{ slugs: string[]; entries: { slug: string; entry: string }[] }> {
  const banks = await availableBanks();
  const qualifications = [...new Set(banks.map(({ bank }) => qualificationOfBank(bank.slug)))];
  return {
    slugs: [...qualifications, ...banks.map(({ bank }) => subjectSlugForBank(bank.slug))],
    entries: banks.flatMap(({ bank, papers }) => entriesFor(papers).map(entry => ({ slug: subjectSlugForBank(bank.slug), entry }))),
  };
}

/** Only the pages that ask to be indexed (see past-paper-indexing.ts); the rest stay reachable by links. */
export async function pastPaperSitemapPaths(): Promise<string[]> {
  const banks = await availableBanks();
  if (!banks.length) return [];
  const qualifications = [...new Set(banks.map(({ bank }) => qualificationOfBank(bank.slug)))];
  return ['/past-papers', ...qualifications.map(q => `/past-papers/${q}`), ...banks.flatMap(({ bank, papers }) => {
    const subject = subjectSlugForBank(bank.slug);
    const numbers = [...new Set(papers.map(p => paperNumberSlug(p.paper)))];
    const indexedPapers = papers.filter(p => {
      const detail = findWholePaperBySlug(bank.slug, paperSlug(p));
      if (!detail) return false;
      const questions = paperQuestions(bank.slug, detail);
      return indexingFor(bank.slug, p, paperWorkedAnswers(bank.slug, questions), paperPreviewAnswers(bank.slug, p.id, questions)).indexed;
    });
    return [`/past-papers/${subject}`, `/past-papers/${subject}/${latestYear(papers)}`, ...numbers.map(n => `/past-papers/${subject}/${n}`), ...indexedPapers.map(p => `/past-papers/${subject}/${paperSlug(p)}`)];
  })];
}

/** When each group of past-paper pages switched to noindex: PR #473 (other years, year lists) and PR #502
 * (latest-year paper pages, A Level hold). Used only by the temporary /sitemap-noindex.xml. */
export const NOINDEX_SINCE = { firstCut: '2026-11-07', latestYearCut: '2026-11-21' } as const;
/** Banks whose paper pages were in the sitemap before the first cut (archives added 2026-10-12 to 10-20).
 * Banks added later (A Level, IB Business Management) launched noindex, so Google never indexed their pages. */
export const NOINDEX_SITEMAP_BANKS: ReadonlySet<string> = new Set([
  'igcse', 'igcse-additional', 'igcse-biology-0610', 'igcse-chemistry-0620', 'igcse-physics-0625', 'igcse-coordinated-sciences-0654', 'igcse-economics-0455', 'igcse-computer-science-0478',
  'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl', 'ib-physics-hl', 'ib-physics-sl', 'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-biology-hl', 'ib-biology-sl', 'ib-economics-hl', 'ib-economics-sl', 'ib-computer-science-hl', 'ib-computer-science-sl',
]);

/**
 * TEMPORARY (2026-11-26): every live /past-papers page that asks not to be indexed, with the date it
 * switched to noindex. Served at /sitemap-noindex.xml so Google recrawls these pages and processes the
 * noindex sooner (GSC had processed ~409 of ~2,700 by 2026-11-22). Submitted in GSC only; it is not in
 * robots.txt, the main sitemap or IndexNow. Delete the route and this helper once GSC "Excluded by
 * 'noindex' tag" covers them (docs/audits/2026-11-26-seo-review).
 */
export async function pastPaperNoindexEntries(): Promise<{ path: string; lastModified: string }[]> {
  const indexed = new Set(await pastPaperSitemapPaths());
  const banks = (await availableBanks()).filter(({ bank }) => NOINDEX_SITEMAP_BANKS.has(bank.slug));
  return banks.flatMap(({ bank, papers }) => {
    const subject = subjectSlugForBank(bank.slug);
    const latest = latestYear(papers);
    const years = [...new Set(papers.map(p => p.year))].map(year => ({ path: `/past-papers/${subject}/${year}`, lastModified: NOINDEX_SINCE.firstCut }));
    const details = papers.map(p => ({ path: `/past-papers/${subject}/${paperSlug(p)}`, lastModified: p.year === latest ? NOINDEX_SINCE.latestYearCut : NOINDEX_SINCE.firstCut }));
    return [...years, ...details].filter(({ path }) => !indexed.has(path));
  });
}

type IndexQuestion = { id: string; number: number; marks: number | null; primaryTopic: string; secondaryTopics: string[] };
const BANK_INDEXES = new Map<BankSlug, IndexQuestion[]>();
/** Pages are pre-rendered at build, after prebuild writes public/bank-index, so this read never runs on a request. */
function bankIndexQuestions(slug: BankSlug): IndexQuestion[] {
  const cached = BANK_INDEXES.get(slug);
  if (cached) return cached;
  const file = (PUBLIC_BANK_INDEX_FILES as Partial<Record<BankSlug, string>>)[slug];
  let questions: IndexQuestion[] = [];
  try { if (file) questions = JSON.parse(readFileSync(join(process.cwd(), 'public/bank-index', file), 'utf8')).questions ?? []; } catch { questions = []; }
  BANK_INDEXES.set(slug, questions);
  return questions;
}

const REPRINTS = (reprintAliases as unknown as { banks: Partial<Record<string, Record<string, [number, string][]>>> }).banks;
/** The paper's questions with topics. Papers held from self-marking carry no list in the archive,
 * so theirs comes from the bank questions cut from the same paper (no page: their printed layout is unreconciled).
 * A reprinted variant (A Level) also gets the canonical rows whose exact runtime aliases name it, under its own
 * printed numbers; rows the bank holds back stay missing, so a partial list never reads as the whole paper. */
export function paperQuestions(slug: BankSlug, detail: WholePaperDetail): PaperQuestion[] {
  if (detail.questions.length) return archiveQuestions(detail);
  const key = archivePaperKey(slug, detail.summary.id);
  const index = bankIndexQuestions(slug);
  const byId = new Map(index.map(q => [q.id, q]));
  const own = index.filter(q => questionPaperKey(q.id) === key).map(q => ({ q, number: q.number }));
  const taken = new Set(own.map(row => row.number));
  const reprinted = (REPRINTS[slug]?.[key] ?? []).flatMap(([number, id]) => {
    const q = byId.get(id);
    return q && !taken.has(number) ? [{ q, number }] : [];
  });
  return [...own, ...reprinted]
    .sort((a, b) => a.number - b.number)
    .map(({ q, number }) => ({ id: q.id, number, marks: q.marks, topics: [...new Set([q.primaryTopic, ...q.secondaryTopics].filter(Boolean))] }));
}
