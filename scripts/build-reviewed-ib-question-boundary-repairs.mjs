#!/usr/bin/env node
// Reviewed IB question-boundary repairs (docs/ib-question-boundary-repairs.md). In five Biology papers the segmenter took
// the answer-line label "2." inside Question 1's last answer box for the start of Question 2, so Question 2's crops
// carried the rest of Question 1. Both questions get crops cut at the real Question 2 anchor and their printed marks.
// Built from ../research/ib-bio-hl-2024-p3-q1-repair (build_boundaries.py).
//
// Writes:
//   src/data/reviewed-ib-question-boundary-repairs.json        overlay read by the app (old paths -> new paths)
//   data/storage/ib-question-boundary-repairs.manifest.json    unique new objects to upload (create-only)
//
// usage: node scripts/build-reviewed-ib-question-boundary-repairs.mjs <research repair dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const OUT = { overlay: 'src/data/reviewed-ib-question-boundary-repairs.json', manifest: 'data/storage/ib-question-boundary-repairs.manifest.json' };
const SOURCE_BASE = 'https://saksham106.github.io/ib-$1-topic-practice/';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`IB question-boundary repairs: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const research = process.argv[2];
assert(research, 'pass the repair package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(research, 'build-a', 'repairs.json'));
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === 'ib-question-boundary-repairs-v1' && pkg.scale === 1.75 && pkg.format === 'webp-lossless-exact', 'unexpected package');
const namespace = `repairs/ib-question-boundary-v1-${sha256(packageBytes).slice(0, 16)}`;
const packaged = new Map(pkg.objects.map((o) => [o.sha256, o]));

const banks = {}, objects = new Map();
for (const [bank, entries] of Object.entries(pkg.entries)) {
  assert(/^ib-biology-(hl|sl)$/.test(bank), `unexpected bank ${bank}`);
  const runtime = new Map(read(`src/data/production/${bank}.json`).questions.map((q) => [q.id, q]));
  const absolute = SOURCE_BASE.replace('$1', bank.split('-')[1]);
  banks[bank] = {};
  for (const [qid, e] of Object.entries(entries)) {
    const q = runtime.get(qid);
    assert(q, `${bank}:${qid} is not a runtime question`);
    // Runtime question paths are relative (questions/...) or, for the extension years, the public source URL of it.
    const oldPaths = q.questionImages;
    assert(Array.isArray(oldPaths) && oldPaths.length === e.servedPaths.length &&
      oldPaths.every((p, i) => p === e.servedPaths[i] || p === absolute + e.servedPaths[i]), `${bank}:${qid} runtime paths disagree with the package`);
    const newPaths = [], hashes = [];
    for (const r of e.repaired) {
      if (r.kept !== undefined) {
        const i = e.servedPaths.indexOf(r.kept);
        assert(i >= 0 && e.servedSha256[i] === r.sha256, `${bank}:${qid} kept crop is not a served crop`);
        newPaths.push(oldPaths[i]); hashes.push(r.sha256);
      } else {
        const o = packaged.get(r.new);
        assert(o, `${bank}:${qid} new crop ${r.new} is not in the package`);
        const bytes = readFileSync(join(research, 'build-a', 'images', `${o.sha256}.webp`));
        assert(sha256(bytes) === o.sha256 && bytes.length === o.bytes, `${bank}:${qid} candidate ${o.sha256} bytes differ`);
        const path = `${namespace}/${o.sha256}.webp`;
        newPaths.push(path); hashes.push(o.sha256);
        objects.set(`${bank}/${path}`, { objectKey: `${bank}/${path}`, sha256: o.sha256, bytes: o.bytes });
      }
    }
    assert(JSON.stringify(newPaths) !== JSON.stringify(oldPaths), `${bank}:${qid} unchanged`);
    assert(q.marks === e.marks.old && Number.isInteger(e.marks.new) && e.marks.new > 0, `${bank}:${qid} marks disagree with the package`);
    banks[bank][qid] = { oldPaths, oldSha256: e.servedSha256, newPaths, sha256: hashes, marks: e.marks };
  }
}

const overlay = {
  schema: 'reviewed-ib-question-boundary-repairs-v1',
  namespace,
  source: { research: 'research/ib-bio-hl-2024-p3-q1-repair', packageSha256: sha256(packageBytes), builderSha256: pkg.builderSha256, sources: pkg.sources },
  banks,
};
const sorted = [...objects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'ib-question-boundary-repairs-upload-v1',
  namespace,
  questionReplacementCount: Object.values(banks).reduce((n, e) => n + Object.keys(e).length, 0),
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
