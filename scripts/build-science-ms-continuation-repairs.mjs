#!/usr/bin/env node
// Reviewed mark-scheme continuation repairs (docs/science-ms-continuation-repairs.md). In Chemistry 0620-2025-w-33
// the tables on mark-scheme pages 9, 10 and 12 continue from the previous page without a header, and the 2026-10-17
// crop audit parsed no rows there, so q4, q5 and q7 were served without their last rows. Each is replaced by its
// audited rows (byte-identical to today's crop) plus one crop of the continuation rows, from the pinned MS PDF.
// Built from ../research/science-ms-crop-audit-20261017/continuation-repair (build_continuation.py).
//
// Writes:
//   src/data/reviewed-science-ms-continuation-repairs.json        overlay read by the app (old paths -> new paths)
//   data/storage/science-ms-continuation-repairs.manifest.json    unique new objects to upload (create-only)
//
// usage: node scripts/build-science-ms-continuation-repairs.mjs <research package dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse-chemistry-0620';
const PREFIX = 'igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/';
const OUT = { overlay: 'src/data/reviewed-science-ms-continuation-repairs.json', manifest: 'data/storage/science-ms-continuation-repairs.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`MS continuation repairs: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const research = process.argv[2];
assert(research, 'pass the continuation-repair package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(research, 'build-a', 'repairs.json'));
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === 'science-ms-continuation-repairs-v1' && pkg.bank === BANK && pkg.scale === 1.5, 'unexpected package');
const namespace = `repairs/science-ms-continuation-v1-${sha256(packageBytes).slice(0, 16)}`;

const runtime = new Map(read(`src/data/production/${BANK}.json`).questions.map((q) => [q.id, q]));
const release = new Map(read(`data/storage/${BANK}.manifest.json`).assets.map((a) => [a.objectKey, a.sha256]));
const scienceWritten = read('src/data/reviewed-science-written-answer-repairs.json');
const clean = read('src/data/reviewed-clean-source-crops.json');
const earlier = [read('src/data/reviewed-science-ms-row-repairs.json'), read('src/data/reviewed-science-crop-repairs-0620-0625.json')];
// The loader's answer list before the reviewed overlays (src/lib/questions.ts markschemeImagePaths).
const rawAnswers = (q) => [...new Set([...(q.markschemeImages ?? []), ...(q.officialMarkscheme?.images ?? [])])];

const banks = { [BANK]: {} }, objects = new Map();
for (const [qid, e] of Object.entries(pkg.entries)) {
  const q = runtime.get(qid);
  assert(q && /^[3-6]/.test(String(q.component)), `${qid}: not a written question of the runtime`);
  assert(earlier.every((o) => !o.banks[BANK]?.[qid]), `${qid}: already in an earlier row overlay`);
  assert(!(clean.banks[BANK] ?? {})[rawAnswers(q)[0]], `${qid}: has a clean-source re-render`);
  const oldPaths = rawAnswers(q);
  oldPaths.forEach((p) => assert(release.has(PREFIX + p), `${qid}: ${p} is not a released object`));
  // What students are served today: the 2026-10-02 written-answer repair.
  const served = scienceWritten[BANK]?.[qid]?.newPaths ?? oldPaths;
  assert(JSON.stringify(served.map((p) => PREFIX + p)) === JSON.stringify(e.servedPaths), `${qid}: package was built from different served crops`);
  // The first crop re-renders today's crop exactly; only the continuation is new content.
  assert(served.length === 1 && served[0].endsWith(`/${e.crops[0].sha256}.webp`), `${qid}: first crop is not today's crop`);
  assert(e.crops.length === 2 && e.crops[1].page === e.crops[0].page + 1, `${qid}: expected one continuation crop on the next page`);
  const newPaths = [];
  for (const crop of e.crops) {
    const local = join(research, 'build-a', 'images', `${crop.sha256}.webp`);
    const bytes = readFileSync(local);
    assert(sha256(bytes) === crop.sha256 && bytes.length === crop.bytes, `${qid}: candidate ${crop.sha256} bytes differ`);
    const path = `${namespace}/${crop.sha256}.webp`;
    newPaths.push(path);
    objects.set(PREFIX + path, { objectKey: PREFIX + path, sha256: crop.sha256, bytes: crop.bytes });
  }
  banks[BANK][qid] = { oldPaths, newPaths, sha256: e.crops.map((c) => c.sha256), sourcePdfSha256: e.sourcePdfSha256, missingRows: e.missingRows };
}

const overlay = {
  schema: 'reviewed-science-ms-continuation-repairs-v1',
  namespace,
  source: { research: 'research/science-ms-crop-audit-20261017/continuation-repair', packageSha256: sha256(packageBytes), builderSha256: pkg.builderSha256 },
  banks,
};
const sorted = [...objects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'science-ms-continuation-repairs-upload-v1',
  namespace,
  answerReplacementCount: Object.keys(banks[BANK]).length,
  objectCount: sorted.length,
  objectBytes: sorted.reduce((n, o) => n + o.bytes, 0),
  objects: sorted,
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, path), 'utf8') === text, `--check: ${path} is stale`);
  else writeFileSync(join(APP, path), text);
}
console.log(JSON.stringify({ check: CHECK, namespace, answers: manifest.answerReplacementCount, objects: manifest.objectCount, bytes: manifest.objectBytes }));
