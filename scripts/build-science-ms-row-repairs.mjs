#!/usr/bin/env node
// Reviewed science mark-scheme row repairs (Coordinated Sciences 0654). Written-paper answer crops that stop
// part-way through a mark-scheme table row, or miss a row continued on the next page, are replaced by crops
// of the question's own table rows from the pinned MS PDF. Built from the audit package in
// ../research/0654-ms-crop-audit-20261017 (audit.py, table_rows.py, build_repairs.py); see
// docs/science-ms-row-repairs.md. The finalized runtime and earlier overlays stay byte-identical.
//
// Writes:
//   src/data/reviewed-science-ms-row-repairs.json        overlay read by the app (old paths -> new paths)
//   data/storage/science-ms-row-repairs.manifest.json    unique new objects to upload (create-only)
//
// usage: node scripts/build-science-ms-row-repairs.mjs <repairs.json> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse-coordinated-sciences-0654';
const OUT = { overlay: 'src/data/reviewed-science-ms-row-repairs.json', manifest: 'data/storage/science-ms-row-repairs.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`science MS row repairs: ${reason}`); };

const packagePath = process.argv[2];
assert(packagePath, 'pass the repairs.json package path');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(packagePath);
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === '0654-ms-row-repairs-v1' && pkg.bank === BANK && pkg.scale === 1.5, 'unexpected package');
const namespace = `repairs/science-ms-rows-v1-${sha256(packageBytes).slice(0, 16)}`;
const images = join(dirname(packagePath), 'images');

const runtime = JSON.parse(readFileSync(join(APP, `src/data/production/${BANK}.json`)));
const byId = new Map(runtime.questions.map((q) => [q.id, q]));
const release = JSON.parse(readFileSync(join(APP, `data/storage/${BANK}.manifest.json`)));
const prefix = 'igcse-coordinated-sciences-0654/releases/full4721-v1-6b161eb9e580/';
const releaseSha = new Map(release.assets.map((a) => [a.objectKey, a.sha256]));
const earlier = JSON.parse(readFileSync(join(APP, 'src/data/reviewed-science-written-answer-repairs.json')))[BANK];

const entries = {};
const objects = new Map();
for (const [qid, e] of Object.entries(pkg.entries)) {
  const q = byId.get(qid);
  assert(q && /^[3-6]/.test(String(q.component)), `${qid}: not a written question of the runtime`);
  assert(!earlier[qid], `${qid}: already repaired by the science written-answer overlay`);
  assert(JSON.stringify(q.markschemeImages) === JSON.stringify(e.oldPaths), `${qid}: old paths are not the runtime's answer crops`);
  e.oldPaths.forEach((p, i) => assert(releaseSha.get(prefix + p) === e.oldSha256[i], `${qid}: ${p} is not the released object`));
  const newPaths = [];
  for (const crop of e.crops) {
    const bytes = readFileSync(join(images, `${crop.sha256}.webp`));
    assert(sha256(bytes) === crop.sha256 && bytes.length === crop.bytes, `${qid}: candidate ${crop.sha256} bytes differ`);
    const path = `${namespace}/${crop.sha256}.webp`;
    newPaths.push(path);
    objects.set(path, { objectKey: prefix + path, sha256: crop.sha256, bytes: crop.bytes, localPath: join(images, `${crop.sha256}.webp`) });
  }
  assert(new Set(newPaths).size === newPaths.length, `${qid}: duplicate crop`);
  entries[qid] = { oldPaths: e.oldPaths, oldSha256: e.oldSha256, newPaths, sha256: e.crops.map((c) => c.sha256), sourcePdfSha256: e.sourcePdfSha256, missingRows: e.missingRows };
}

const overlay = {
  schema: 'reviewed-science-ms-row-repairs-v1',
  namespace,
  source: { package: 'research/0654-ms-crop-audit-20261017/build-a/repairs.json', packageSha256: sha256(packageBytes), auditSha256: pkg.auditSha256, builderSha256: pkg.builderSha256 },
  banks: { [BANK]: entries },
};
const sorted = [...objects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const manifest = {
  schema: 'science-ms-row-repairs-upload-v1',
  bank: BANK,
  namespace,
  logicalReplacementCount: Object.keys(entries).length,
  imageReferenceCount: Object.values(entries).reduce((n, e) => n + e.newPaths.length, 0),
  objectCount: sorted.length,
  objectBytes: sorted.reduce((n, o) => n + o.bytes, 0),
  objects: sorted.map(({ objectKey, sha256, bytes }) => ({ objectKey, sha256, bytes })),
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, path), 'utf8') === text, `--check: ${path} is stale`);
  else writeFileSync(join(APP, path), text);
}
console.log(JSON.stringify({ check: CHECK, namespace, questions: manifest.logicalReplacementCount, images: manifest.imageReferenceCount, objects: manifest.objectCount, bytes: manifest.objectBytes }));
