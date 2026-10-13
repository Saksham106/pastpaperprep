import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PaperArchiveDetail, PaperArchiveSummary } from './paper-archive-types';

export type { PaperArchiveDetail, PaperArchiveSummary } from './paper-archive-types';
const SOURCE_ROOT = '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-chemistry-0620-topic-practice/data';
const ARCHIVE = path.join(process.cwd(), 'private/chemistry-paper-archive/archive.json');
const validId = (id: string) => /^0620-\d{4}-[msw]-[1-6][1-3]$/.test(id);
export function localChemistryPaperPreviewEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.LOCAL_PAPER_PREVIEW === 'true';
}

type Entry = {
  summary: PaperArchiveSummary;
  detail: PaperArchiveDetail;
  source: { id: string; question: string; markscheme: string };
  evidence: { question: { sha256: string; bytes: number }; markscheme: { sha256: string; bytes: number } };
};
async function loadArchive(): Promise<Entry[]> {
  if (!localChemistryPaperPreviewEnabled()) return [];
  const archive = JSON.parse(await fs.readFile(ARCHIVE, 'utf8')) as { papers: Entry[] };
  if (!Array.isArray(archive.papers) || new Set(archive.papers.map(p => p.summary.id)).size !== archive.papers.length || archive.papers.some(p => !validId(p.summary.id))) throw new Error('Invalid local Chemistry archive');
  return archive.papers;
}
// Explicit projection is the client boundary: never serialize source bindings,
// PDF fingerprints, text, answers, crop assets or classification provenance.
function summaryOf({ summary: s }: Entry): PaperArchiveSummary {
  return {
    id: s.id, bankSlug: s.bankSlug, title: s.title, subject: s.subject, syllabusCode: s.syllabusCode,
    year: s.year, session: s.session, sessionCode: s.sessionCode, component: s.component,
    paper: s.paper, variant: s.variant, paperName: s.paperName, route: s.route,
    durationMinutes: s.durationMinutes, maxMarks: s.maxMarks, questionCount: s.questionCount,
    questionPages: s.questionPages, markschemePages: s.markschemePages,
    reportAvailable: s.reportAvailable, ...(s.reportReason ? { reportReason: s.reportReason } : {}),
  };
}
export async function getChemistryPaperSummaries(): Promise<PaperArchiveSummary[]> {
  return (await loadArchive()).map(summaryOf);
}
export async function getChemistryPaper(id: string): Promise<PaperArchiveDetail | null> {
  if (!validId(id) || !localChemistryPaperPreviewEnabled()) return null;
  const entry = (await loadArchive()).find(p => p.summary.id === id);
  if (!entry) return null;
  const base = `/past-papers/igcse-chemistry-0620/${id}/document`;
  return {
    ...summaryOf(entry), version: entry.detail.version,
    sources: { question: `${base}?kind=question`, markscheme: `${base}?kind=markscheme` },
    questions: entry.summary.reportAvailable ? entry.detail.questions.map(q => ({
      id: q.id, number: q.number, maxMarks: q.maxMarks, topics: [...q.topics],
      ...(q.questionPage ? { questionPage: q.questionPage } : {}),
    })) : [],
  };
}
/** Read a single allowlisted, hash-pinned original only after document open. */
export async function getChemistryPaperDocument(id: string, kind: string): Promise<{ bytes: Buffer; filename: string } | null> {
  if (!localChemistryPaperPreviewEnabled() || !validId(id) || (kind !== 'question' && kind !== 'markscheme')) return null;
  const entry = (await loadArchive()).find(p => p.summary.id === id);
  if (!entry || entry.source.id !== id) return null;
  const relative = entry.source[kind];
  if (relative !== `raw/${id}-${kind}.pdf` && relative !== `raw-extension/${id}-${kind}.pdf`) return null;
  const target = path.join(SOURCE_ROOT, relative);
  try {
    if ((await fs.lstat(target)).isSymbolicLink() || await fs.realpath(target) !== target) return null;
    const bytes = await fs.readFile(target);
    if (bytes.length !== entry.evidence[kind].bytes || createHash('sha256').update(bytes).digest('hex') !== entry.evidence[kind].sha256 || bytes.subarray(0, 5).toString() !== '%PDF-') return null;
    return { bytes, filename: `${id}-${kind}.pdf` };
  } catch { return null; }
}
