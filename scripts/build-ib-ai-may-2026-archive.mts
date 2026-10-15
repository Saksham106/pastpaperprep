/**
 * Adds the IB Maths AI May 2026 papers to the whole-paper archive manifests without rebuilding the 2021-2025
 * entries (their source PDFs are no longer cached; the existing entries stay byte-identical).
 *
 *   npx tsx scripts/build-ib-ai-may-2026-archive.mts <private-state-dir> <work-dir> [identity-review.json ...]
 *
 * <private-state-dir> is a copy of research/official-sources-20261013/paper-archive-state-2026-10-15 (receipt,
 * source-bindings, progress). The builder runs only for the 2026 pairs into <work-dir>; the resulting entries are
 * appended to src/data/paper-archives/ib-ai-{hl,sl}.json (runtimeSha256 and coverage recomputed), and the 2026
 * bindings are merged into <private-state-dir>/source-bindings.json for scripts/publish-added-free-papers.mts.
 * Nothing is uploaded.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { WholePaperManifest } from '../src/lib/whole-paper-types';
import { atomicJson } from './whole-paper-extraction.mjs';
import { buildWholePaperArchives, type Inventory } from './build-whole-paper-archives.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const WORKSPACE = path.resolve(execFileSync('git', ['-C', REPO, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim(), '../..');
const LEVELS = { hl: 'HL', sl: 'SL' } as const;
const PAPERS = { hl: [1, 2, 3], sl: [1, 2] } as const;

function sourceName(level: 'hl' | 'sl', paper: number, tz: number, kind: 'question' | 'markscheme') {
  return `Mathematics_applications_and_interpretation_paper_${paper}_TZ${tz}_${LEVELS[level]}${kind === 'markscheme' ? '_markscheme' : ''}.pdf`;
}

async function main() {
  const [stateArg, workArg, ...reviewArgs] = process.argv.slice(2);
  if (!stateArg || !workArg) throw new Error('Usage: build-ib-ai-may-2026-archive.mts <private-state-dir> <work-dir> [identity-review.json ...]');
  const state = path.resolve(stateArg), work = path.resolve(workArg);
  const privateWork = path.join(work, 'private/paper-archives');
  await fs.mkdir(privateWork, { recursive: true });
  for (const name of ['source-bindings.json', 'receipt.json', 'progress.jsonl']) await fs.copyFile(path.join(state, name), path.join(privateWork, name));
  await fs.mkdir(path.join(work, 'data/paper-archives'), { recursive: true });
  // The builder reads the committed runtime banks and the loader from `root`; outputs go to `outputRoot`.
  const inventory: Inventory = { banks: [] };
  for (const level of ['hl', 'sl'] as const) {
    const slug = `ib-ai-${level}`;
    const runtimeFile = path.join(REPO, `src/data/raw/${slug}.json`);
    const runtime = JSON.parse(await fs.readFile(runtimeFile, 'utf8')) as { questions: { id: string }[] };
    const rawDir = path.join(WORKSPACE, `ib-maths-ai-${level}-topic-practice-may-2026/data/raw/official-may-2026`);
    const pairs = [];
    for (const tz of [1, 2, 3]) for (const paper of PAPERS[level]) {
      const id = `2026-may-tz${tz}-p${paper}`;
      pairs.push({
        id, runtimePaperId: id,
        questionPath: path.join(rawDir, sourceName(level, paper, tz, 'question')),
        markschemePath: path.join(rawDir, sourceName(level, paper, tz, 'markscheme')),
        runtimeQuestionIds: runtime.questions.map(q => q.id).filter(qid => qid.replace(/-q\d+$/, '') === id),
      });
    }
    inventory.banks.push({ slug: slug as never, runtimeFile, pairs, unpaired: [], runtimeWithoutPair: [], notes: [] });
  }
  const inventoryFile = path.join(work, 'inventory-ib-ai-may-2026.json');
  await atomicJson(inventoryFile, inventory);
  const built = await buildWholePaperArchives({ inventoryFiles: [inventoryFile], identityReviewFiles: reviewArgs.map(f => path.resolve(f)), root: REPO, outputRoot: work });
  const mergedBindings = JSON.parse(await fs.readFile(path.join(state, 'source-bindings.json'), 'utf8')) as { roots: { id: string; path: string }[]; documents: { bankSlug: string; paperId: string; kind: string; rootId: string }[] };
  const workBindings = JSON.parse(await fs.readFile(path.join(privateWork, 'source-bindings.json'), 'utf8')) as typeof mergedBindings;
  const pending: { file: string; merged: WholePaperManifest }[] = [];
  for (const manifest of built) {
    const file = path.join(REPO, 'src/data/paper-archives', `${manifest.bankSlug}.json`);
    const existing = JSON.parse(await fs.readFile(file, 'utf8')) as WholePaperManifest;
    if (existing.bankSlug !== manifest.bankSlug || existing.papers.some(p => p.summary.year === 2026)) throw new Error(`${manifest.bankSlug}: manifest already has 2026 papers`);
    if (manifest.papers.length !== (manifest.bankSlug === 'ib-ai-hl' ? 9 : 6)) throw new Error(`${manifest.bankSlug}: not every 2026 paper was promoted`);
    const papers = [...existing.papers, ...manifest.papers].sort((a, b) => a.summary.id.localeCompare(b.summary.id));
    const reports = papers.filter(p => p.summary.reportAvailable).length;
    const merged: WholePaperManifest = {
      ...existing, runtimeSha256: manifest.runtimeSha256, papers,
      coverage: { ...existing.coverage, paired: papers.length, reports, held: papers.length - reports },
    };
    pending.push({ file, merged });
    console.log(`${manifest.bankSlug}: ${existing.papers.length} existing + ${manifest.papers.length} new = ${papers.length} (${reports} reports)`);
  }
  for (const { file, merged } of pending) await atomicJson(file, merged); // only after every bank validated
  // Keep the other banks' (and the 2021-2025 AI) bindings; replace only the 2026 AI documents.
  const kept = mergedBindings.documents.filter(d => !(d.bankSlug.startsWith('ib-ai-') && d.paperId.startsWith('2026-')));
  const documents = [...kept, ...workBindings.documents.filter(d => d.paperId.startsWith('2026-'))]
    .sort((a, b) => `${a.bankSlug}/${a.paperId}/${a.kind}`.localeCompare(`${b.bankSlug}/${b.paperId}/${b.kind}`));
  const roots = new Map([...mergedBindings.roots, ...workBindings.roots].map(r => [r.id, r]));
  const used = new Set(documents.map(d => d.rootId));
  await atomicJson(path.join(state, 'source-bindings.json'), { roots: [...roots.values()].filter(r => used.has(r.id)).sort((a, b) => a.id.localeCompare(b.id)), documents });
}
await main();
