#!/usr/bin/env node
// Reviewed Chemistry 0620 and Physics 0625 crop repairs (docs/science-crop-repairs-0620-0625.md). Written answers
// whose crop misses one of the question's own mark-scheme table rows, or shows another question's row, are replaced
// by crops of exactly the question's own rows from the pinned MS PDF; one question-paper crop (0625-2020-w-52-q1) is
// extended to the "[4]" printed against the page footer. Built from ../research/science-ms-crop-audit-20261017
// (audit_bank.py, build_repairs_bank.py, qp-repair/). The finalized runtimes and earlier overlays stay byte-identical.
//
// Writes:
//   src/data/reviewed-science-crop-repairs-0620-0625.json        overlay read by the app (old paths -> new paths)
//   data/storage/science-crop-repairs-0620-0625.manifest.json    unique new objects to upload (create-only)
//
// usage: node scripts/build-science-crop-repairs-0620-0625.mjs <research dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANKS = ['igcse-chemistry-0620', 'igcse-physics-0625'];
const PREFIX = { 'igcse-chemistry-0620': 'igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/', 'igcse-physics-0625': 'igcse-physics-0625/releases/repaired-v2-d95657a79bfc/' };
const OUT = { overlay: 'src/data/reviewed-science-crop-repairs-0620-0625.json', manifest: 'data/storage/science-crop-repairs-0620-0625.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`0620/0625 crop repairs: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const research = process.argv[2];
assert(research, 'pass the research package directory');
const CHECK = process.argv.includes('--check');
const packages = Object.fromEntries(BANKS.map((bank) => [bank, readFileSync(join(research, 'build-a', bank, 'repairs.json'))]));
const qpBytes = readFileSync(join(research, 'qp-repair/build-a/candidate.json'));
const namespace = `repairs/science-ms-rows-v2-${sha256(Buffer.concat([...BANKS.map((b) => packages[b]), qpBytes])).slice(0, 16)}`;
const scienceWritten = read('src/data/reviewed-science-written-answer-repairs.json');
const clean = read('src/data/reviewed-clean-source-crops.json');
const earlierRows = read('src/data/reviewed-science-ms-row-repairs.json');

const banks = {}, questionRepairs = {}, objects = new Map();
const addObject = (bank, path, digest, bytes, localPath) => objects.set(PREFIX[bank] + path, { objectKey: PREFIX[bank] + path, sha256: digest, bytes, localPath });
for (const bank of BANKS) {
  const pkg = JSON.parse(packages[bank]);
  assert(pkg.schema === 'science-ms-row-repairs-bank-v1' && pkg.bank === bank && pkg.scale === 1.5, `${bank}: unexpected package`);
  const runtime = new Map(read(`src/data/production/${bank}.json`).questions.map((q) => [q.id, q]));
  const release = new Map(read(`data/storage/${bank}.manifest.json`).assets.map((a) => [a.objectKey, a.sha256]));
  const cleanPaths = clean.banks[bank] ?? {};
  // The loader's answer list before the reviewed overlays (src/lib/questions.ts markschemeImagePaths).
  const rawAnswers = (q) => [...new Set([...(q.markschemeImages ?? []), ...(q.officialMarkscheme?.images ?? [])])];
  banks[bank] = {};
  for (const [qid, e] of Object.entries(pkg.entries)) {
    const q = runtime.get(qid);
    assert(q && /^[3-6]/.test(String(q.component)), `${qid}: not a written question of the runtime`);
    assert(!earlierRows.banks[bank]?.[qid], `${qid}: already in the 0654 row overlay`);
    const oldPaths = rawAnswers(q);
    // What students are served today: the 2026-10-02 written-answer repair, then the watermark re-render.
    const served = (scienceWritten[bank]?.[qid]?.newPaths ?? oldPaths).map((p) => (cleanPaths[p] ? `${clean.namespace}/${cleanPaths[p].sha256}.webp` : p));
    assert(JSON.stringify(served) === JSON.stringify(e.servedPaths), `${qid}: package was built from different served crops`);
    oldPaths.forEach((p) => assert(release.has(PREFIX[bank] + p), `${qid}: ${p} is not a released object`));
    const newPaths = [];
    for (const crop of e.crops) {
      const local = join(research, 'build-a', bank, 'images', `${crop.sha256}.webp`);
      const bytes = readFileSync(local);
      assert(sha256(bytes) === crop.sha256 && bytes.length === crop.bytes, `${qid}: candidate ${crop.sha256} bytes differ`);
      const path = `${namespace}/${crop.sha256}.webp`;
      newPaths.push(path);
      addObject(bank, path, crop.sha256, crop.bytes, local);
    }
    assert(new Set(newPaths).size === newPaths.length, `${qid}: duplicate crop`);
    banks[bank][qid] = { oldPaths, newPaths, sha256: e.crops.map((c) => c.sha256), sourcePdfSha256: e.sourcePdfSha256, reason: e.reason, missingRows: e.missingRows, foreignRows: e.foreignRows };
  }
}

// Question paper: one crop extended to its footer-line mark; every other path of the question is kept.
{
  const bank = 'igcse-physics-0625';
  const c = JSON.parse(qpBytes);
  assert(c.schema === '0625-qp-footer-mark-repair-v1' && c.questionId === '0625-2020-w-52-q1', 'unexpected question-paper candidate');
  const q = read(`src/data/production/${bank}.json`).questions.find((x) => x.id === c.questionId);
  const release = new Map(read(`data/storage/${bank}.manifest.json`).assets.map((a) => [a.objectKey, a.sha256]));
  const oldPaths = q.questionImages;
  assert(oldPaths.filter((p) => p === c.old.path).length === 1, 'question-paper crop is not in the runtime');
  const local = join(research, 'qp-repair/build-a', `${c.new.sha256}.webp`);
  const bytes = readFileSync(local);
  assert(sha256(bytes) === c.new.sha256 && bytes.length === c.new.bytes, 'question-paper candidate bytes differ');
  const newPath = `${namespace}/${c.new.sha256}.webp`;
  addObject(bank, newPath, c.new.sha256, c.new.bytes, local);
  questionRepairs[bank] = { [c.questionId]: {
    oldPaths, oldSha256: oldPaths.map((p) => release.get(PREFIX[bank] + p)),
    newPaths: oldPaths.map((p) => (p === c.old.path ? newPath : p)),
    sha256: oldPaths.map((p) => (p === c.old.path ? c.new.sha256 : release.get(PREFIX[bank] + p))),
    sourcePdfSha256: c.sourcePdfSha256, reason: 'question 1(c) mark "[4]" printed against the page footer was below the crop',
  } };
}

const overlay = {
  schema: 'reviewed-science-crop-repairs-0620-0625-v1',
  namespace,
  source: {
    research: 'research/science-ms-crop-audit-20261017',
    packages: Object.fromEntries(BANKS.map((b) => [b, { sha256: sha256(packages[b]), auditSha256: JSON.parse(packages[b]).auditSha256, builderSha256: JSON.parse(packages[b]).builderSha256 }])),
    questionPaperCandidateSha256: sha256(qpBytes),
  },
  banks,
  questionRepairs,
};
const sorted = [...objects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'science-crop-repairs-0620-0625-upload-v1',
  namespace,
  answerReplacementCount: BANKS.reduce((n, b) => n + Object.keys(banks[b]).length, 0),
  questionReplacementCount: 1,
  objectCount: sorted.length,
  objectBytes: sorted.reduce((n, o) => n + o.bytes, 0),
  objects: sorted.map(({ objectKey, sha256: digest, bytes }) => ({ objectKey, sha256: digest, bytes })),
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, path), 'utf8') === text, `--check: ${path} is stale`);
  else writeFileSync(join(APP, path), text);
}
console.log(JSON.stringify({ check: CHECK, namespace, answers: manifest.answerReplacementCount, questions: 1, objects: manifest.objectCount, bytes: manifest.objectBytes }));
