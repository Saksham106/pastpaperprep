#!/usr/bin/env node
// Reviewed CS 0478 false-barcode-mask repairs (docs/cs-0478-false-mask-repairs.md). The segmenter painted white any
// text block whose glyphs were mostly above U+2000, to hide the barcode strip; curly-quoted input data and ellipsis
// answer leaders (with their printed marks) were painted out of five question crops too. Each repaired crop is a
// re-render with only the true barcode masks. Built from ../research/cs-0478-false-barcode-masks (build_mask_repairs.py).
//
// Writes:
//   src/data/reviewed-cs-0478-mask-repairs.json          overlay read by the app (old paths -> new paths)
//   data/storage/cs-0478-mask-repairs.manifest.json      unique new objects to upload (create-only)
//
// usage: node scripts/build-reviewed-cs-0478-mask-repairs.mjs <research repair dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse-computer-science-0478';
const RELEASE = 'igcse-computer-science-0478/releases/full469-v1-0eb04c612b39';
const OUT = { overlay: 'src/data/reviewed-cs-0478-mask-repairs.json', manifest: 'data/storage/cs-0478-mask-repairs.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`CS 0478 mask repairs: ${reason}`); };

const research = process.argv[2];
assert(research, 'pass the repair package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(research, 'build-a', 'repairs.json'));
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === 'cs-0478-false-mask-repairs-v1' && pkg.scale === 1.5 && pkg.format === 'webp-lossless-method6', 'unexpected package');
const namespace = `repairs/cs-0478-false-masks-v1-${sha256(packageBytes).slice(0, 16)}`;
const packaged = new Map(pkg.objects.map((o) => [o.sha256, o]));
const runtime = new Map(JSON.parse(readFileSync(join(APP, `src/data/production/${BANK}.json`), 'utf8')).questions.map((q) => [q.id, q]));

const questions = {}, objects = [];
for (const [qid, e] of Object.entries(pkg.entries)) {
  const q = runtime.get(qid);
  assert(q, `${qid} is not a runtime question`);
  assert(JSON.stringify(q.questionImages) === JSON.stringify(e.servedPaths) &&
    JSON.stringify(q.questionImageHashes) === JSON.stringify(e.servedSha256), `${qid} runtime crops disagree with the package`);
  assert(e.repaired.length === e.servedPaths.length && e.falseMasks.length > 0, `${qid} malformed entry`);
  const newPaths = [], hashes = [];
  e.repaired.forEach((r, i) => {
    if (r.kept !== undefined) {
      assert(r.kept === e.servedPaths[i] && r.sha256 === e.servedSha256[i], `${qid} kept crop is not the served crop`);
      newPaths.push(r.kept); hashes.push(r.sha256);
      return;
    }
    const o = packaged.get(r.new);
    assert(o && o.questionId === qid && o.replaces === e.servedPaths[i], `${qid} new crop ${r.new} is not packaged for this position`);
    const bytes = readFileSync(join(research, 'build-a', 'images', `${o.sha256}.webp`));
    assert(sha256(bytes) === o.sha256 && bytes.length === o.bytes, `${qid} candidate ${o.sha256} bytes differ`);
    const path = `${namespace}/${o.sha256}.webp`;
    newPaths.push(path); hashes.push(o.sha256);
    objects.push({ objectKey: `${RELEASE}/${path}`, sha256: o.sha256, bytes: o.bytes });
  });
  assert(newPaths.some((p, i) => p !== e.servedPaths[i]), `${qid} unchanged`);
  questions[qid] = { oldPaths: e.servedPaths, oldSha256: e.servedSha256, newPaths, sha256: hashes, falseMaskCount: e.falseMasks.length };
}

const overlay = {
  schema: 'reviewed-cs-0478-mask-repairs-v1',
  bank: BANK,
  namespace,
  source: { research: 'research/cs-0478-false-barcode-masks', packageSha256: sha256(packageBytes), builderSha256: pkg.builderSha256, segmentSha256: pkg.segmentSha256, sources: pkg.sources },
  questions,
};
const sorted = objects.sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'cs-0478-mask-repairs-upload-v1',
  namespace,
  questionReplacementCount: Object.keys(questions).length,
  objectCount: sorted.length,
  objectBytes: sorted.reduce((n, o) => n + o.bytes, 0),
  objects: sorted,
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay, null, 1)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, path), 'utf8') === text, `--check: ${path} is stale`);
  else writeFileSync(join(APP, path), text);
}
console.log(JSON.stringify({ check: CHECK, namespace, questions: manifest.questionReplacementCount, objects: manifest.objectCount, bytes: manifest.objectBytes }));
