/**
 * Paper duration and maximum marks come from the official syllabus or subject guide (data/paper-archives/
 * assessment-structure.json), keyed by bank, exam year, route and component — never from a parsed PDF cover,
 * which can misread ("1 hour 2 0 minutes" became 60 minutes). Entries the guide leaves silent or that were
 * misread are backed by the printed papers themselves; single papers that differ from their guide are listed
 * as paperExceptions with evidence. Papers in a shared sitting (IB Paper 1A and 1B) have no per-paper duration.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const ASSESSMENT_STRUCTURE_FILE = 'data/paper-archives/assessment-structure.json';

type Entry = { bank: string; years: [number, number]; route: string | null; component: string; durationMinutes: number; maxMarks: number; sharedDurationWith?: string };
type PaperException = { paperId: string; bank: string; maxMarks?: number; durationMinutes?: number | null };
export type AssessmentStructure = { schema: string; entries: Entry[]; paperExceptions: PaperException[] };
export type PaperKey = { id: string; bankSlug: string; year: number; component: string; route?: string | null };

export function loadAssessmentStructure(root = process.cwd()): AssessmentStructure {
  const structure = JSON.parse(readFileSync(path.join(root, ASSESSMENT_STRUCTURE_FILE), 'utf8')) as AssessmentStructure;
  if (structure.schema !== 'assessment-structure-v1' || !Array.isArray(structure.entries)) throw new Error('Invalid assessment structure');
  return structure;
}

/** The single entry for this paper; throws when none or several match, so an unmodelled paper fails the build. */
export function assessmentFor(structure: AssessmentStructure, paper: PaperKey): { durationMinutes: number | null; maxMarks: number } {
  const matches = structure.entries.filter((entry) => entry.bank === paper.bankSlug && entry.component === paper.component
    && entry.years[0] <= paper.year && paper.year <= entry.years[1]
    && (entry.route === null || !paper.route || entry.route === paper.route));
  if (matches.length !== 1) throw new Error(`Assessment structure has ${matches.length} entries for ${paper.bankSlug} ${paper.id}`);
  const [entry] = matches;
  const exception = structure.paperExceptions.find((item) => item.paperId === paper.id && item.bank === paper.bankSlug);
  return {
    durationMinutes: exception && 'durationMinutes' in exception ? exception.durationMinutes ?? null : entry.sharedDurationWith ? null : entry.durationMinutes,
    maxMarks: exception?.maxMarks ?? entry.maxMarks,
  };
}
