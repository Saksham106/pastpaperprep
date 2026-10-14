// Builds the reviewed 0455 Paper 2 Q1 source-material crop overlay and its storage plan from the
// source repository's repair receipt (igcse-economics-0455-topic-practice,
// data/segmentation/p2-q1-source-repair/). Fail-closed: each entry must bind to a live runtime row
// by exact question paths and hashes; only the one anchor-page crop per row changes.
//
// usage: PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT=<source checkout> node scripts/build-reviewed-economics-q1-source-repairs.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readApprovedCandidate } from './reviewed-crop-source-path.mjs';

const BANK = 'igcse-economics-0455';
const PREFIX = 'igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/';
const SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT
  ?? '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice';
const REPAIR_DIR = 'data/segmentation/p2-q1-source-repair';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const receiptBytes = readFileSync(join(SOURCE_ROOT, REPAIR_DIR, 'repair-receipt.json'));
const receipt = JSON.parse(receiptBytes);
const receiptSha256 = sha256(receiptBytes);
const namespace = `repairs/economics-q1-source-v1-${receiptSha256.slice(0, 16)}`;
if (receipt.artifact !== 'economics0455_p2_q1_source_repair' || receipt.affected_count !== Object.keys(receipt.entries ?? {}).length) throw new Error('Unexpected source receipt');
const sourceCommit = execFileSync('git', ['-C', SOURCE_ROOT, 'log', '-1', '--format=%H', '--', join(REPAIR_DIR, 'repair-receipt.json')], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error('Source receipt is not committed');

const runtime = JSON.parse(readFileSync(`src/data/production/${BANK}.json`, 'utf8'));
const live = new Map(runtime.questions.map((q) => [q.id, q]));
const candidateRoot = join(SOURCE_ROOT, REPAIR_DIR, 'candidates');

const entries = {};
const objects = [];
const notLive = [];
for (const [questionId, e] of Object.entries(receipt.entries)) {
  const row = live.get(questionId);
  if (!row) { notLive.push(questionId); continue; }
  const oldPaths = e.old_paths.map((p) => p.replace(/^assets\/([^/]+)\/question\//, 'questions/$1/'));
  if (JSON.stringify(row.questionImages) !== JSON.stringify(oldPaths) ||
      JSON.stringify(row.questionImageHashes) !== JSON.stringify(e.old_sha256) || row.paper !== 2 || row.number !== 1) {
    throw new Error(`${questionId}: live question crops differ from the source receipt`);
  }
  const bytes = readApprovedCandidate(join(candidateRoot, `${e.new_sha256}.webp`), candidateRoot);
  if (sha256(bytes) !== e.new_sha256 || bytes.length !== e.new_bytes) throw new Error(`${questionId}: candidate bytes differ`);
  const relativePath = `${namespace}/${e.new_sha256}.webp`;
  const newPaths = [...oldPaths];
  const hashes = [...e.old_sha256];
  newPaths[e.replaced_index] = relativePath;
  hashes[e.replaced_index] = e.new_sha256;
  entries[questionId] = { oldPaths, oldSha256: e.old_sha256, newPaths, sha256: hashes, sourcePdfSha256: e.source_pdf_sha256 };
  objects.push({
    questionId, objectKey: PREFIX + relativePath, relativePath, sha256: e.new_sha256, bytes: e.new_bytes,
    sourcePath: join(REPAIR_DIR, 'candidates', `${e.new_sha256}.webp`),
    supersedes: { objectKey: PREFIX + oldPaths[e.replaced_index], sha256: e.old_sha256[e.replaced_index] },
  });
}
if (!objects.length || new Set(objects.map((o) => o.objectKey)).size !== objects.length) throw new Error('Empty or duplicate repair set');

const overlay = {
  schema: 'reviewed-economics-question-crop-repairs-v1',
  bank: BANK,
  namespace,
  sourceReceiptSha256: receiptSha256,
  reason: 'Paper 2 Q1 source material that continues above the Q1 anchor was cropped away; the anchor-page crop is re-rendered from the clean source PDF with the band starting at the 48pt page-furniture line (the 2026 lane rule).',
  entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync('src/data/reviewed-economics-question-crop-repairs.json', `${JSON.stringify(overlay, null, 1)}\n`);
const manifest = {
  schema: 'economics-q1-source-repairs-v1',
  bank: BANK,
  bucket: 'pastpaperprep-assets',
  objectPrefix: PREFIX,
  namespace,
  sourceRepository: 'igcse-economics-0455-topic-practice',
  sourceCommit,
  sourceReceipt: join(REPAIR_DIR, 'repair-receipt.json'),
  sourceReceiptSha256: receiptSha256,
  sourceRowsNotLive: notLive,
  objectCount: objects.length,
  objectBytes: objects.reduce((sum, o) => sum + o.bytes, 0),
  objects: objects.sort((a, b) => a.questionId.localeCompare(b.questionId)),
};
writeFileSync('data/storage/economics-q1-source-repairs.manifest.json', `${JSON.stringify(manifest, null, 1)}\n`);
console.log(JSON.stringify({ namespace, sourceCommit, live: objects.length, notLive }));
