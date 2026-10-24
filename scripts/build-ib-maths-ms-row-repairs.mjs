#!/usr/bin/env node
// Reviewed IB maths mark-scheme row repairs (docs/ib-maths-ms-row-repairs.md). The segmenter read a subscript as a
// question heading in two schemes, so ib-hl 2021-may-tz1-p1-q1 was served only Q2's last rows (Q2 the whole page),
// and ib-ai-hl 2024-may-tz1-p3-q2 started with Q1's (h) and (i) rows. Built from the package written by
// scripts/build-ib-maths-ms-row-repairs.py (two byte-identical builds, build-a and build-b).
//
// Writes:
//   src/data/reviewed-ib-maths-ms-row-repairs.json        overlay read by the app (old paths -> new paths)
//   data/storage/ib-maths-ms-row-repairs.manifest.json    new objects to upload (create-only)
//
// usage: node scripts/build-ib-maths-ms-row-repairs.mjs <research package dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANKS = ['ib-hl', 'ib-ai-hl'];
const OUT = { overlay: 'src/data/reviewed-ib-maths-ms-row-repairs.json', manifest: 'data/storage/ib-maths-ms-row-repairs.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`IB maths MS row repairs: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const research = process.argv[2];
assert(research && !research.startsWith('--'), 'pass the ib-maths-ms-row-repair package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(research, 'build-a', 'repairs.json'));
assert(packageBytes.equals(readFileSync(join(research, 'build-b', 'repairs.json'))), 'build-a and build-b differ');
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === 'ib-maths-ms-row-repairs-v1' && pkg.scale === 1.75 && JSON.stringify(Object.keys(pkg.entries)) === JSON.stringify(BANKS) &&
  BANKS.every((bank) => pkg.audit.after[bank].length === 0), 'unexpected package');
assert(pkg.builderSha256 === sha256(readFileSync(join(APP, 'scripts', 'build-ib-maths-ms-row-repairs.py'))), 'package was built by a different builder');
const namespace = `repairs/ib-maths-ms-rows-v1-${sha256(packageBytes).slice(0, 16)}`;

// Earlier sealed IB overlays keep their own cohorts; a question is repaired by one overlay only.
const sealed = { 'ib-hl': read('src/data/reviewed-ib-boundary-batch-repairs.json').banks['ib-hl'], 'ib-ai-hl': read('src/data/reviewed-ib-matrix-head-repairs.json').entries };
const reasons = {
  'ib-hl': {
    '2021-may-tz1-p1-q1': 'Served only Q2\'s last rows (u1 = -6, d = 2): an earlier anchor pass read the u1 subscript as the Q1 heading. Now all of 1(a) and 1(b), page 8 from the "1." label to the "2" label.',
    '2021-may-tz1-p1-q2': 'Served the whole of page 8, Q1 included. Now page 8 from the "2" label to the page bottom (Q3 starts on page 9).',
  },
  'ib-ai-hl': {
    '2024-may-tz1-p3-q1': 'Stopped at page 10 y 147.3 (the mu2 subscript read as the Q2 heading), losing the (h) hypotheses, p-value and conclusion and all of (i). Now runs to the end of page 11; pages 7-9 unchanged.',
    '2024-may-tz1-p3-q2': 'Started with Q1\'s (h) and (i) rows on pages 10-11. Now starts at the printed "2" on page 12; pages 13-14 unchanged.',
  },
};

const banks = {}, objects = new Map();
for (const bank of BANKS) {
  const raw = new Map(read(`src/data/raw/${bank}.json`).questions.map((q) => [q.id, q]));
  banks[bank] = {};
  for (const [qid, e] of Object.entries(pkg.entries[bank])) {
    const q = raw.get(qid);
    assert(q && !sealed[bank][qid], `${bank}:${qid}: not in the raw bank, or already repaired by a sealed overlay`);
    // The IB loader's answer list: both lists, concatenated (src/lib/questions.ts).
    const oldPaths = [...(q.markschemeImages ?? []), ...(q.officialMarkscheme?.images ?? [])];
    assert(JSON.stringify(oldPaths) === JSON.stringify(e.servedPaths), `${bank}:${qid}: package was built from different served paths`);
    // Every printed part mark of the question lies inside the repaired crops.
    assert(e.partMarks.reduce((n, m) => n + m, 0) === q.marks, `${bank}:${qid}: scheme part marks do not sum to ${q.marks}`);
    const oldSha256 = e.servedSha256;
    const newPaths = [], hashes = [];
    for (const crop of e.crops) {
      if (crop.method === 'kept') {
        // A kept crop is today's served object, unchanged.
        const i = oldSha256.indexOf(crop.sha256);
        assert(i >= 0, `${bank}:${qid}: kept crop ${crop.sha256} is not a served object`);
        newPaths.push(oldPaths[i]);
      } else {
        const bytes = readFileSync(join(research, 'build-a', 'images', `${crop.sha256}.webp`));
        assert(sha256(bytes) === crop.sha256 && bytes.length === crop.bytes, `${bank}:${qid}: candidate ${crop.sha256} bytes differ`);
        const path = `${namespace}/${crop.sha256}.webp`;
        newPaths.push(path);
        objects.set(`${bank}/${path}`, { objectKey: `${bank}/${path}`, sha256: crop.sha256, bytes: crop.bytes });
      }
      hashes.push(crop.sha256);
    }
    assert(new Set(newPaths).size === newPaths.length && JSON.stringify(newPaths) !== JSON.stringify(oldPaths), `${bank}:${qid}: no change or duplicate crops`);
    assert(reasons[bank][qid], `${bank}:${qid}: no reason recorded`);
    banks[bank][qid] = { oldPaths, oldSha256, newPaths, sha256: hashes, sourcePdfSha256: pkg.sources[bank].markScheme, reason: reasons[bank][qid] };
  }
}

const overlay = {
  schema: 'reviewed-ib-maths-ms-row-repairs-v1',
  namespace,
  source: { builder: 'scripts/build-ib-maths-ms-row-repairs.py', research: 'research/ib-maths-ms-row-repair-20261024', packageSha256: sha256(packageBytes), builderSha256: pkg.builderSha256 },
  banks,
};
const sorted = [...objects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'ib-maths-ms-row-repairs-upload-v1',
  namespace,
  answerReplacementCount: BANKS.reduce((n, bank) => n + Object.keys(banks[bank]).length, 0),
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
