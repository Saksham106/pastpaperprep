#!/usr/bin/env node
// Reviewed mark-scheme row repairs for 0455-2022-s-21 (docs/economics-ms-row-repairs.md). Cambridge's scheme leaves the
// 4(a) row unlabelled and prints 4(b) and 4(c) as "4(d)", so Q3 was served the 4(a) row and Q4 started at 4(b); Q2's
// last crop also showed the top of the 3(a) row. Built from the package written by
// scripts/build-economics-ms-row-repairs.py (two byte-identical builds, build-a and build-b).
//
// Writes:
//   src/data/reviewed-economics-ms-row-repairs.json        overlay read by the app (old paths -> new paths)
//   data/storage/economics-ms-row-repairs.manifest.json    new objects to upload (create-only)
//
// usage: node scripts/build-economics-ms-row-repairs.mjs <research package dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse-economics-0455';
const PREFIX = 'igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/';
const OUT = { overlay: 'src/data/reviewed-economics-ms-row-repairs.json', manifest: 'data/storage/economics-ms-row-repairs.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`Economics MS row repairs: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const research = process.argv[2];
assert(research, 'pass the economics-ms-row-repair package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(research, 'build-a', 'repairs.json'));
assert(packageBytes.equals(readFileSync(join(research, 'build-b', 'repairs.json'))), 'build-a and build-b differ');
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === 'economics-ms-row-repairs-v1' && pkg.bank === BANK && pkg.scale === 1.5 && pkg.audit.after.length === 0, 'unexpected package');
assert(pkg.builderSha256 === sha256(readFileSync(join(APP, 'scripts', 'build-economics-ms-row-repairs.py'))), 'package was built by a different builder');
const namespace = `repairs/economics-ms-rows-v1-${sha256(packageBytes).slice(0, 16)}`;

const runtime = new Map(read(`src/data/production/${BANK}.json`).questions.map((q) => [q.id, q]));
const release = new Map(read(`data/storage/${BANK}.manifest.json`).assets.map((a) => [a.objectKey, a.sha256]));
const written = read('src/data/reviewed-economics-written-answer-repairs.json')[BANK];
// The loader's answer list before the reviewed overlays: private banks de-duplicate the two lists (src/lib/questions.ts).
const rawAnswers = (q) => [...new Set([...(q.markschemeImages ?? []), ...(q.officialMarkscheme?.images ?? [])])];

const entries = {}, objects = new Map();
for (const [qid, e] of Object.entries(pkg.entries)) {
  const q = runtime.get(qid);
  assert(q && q.paper === 2, `${qid}: not a Paper 2 question of the runtime`);
  const oldPaths = rawAnswers(q);
  const oldSha256 = oldPaths.map((p) => release.get(PREFIX + p));
  assert(oldSha256.every(Boolean) && JSON.stringify(oldSha256) === JSON.stringify(q.markschemeImageHashes), `${qid}: raw answers are not the released objects`);
  // What students are served today: the 2026-10-02 written-answer repair where it applies, else the release.
  const served = written[qid]?.sha256 ?? oldSha256;
  assert(JSON.stringify(served) === JSON.stringify(e.servedSha256), `${qid}: package was built from different served crops`);
  const newPaths = [], hashes = [];
  for (const crop of e.crops) {
    if (crop.method === 'kept') {
      // A kept crop is today's released object, unchanged.
      const i = oldSha256.indexOf(crop.sha256);
      assert(i >= 0 && !written[qid], `${qid}: kept crop ${crop.sha256} is not a served release object`);
      newPaths.push(oldPaths[i]);
    } else {
      const bytes = readFileSync(join(research, 'build-a', 'images', `${crop.sha256}.webp`));
      assert(sha256(bytes) === crop.sha256 && bytes.length === crop.bytes, `${qid}: candidate ${crop.sha256} bytes differ`);
      const path = `${namespace}/${crop.sha256}.webp`;
      newPaths.push(path);
      objects.set(PREFIX + path, { objectKey: PREFIX + path, sha256: crop.sha256, bytes: crop.bytes });
    }
    hashes.push(crop.sha256);
  }
  assert(new Set(newPaths).size === newPaths.length && JSON.stringify(newPaths) !== JSON.stringify(oldPaths), `${qid}: no change or duplicate crops`);
  entries[qid] = { oldPaths, oldSha256, newPaths, sha256: hashes, sourcePdfSha256: pkg.sources.markScheme, reason: e.reason };
}

const overlay = {
  schema: 'reviewed-economics-ms-row-repairs-v1',
  bank: BANK,
  namespace,
  source: { builder: 'scripts/build-economics-ms-row-repairs.py', research: 'research/economics-ms-row-repair-20261023', packageSha256: sha256(packageBytes), builderSha256: pkg.builderSha256 },
  officialSchemeGaps: pkg.officialSchemeGaps,
  entries,
};
const sorted = [...objects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'economics-ms-row-repairs-upload-v1',
  namespace,
  answerReplacementCount: Object.keys(entries).length,
  objectCount: sorted.length,
  objectBytes: sorted.reduce((n, o) => n + o.bytes, 0),
  objects: sorted,
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay, null, 1)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, path), 'utf8') === text, `--check: ${path} is stale`);
  else writeFileSync(join(APP, path), text);
}
console.log(JSON.stringify({ check: CHECK, namespace, answers: manifest.answerReplacementCount, objects: manifest.objectCount, bytes: manifest.objectBytes }));
