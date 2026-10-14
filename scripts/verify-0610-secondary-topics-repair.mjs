#!/usr/bin/env node
/**
 * Proof for the 0610 material-secondaries reseal, against Git rather than the reseal code:
 * the finalized baseline (main, 0a0b224) versus the committed runtime and private index.
 *
 *   - exactly the 200 frozen extension rows change, and every other row is byte-identical in order;
 *   - on those rows only secondaryTopics, secondaryTopicIds (added), subtopics, detailedSubtopics and
 *     secondarySubtopics change; primary, marks, text, assets, provenance and states are unchanged;
 *   - every question/mark-scheme reference and therefore every object key is unchanged;
 *   - the storage manifest and verified receipt files are byte-identical to the baseline commit;
 *   - only runtimeArtifact.{secondaryTopicsRepair (added), finalizedContentSha256, runtimeSha256} change in the header;
 *   - the private index changes only secondaryTopics and subtopics of the same 200 rows.
 *
 * Usage: node scripts/verify-0610-secondary-topics-repair.mjs [--runtime <file>] [--index <file>]
 * (defaults to the committed files; after the 2026 May/June addition pass the addition's
 * baseline, e.g. the reseal output, or rely on the test, which checks the 4,913-row prefix).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const BASE = '0a0b2246e269c03f81669548947d011c4f68b741';
const BANK = 'igcse-biology-0610';
const FIELDS = ['secondaryTopics', 'secondaryTopicIds', 'subtopics', 'detailedSubtopics', 'secondarySubtopics'];
const sha = (value) => createHash('sha256').update(value).digest('hex');
const git = (file) => execFileSync('git', ['show', `${BASE}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 200_000_000 });
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const fail = (message) => { throw new Error(`0610 secondaries proof: ${message}`); };

const before = JSON.parse(git(`src/data/production/${BANK}.json`));
const after = JSON.parse(readFileSync(path.resolve(root, arg('--runtime', `src/data/production/${BANK}.json`)), 'utf8'));
const frozen = JSON.parse(readFileSync(path.join(root, 'scripts/data/0610-extension-material-secondaries.json'), 'utf8'));
const targets = new Set(frozen.rows.map((row) => row.id));
const questions = after.questions.slice(0, before.questions.length);
if (questions.length !== 4913 || before.questions.length !== 4913) fail('row counts');

const changedIds = [];
const changedFieldCounts = Object.fromEntries(FIELDS.map((field) => [field, 0]));
for (let i = 0; i < 4913; i++) {
  const a = before.questions[i];
  const b = questions[i];
  if (a.id !== b.id) fail(`row order differs at ${i}`);
  if (JSON.stringify(a) === JSON.stringify(b)) { if (targets.has(a.id)) fail(`target unchanged: ${a.id}`); continue; }
  if (!targets.has(a.id)) fail(`non-target row changed: ${a.id}`);
  changedIds.push(a.id);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
  for (const key of keys) { if (!FIELDS.includes(key)) fail(`${a.id} changed ${key}`); changedFieldCounts[key]++; }
  const strip = (q) => JSON.stringify(Object.fromEntries(Object.entries(q).filter(([key]) => !FIELDS.includes(key))));
  if (strip(a) !== strip(b)) fail(`${a.id} other fields or field order changed`);
  if (b.subtopics[0] !== a.subtopics[0] || JSON.stringify(b.subtopics) !== JSON.stringify(b.detailedSubtopics)) fail(`${a.id} primary subtopic not kept first`);
  if (b.secondaryTopicIds.includes(b.primaryTopicId) || new Set(b.secondaryTopicIds).size !== b.secondaryTopicIds.length) fail(`${a.id} secondary ids not deduplicated / primary not excluded`);
}
if (changedIds.length !== 200 || changedIds.length !== targets.size) fail(`changed ${changedIds.length} rows`);
const refs = (rows) => rows.flatMap((q) => [...q.questionImages, ...q.markschemeImages, ...q.officialMarkscheme.images]);
if (JSON.stringify(refs(before.questions)) !== JSON.stringify(refs(questions))) fail('asset references changed');

const headerBefore = { ...before, questions: null };
const headerAfter = { ...after, questions: null };
const addition = after.runtimeArtifact.extension2026MayJune;
if (!addition) {
  const ra = Object.keys({ ...before.runtimeArtifact, ...after.runtimeArtifact }).filter((key) => JSON.stringify(before.runtimeArtifact[key]) !== JSON.stringify(after.runtimeArtifact[key]));
  if (JSON.stringify(ra.sort()) !== JSON.stringify(['finalizedContentSha256', 'runtimeSha256', 'secondaryTopicsRepair'])) fail(`runtimeArtifact changed ${ra}`);
  headerBefore.runtimeArtifact = null; headerAfter.runtimeArtifact = null;
  if (JSON.stringify(headerBefore) !== JSON.stringify(headerAfter)) fail('runtime header changed outside runtimeArtifact');
}
if (!addition) {
  for (const file of [`data/storage/${BANK}.manifest.json`, `data/storage/${BANK}.receipt.json`]) {
    if (sha(git(file)) !== sha(readFileSync(path.join(root, file), 'utf8'))) fail(`${file} changed`);
  }
} else {
  // The 2026 May/June release moved the committed storage files on; the reseal itself left the verified pair
  // untouched, which the addition recorded as its baseline storage seals.
  if (addition.baselineStorageReceiptSha256 !== sha(git(`data/storage/${BANK}.receipt.json`)) || addition.baselineStorageReceiptSha256 !== before.runtimeArtifact.storageReceiptSha256
    || addition.baselineAssetManifestSha256 !== before.runtimeArtifact.assetManifestSha256) fail('the addition does not record the untouched verified storage pair');
}

const indexBefore = JSON.parse(git(`src/data/private-index/${BANK}.json`));
const indexAfter = JSON.parse(readFileSync(path.resolve(root, arg('--index', `src/data/private-index/${BANK}.json`)), 'utf8'));
let indexChanged = 0;
for (let i = 0; i < 4913; i++) {
  const a = indexBefore.questions[i];
  const b = indexAfter.questions[i];
  if (a.id !== b.id) fail(`index order differs at ${i}`);
  if (JSON.stringify(a) === JSON.stringify(b)) continue;
  if (!targets.has(a.id)) fail(`non-target index row changed: ${a.id}`);
  const keys = Object.keys(a).filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
  if (keys.some((key) => !['secondaryTopics', 'subtopics'].includes(key))) fail(`index ${a.id} changed ${keys}`);
  indexChanged++;
}
if (indexChanged !== 200) fail(`index changed ${indexChanged} rows`);

console.log(JSON.stringify({
  status: 'PASS', baseline: BASE, rows: 4913, changedRows: changedIds.length, byteIdenticalRows: 4913 - changedIds.length,
  changedFieldCounts, years: Object.fromEntries([2019, 2020, 2026].map((year) => [year, changedIds.filter((id) => id.startsWith(`0610-${year}-`)).length])),
  secondaryLabels: questions.filter((q) => targets.has(q.id)).reduce((total, q) => total + q.secondaryTopicIds.length, 0),
  assetReferences: refs(questions).length, manifestAndReceipt: addition ? 'untouched by the reseal (recorded as the addition baseline)' : 'byte-identical', indexChangedRows: indexChanged,
  runtimeSha256: { before: before.runtimeArtifact.runtimeSha256, after: addition ? '(addition present; prefix checked)' : after.runtimeArtifact.runtimeSha256 },
}, null, 1));
