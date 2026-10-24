import 'server-only';
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, type BankSlug, type CatalogBank } from './catalog';
import { courseToneForBank, type CourseTone } from '@/components/CourseIcon';
import { bankForSubjectSlug, paperNumberSlug, paperSlug, qualificationOfBank, subjectSlugForBank, type PastPaperQualification } from './past-paper-catalog';
import { subjectSearchName, yearRange } from './past-paper-seo';
import { findWholePaperBySlug, getWholePaperSummaries, wholePaperArchiveEnabled } from './whole-paper-archive';
import type { WholePaperDetail, WholePaperSummary } from './whole-paper-types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_BANK_INDEX_FILES } from './bank-index-manifest';
import { archiveQuestions, archivePaperKey, questionPaperKey, type PaperQuestion } from './paper-question-links';

/** Resolves public /past-papers URLs for pages, static params and the sitemap.
 * Everything is empty while the archive gate is closed, so no page is built or linked. */
export type HubBank = { bankSlug: BankSlug; subjectSlug: string; name: string; qualification: PastPaperQualification; paperCount: number; years: string; tone: CourseTone };
/** `practice` is false for banks whose /banks page isn't published yet, so no link points at a 404. */
export type SubjectView = { kind: 'subject'; bank: CatalogBank; papers: WholePaperSummary[]; practice: boolean };
export type YearView = { kind: 'year'; bank: CatalogBank; year: number; papers: WholePaperSummary[]; all: WholePaperSummary[]; practice: boolean };
export type PaperNumberView = { kind: 'paperNumber'; bank: CatalogBank; paper: string; papers: WholePaperSummary[]; all: WholePaperSummary[]; practice: boolean };
export type PaperView = { kind: 'paper'; bank: CatalogBank; detail: WholePaperDetail; all: WholePaperSummary[]; practice: boolean; questions?: PaperQuestion[] };
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
    return papers.length ? { kind: 'year', bank, year: Number(entry), papers, all, practice } : null;
  }
  const number = /^paper-([0-9a-z]+)$/.exec(entry)?.[1];
  if (number) {
    const papers = all.filter(p => p.paper.toLowerCase() === number);
    return papers.length ? { kind: 'paperNumber', bank, paper: papers[0].paper, papers, all, practice } : null;
  }
  const detail = findWholePaperBySlug(bank.slug, entry);
  return detail ? { kind: 'paper', bank, detail, all, practice, questions: paperQuestions(bank.slug, detail) } : null;
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

export async function pastPaperSitemapPaths(): Promise<string[]> {
  const { slugs, entries } = await pastPaperParams();
  if (!slugs.length) return [];
  return ['/past-papers', ...slugs.map(slug => `/past-papers/${slug}`), ...entries.map(({ slug, entry }) => `/past-papers/${slug}/${entry}`)];
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

/** The paper's questions with topics. Papers held from self-marking carry no list in the archive,
 * so theirs comes from the bank questions cut from the same paper (no page: their printed layout is unreconciled). */
export function paperQuestions(slug: BankSlug, detail: WholePaperDetail): PaperQuestion[] {
  if (detail.questions.length) return archiveQuestions(detail);
  const key = archivePaperKey(slug, detail.summary.id);
  return bankIndexQuestions(slug)
    .filter(q => questionPaperKey(q.id) === key)
    .sort((a, b) => a.number - b.number)
    .map(q => ({ id: q.id, number: q.number, marks: q.marks, topics: [...new Set([q.primaryTopic, ...q.secondaryTopics].filter(Boolean))] }));
}
