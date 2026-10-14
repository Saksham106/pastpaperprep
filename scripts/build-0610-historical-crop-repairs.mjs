#!/usr/bin/env node
// Reviewed repair overlay for the historical Biology 0610 crops (2019, 2020, 2021-2025 and
// February/March 2026; the finalized 4,913-row release). The finalized runtime, its storage
// manifest and its verified receipt stay byte-identical: like the written-answer repair, the
// overlay projects exact old crop lists onto repaired lists at normalization time.
//
// Input: the source repository's repair package (igcse-biology-0610-topic-practice,
// data/segmentation/historical-crop-repairs/repairs.json), built from the reviewed crop-override
// ledgers. For every repaired question and role it lists the live crops and the repaired crops;
// a repaired crop is either a live crop kept as is (it keeps its released key) or a new crop,
// published under `repairs/historical-crops-v1-<package sha256[:16]>/<sha256>.webp`.
//
// Writes:
//   src/data/reviewed-biology-historical-crop-repairs.json   the overlay read by the app
//   data/storage/biology-historical-crop-repairs.manifest.json  new objects (upload plan) + kept objects
//   docs/0610-historical-crops-superseded-keys.json          released keys the overlay stops serving
//
// usage: PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT=<source checkout> node scripts/build-0610-historical-crop-repairs.mjs [--check]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const SOURCE = process.env.PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT;
if (!SOURCE) throw new Error('PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT is required');
const CHECK = process.argv.includes('--check');
const BANK = 'igcse-biology-0610';
const PACKAGE = 'data/segmentation/historical-crop-repairs/repairs.json';
const OUT = {
  overlay: 'src/data/reviewed-biology-historical-crop-repairs.json',
  manifest: 'data/storage/biology-historical-crop-repairs.manifest.json',
  superseded: 'docs/0610-historical-crops-superseded-keys.json',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => readFileSync(join(APP, path));
const json = (path) => JSON.parse(read(path));

const packageBytes = readFileSync(join(SOURCE, PACKAGE));
const pkg = JSON.parse(packageBytes);
if (pkg.artifact !== 'biology0610_historical_crop_repairs' || pkg.schema_version !== 1) throw new Error('unexpected source package');
const packageSha256 = sha256(packageBytes);
const namespace = `repairs/historical-crops-v1-${packageSha256.slice(0, 16)}`;
const sourceCommit = execFileSync('git', ['-C', SOURCE, 'log', '-1', '--format=%H', '--', PACKAGE], { encoding: 'utf8' }).trim();

const runtimeBytes = read(`src/data/production/${BANK}.json`);
const runtime = JSON.parse(runtimeBytes);
const releaseManifestBytes = read(`data/storage/${BANK}.manifest.json`);
const release = JSON.parse(releaseManifestBytes);
const releaseReceiptBytes = read(`data/storage/${BANK}.receipt.json`);
const releaseReceipt = JSON.parse(releaseReceiptBytes);
if (releaseReceipt.storageState !== 'verified_readback' || releaseReceipt.failed.length || releaseReceipt.completed.length !== release.assets.length) {
  throw new Error('the 0610 release receipt is not a complete verified readback');
}
const written = json('src/data/reviewed-biology-written-answer-repairs.json');
const blank = json('src/data/reviewed-blank-qp.json').entries[BANK] ?? {};
const retired = json('src/data/retired-question-crops.json')[BANK] ?? {};

const byId = new Map(runtime.questions.map((q) => [q.id, q]));
const releaseBySource = new Map();
for (const asset of release.assets) {
  const marker = asset.sourcePath.indexOf('/data/');
  releaseBySource.set(asset.sourcePath.slice(marker + 1), asset);
}
const releaseByKey = new Map(release.assets.map((a) => [a.objectKey.slice(release.objectPrefix.length), a]));
const verifiedKeys = new Set(releaseReceipt.completed);

function liveKeys(qid, role, live) {
  return live.map((crop) => {
    const asset = releaseBySource.get(crop.path);
    if (!asset || asset.sha256 !== crop.sha256 || !verifiedKeys.has(asset.objectKey)) throw new Error(`${qid} ${role}: live crop ${crop.path} is not a verified release object`);
    return asset.objectKey.slice(release.objectPrefix.length);
  });
}

const entries = {};
const newObjects = new Map();
const keptObjects = new Map();
const superseded = [];
const deferred = [];
const unique = (paths) => Array.from(new Set(paths));
for (const repair of pkg.repairs) {
  const qid = repair.question_id;
  const q = byId.get(qid);
  if (!q) throw new Error(`${qid}: not in the finalized runtime`);
  const entry = {};
  for (const role of ['question', 'markscheme']) {
    const crops = repair[role];
    if (!crops) continue;
    const raw = role === 'question' ? q.questionImages : unique([...q.markschemeImages, ...(q.officialMarkscheme?.images ?? [])]);
    const live = liveKeys(qid, role, crops.live);
    if (JSON.stringify(live) !== JSON.stringify(raw)) throw new Error(`${qid} ${role}: package live crops are not the runtime's crops`);
    if (role === 'markscheme' && written[qid]) {
      deferred.push(qid);
      continue;
    }
    const hidden = new Set(role === 'question' ? [...(blank[qid] ?? []).map((b) => b.path), ...(retired[qid] ?? [])] : []);
    const oldPaths = raw.filter((path) => !hidden.has(path));
    const newPaths = [];
    const newSha = [];
    for (const crop of crops.repaired) {
      if (crop.status === 'kept') {
        const key = live[crops.live.findIndex((l) => l.path === crop.path)];
        if (!key) throw new Error(`${qid} ${role}: kept crop ${crop.path} is not live`);
        if (hidden.has(key)) continue; // a reviewed BLANK PAGE / furniture crop stays hidden
        newPaths.push(key);
        newSha.push(crop.sha256);
        keptObjects.set(key, releaseByKey.get(key));
      } else {
        if (crop.blank_page) continue; // a printed BLANK PAGE is never served
        const path = `${namespace}/${crop.sha256}.webp`;
        const bytes = readFileSync(join(SOURCE, crop.path));
        if (sha256(bytes) !== crop.sha256 || bytes.length !== crop.bytes) throw new Error(`${crop.path}: bytes differ from the package`);
        newPaths.push(path);
        newSha.push(crop.sha256);
        newObjects.set(path, { objectKey: `${release.objectPrefix}${path}`, relativePath: path, sourcePath: crop.path, sha256: crop.sha256, size: crop.bytes, contentType: 'image/webp' });
      }
    }
    if (!newPaths.length || JSON.stringify(newPaths) === JSON.stringify(oldPaths)) throw new Error(`${qid} ${role}: repair would serve nothing or nothing new`);
    entry[role] = { oldPaths, oldSha256: oldPaths.map((p) => releaseByKey.get(p).sha256), newPaths, sha256: newSha };
    for (const path of oldPaths) if (!newPaths.includes(path)) superseded.push({ questionId: qid, role, objectKey: `${release.objectPrefix}${path}`, sha256: releaseByKey.get(path).sha256 });
  }
  const printed = repair.qp_printed_marks;
  if (printed && printed.marks_status === 'printed_qp_total' && printed.marks !== q.marks) {
    if (!Number.isInteger(printed.marks) || printed.marks <= 0) throw new Error(`${qid}: unusable printed total`);
    const page = repair.question.repaired.at(-1).source_page;
    entry.marks = { old: q.marks, new: printed.marks, evidence: `The repaired question crop shows the printed [Total: ${printed.marks}] on QP page ${page}; the stored ${q.marks} counted only the parts the cut-off crop showed.` };
  }
  if (Object.keys(entry).length) entries[qid] = entry;
}

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
const overlay = {
  schema: 'reviewed-biology-historical-crop-repairs-v1',
  bank: BANK,
  namespace,
  source: { repository: 'igcse-biology-0610-topic-practice', commit: sourceCommit, package: PACKAGE, packageSha256 },
  entries: sorted(entries),
};
const assets = [...newObjects.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const kept = [...keptObjects.values()].map((a) => ({ objectKey: a.objectKey, sha256: a.sha256, size: a.size })).sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const count = (role) => Object.values(entries).filter((e) => e[role]).length;
const manifest = {
  schemaVersion: 'reviewed-biology-historical-crop-repairs-v1',
  state: 'pending_upload',
  bank: BANK,
  objectPrefix: release.objectPrefix,
  namespace,
  source: overlay.source,
  runtimeSha256: sha256(runtimeBytes),
  releaseAssetManifestSha256: sha256(releaseManifestBytes),
  releaseReceiptSha256: sha256(releaseReceiptBytes),
  counts: {
    questions: Object.keys(entries).length,
    questionLists: count('question'),
    markschemeLists: count('markscheme'),
    marks: count('marks'),
    newObjects: assets.length,
    newBytes: assets.reduce((total, a) => total + a.size, 0),
    keptObjects: kept.length,
    supersededKeys: superseded.length,
    markschemeDeferredToWrittenAnswerRepair: deferred.length,
  },
  markschemeDeferredToWrittenAnswerRepair: deferred.sort(),
  assets,
  kept,
};
const supersededDoc = {
  note: 'Released objects the historical crop overlay stops serving. They stay in the bucket and in the finalized release manifest (historical evidence); deleting them needs owner approval.',
  overlaySha256: null,
  count: superseded.length,
  keys: superseded.sort((a, b) => a.objectKey.localeCompare(b.objectKey) || a.questionId.localeCompare(b.questionId)),
};
const outputs = {};
outputs[OUT.overlay] = `${JSON.stringify(overlay, null, 1)}\n`;
supersededDoc.overlaySha256 = sha256(outputs[OUT.overlay]);
outputs[OUT.manifest] = `${JSON.stringify(manifest, null, 2)}\n`;
outputs[OUT.superseded] = `${JSON.stringify(supersededDoc, null, 2)}\n`;
for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) {
    if (read(path).toString() !== text) throw new Error(`--check: ${path} is stale`);
  } else {
    writeFileSync(join(APP, path), text);
  }
}
console.log(JSON.stringify({ check: CHECK, namespace, ...manifest.counts }));
