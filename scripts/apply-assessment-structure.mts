/**
 * Rewrite every committed whole-paper manifest's durationMinutes and maxMarks from the assessment structure,
 * without re-extracting PDFs. A changed paper gets a new version (derived from its old version and new summary)
 * so cached reader state keyed by version is not reused for different metadata.
 *
 *   npx tsx scripts/apply-assessment-structure.mts [--check]
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assessmentFor, loadAssessmentStructure } from './assessment-structure.mjs';

const DIR = 'src/data/paper-archives';
const check = process.argv.includes('--check');
const structure = loadAssessmentStructure();
const changes: string[] = [];
for (const file of readdirSync(DIR).filter((name) => name.endsWith('.json')).sort()) {
  const manifestPath = path.join(DIR, file);
  const text = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(text) as { papers: Array<{ summary: Record<string, unknown> & { id: string; bankSlug: string; year: number; component: string; route?: string | null; durationMinutes: number | null; maxMarks: number | null; reportAvailable: boolean }; version: string; questions: Array<{ maxMarks: number }> }> };
  let changed = false;
  for (const paper of manifest.papers) {
    const { summary } = paper;
    const target = assessmentFor(structure, summary);
    if (summary.reportAvailable && paper.questions.reduce((sum, question) => sum + question.maxMarks, 0) !== target.maxMarks) {
      throw new Error(`${summary.id}: report question marks do not sum to the assessment maximum ${target.maxMarks}`);
    }
    if (summary.durationMinutes === target.durationMinutes && summary.maxMarks === target.maxMarks) continue;
    changes.push(`${summary.id}: ${summary.durationMinutes ?? '—'} min / ${summary.maxMarks ?? '—'} marks -> ${target.durationMinutes ?? '— (shared sitting)'} min / ${target.maxMarks} marks`);
    summary.durationMinutes = target.durationMinutes;
    summary.maxMarks = target.maxMarks;
    paper.version = createHash('sha256').update(JSON.stringify([paper.version, 'assessment-structure-v1', summary])).digest('hex').slice(0, 20);
    changed = true;
  }
  if (changed && !check) writeFileSync(manifestPath, text.endsWith('\n') ? `${JSON.stringify(manifest)}\n` : JSON.stringify(manifest));
}
console.log(changes.join('\n'));
console.log(`${changes.length} papers ${check ? 'would change' : 'changed'}`);
if (check && changes.length) process.exit(1);
