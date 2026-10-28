#!/usr/bin/env node
// Reviewed crop repairs of 2026-10-27 (docs/ib-crop-repairs-v2.md), projected from the deterministic package that
// scripts/ib-crop-repairs-v2/build_crops.py writes. Four families, each its own overlay and storage manifest:
//
//   chemMs      src/data/reviewed-ib-chemistry-rotated-ms-repairs.json    IB Chemistry 2017-2019 rotated mark schemes
//   stimulus    src/data/reviewed-ib-shared-stimulus-repairs-v2.json      IB Chemistry shared stimuli
//   boundary    src/data/reviewed-ib-question-boundary-repairs-v2.json    IB Physics Paper 1 option-D boundaries
//   additional  src/data/reviewed-0606-ms-continuation-repairs.json       0606 mark-scheme continuation rows
//
// and data/storage/<family>.manifest.json for each (unique new objects, create-only). Every old path is checked against
// the raw runtime, every new object's bytes against its SHA-256, and kept crops against the verified upload manifests.
//
// usage: node scripts/build-reviewed-ib-crop-repairs-v2.mjs <package dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`IB crop repairs v2: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));
const dir = process.argv[2];
assert(dir && !dir.startsWith('--'), 'pass the package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(dir, 'repairs.json'));
const pkg = JSON.parse(packageBytes);
assert(pkg.schema === 'ib-crop-repairs-v2-package', 'unexpected package');
const builderSha256 = sha256(readFileSync(join(APP, 'scripts/ib-crop-repairs-v2/build_crops.py')));
assert(pkg.builderSha256 === builderSha256, 'package was built by a different build_crops.py');
const source = { package: 'research/ib-crop-repairs-v2 (built by scripts/ib-crop-repairs-v2/build_crops.py)', packageSha256: sha256(packageBytes), builderSha256 };
const V1_STIMULUS = read('src/data/reviewed-ib-shared-stimulus-repairs.json');
const FREE_YEARS = { 'ib-chemistry-hl': [2016, 2017, 2018, 2019, 2020], 'ib-chemistry-sl': [2016, 2017, 2018, 2019, 2020], 'ib-physics-hl': [2016, 2017, 2018, 2019, 2020], 'ib-physics-sl': [2016, 2017, 2018, 2019, 2020], 'igcse-additional': [2016, 2017, 2018] };
const yearOf = (id) => Number((/^(?:\d{4}-)?(\d{4})-/.exec(id) ?? [])[1]);

const runtimes = new Map();
function runtime(bank) {
  if (!runtimes.has(bank)) runtimes.set(bank, new Map(read(`src/data/raw/${bank}.json`).questions.map((q) => [q.id, q])));
  return runtimes.get(bank);
}
const verifiedHashes = new Map();
function verifiedHash(bank, url) {
  if (!verifiedHashes.has(bank)) {
    const m = read(`docs/ib-science-storage/${bank}.pending-upload-manifest.json`);
    verifiedHashes.set(bank, new Map(m.assets.map((a) => [a.objectKey, a.sha256])));
  }
  return verifiedHashes.get(bank).get(url.replace(/^https:\/\/saksham106\.github\.io\/ib-[a-z]+-topic-practice\//, ''));
}
const receipt = read('docs/ib-science-storage/ib-science-r2-upload-receipt.json');
assert(receipt.status === 'verified-readback' && receipt.failures === 0, 'IB science upload receipt is not verified');

function objectsOf(family, name) {
  const byPath = new Map();
  for (const o of family.objects) {
    const bytes = readFileSync(join(dir, 'objects', o.objectKey));
    assert(sha256(bytes) === o.sha256 && bytes.length === o.bytes, `${o.objectKey} bytes differ`);
    assert(o.path === `${family.namespace}/${o.sha256}.webp` && o.objectKey === `${o.bank}/${o.path}`, `${o.objectKey} key`);
    byPath.set(o.objectKey, o);
  }
  assert(byPath.size === family.objects.length, `${name}: duplicate objects`);
  return byPath;
}

const outputs = {};
const summary = {};
function emit(name, overlayPath, manifestPath, overlay, family, objects, used) {
  const sorted = [...objects.values()].filter((o) => used.has(o.objectKey)).sort((a, b) => a.objectKey.localeCompare(b.objectKey));
  assert(sorted.length === objects.size, `${name}: unreferenced objects in the package`);
  const manifest = {
    schema: 'reviewed-crop-repairs-upload-v1',
    namespace: family.namespace,
    privateBucket: 'pastpaperprep-assets',
    ...(name === 'additional' ? { supabaseBucket: 'question-assets' } : {}),
    publicFreeBucket: 'pastpaperprep-free',
    objectCount: sorted.length,
    freeObjectCount: sorted.filter((o) => o.freeYear).length,
    objectBytes: sorted.reduce((n, o) => n + o.bytes, 0),
    objects: sorted.map((o) => ({ objectKey: o.objectKey, path: o.path, sha256: o.sha256, bytes: o.bytes, contentType: 'image/webp', width: o.width, height: o.height, questionIds: [...o.questionIds].sort(), freeYear: o.freeYear })),
  };
  outputs[overlayPath] = `${JSON.stringify(overlay, null, 1)}\n`;
  outputs[manifestPath] = `${JSON.stringify(manifest, null, 1)}\n`;
  summary[name] = { namespace: family.namespace, objects: manifest.objectCount, freeObjects: manifest.freeObjectCount, bytes: manifest.objectBytes };
}

// Bank-keyed families: old paths are the raw runtime list, kept paths keep their verified hash, new paths are packaged.
function banked(name, overlayPath, manifestPath, schema, role, extra = () => ({}), allowPath = () => false) {
  const family = pkg.families[name];
  const objects = objectsOf(family, name);
  const used = new Set();
  const banks = {};
  for (const [bank, entries] of Object.entries(family.entries).sort()) {
    banks[bank] = {};
    for (const [qid, e] of Object.entries(entries).sort()) {
      if (qid.startsWith('_')) continue;
      const q = runtime(bank).get(qid);
      assert(q, `${bank}:${qid} is not a runtime question`);
      const raw = role === 'question' ? q.questionImages : [...new Set([...(q.markschemeImages ?? []), ...(q.officialMarkscheme?.images ?? [])])];
      assert(JSON.stringify(raw) === JSON.stringify(e.oldPaths), `${bank}:${qid} runtime paths disagree with the package`);
      e.oldPaths.forEach((p, i) => assert(verifiedHash(bank, p) === e.oldSha256[i], `${bank}:${qid} old hash ${p}`));
      assert(e.newPaths.length === e.sha256.length && e.newPaths.length >= 1 && new Set(e.newPaths).size === e.newPaths.length, `${bank}:${qid} shape`);
      e.newPaths.forEach((p, i) => {
        const kept = e.oldPaths.indexOf(p);
        if (kept >= 0) return assert(e.oldSha256[kept] === e.sha256[i], `${bank}:${qid} kept hash`);
        if (allowPath(bank, p, e.sha256[i])) return;
        const o = objects.get(`${bank}/${p}`);
        assert(o && o.sha256 === e.sha256[i], `${bank}:${qid} new path ${p} is not packaged`);
        used.add(o.objectKey);
        o.questionIds = [...new Set([...(o.questionIds ?? []), qid])];
        o.freeYear = Boolean(o.freeYear) || FREE_YEARS[bank].includes(yearOf(qid));
      });
      assert(JSON.stringify(e.newPaths) !== JSON.stringify(e.oldPaths), `${bank}:${qid} unchanged`);
      banks[bank][qid] = { oldPaths: e.oldPaths, oldSha256: e.oldSha256, newPaths: e.newPaths, sha256: e.sha256, ...extra(e) };
    }
  }
  const overlay = { schema, namespace: family.namespace, source, banks };
  return { overlay, family, objects, used };
}

{
  const r = banked('chemMs', null, null, 'reviewed-ib-chemistry-rotated-ms-repairs-v1', 'markscheme', (e) => ({ pages: e.pages }));
  assert(/^repairs\/ib-chem-rotated-ms-v1-[a-f0-9]{16}$/.test(r.family.namespace), 'chemMs namespace');
  for (const e of Object.values(r.overlay.banks).flatMap((b) => Object.values(b))) assert(e.newPaths.every((p) => p.startsWith(`${r.family.namespace}/`)), 'chemMs keeps no old crop');
  r.overlay.reason = 'IB Chemistry 2017-2019 mark schemes store landscape pages with /Rotate 90. The source lane normalised them with show_pdf_page, which shrank each page to 70.69 % and clipped its left third, so every answer crop lost the Question column and the start of the Answers column. Re-cut from the original PDFs in display orientation with the source engine\'s own anchor and region rules.';
  emit('chemMs', 'src/data/reviewed-ib-chemistry-rotated-ms-repairs.json', 'data/storage/ib-chemistry-rotated-ms-repairs.manifest.json', r.overlay, r.family, r.objects, r.used);
}
{
  // Reused v1 stimulus objects are already in R2 under the v1 namespace.
  const v1Hashes = new Set(Object.values(V1_STIMULUS.banks).flatMap((b) => Object.values(b).flatMap((e) => e.sha256)));
  const reuse = (bank, p, h) => p === `${V1_STIMULUS.namespace}/${h}.webp` && v1Hashes.has(h) && ['ib-chemistry-hl', 'ib-chemistry-sl'].includes(bank);
  const r = banked('stimulus', null, null, 'reviewed-ib-shared-stimulus-repairs-v2', 'question', () => ({}), reuse);
  assert(/^repairs\/ib-shared-stimulus-v2-[a-f0-9]{16}$/.test(r.family.namespace), 'stimulus namespace');
  for (const [bank, entries] of Object.entries(r.overlay.banks)) for (const qid of Object.keys(entries)) assert(!V1_STIMULUS.banks[bank]?.[qid], `${bank}:${qid} is already in the v1 overlay`);
  r.overlay.reuses = V1_STIMULUS.namespace;
  emit('stimulus', 'src/data/reviewed-ib-shared-stimulus-repairs-v2.json', 'data/storage/ib-shared-stimulus-repairs-v2.manifest.json', r.overlay, r.family, r.objects, r.used);
}
{
  const r = banked('boundary', null, null, 'reviewed-ib-question-boundary-repairs-v2', 'question', (e) => ({ marks: e.marks }));
  assert(/^repairs\/ib-question-boundary-v2-[a-f0-9]{16}$/.test(r.family.namespace), 'boundary namespace');
  for (const [bank, entries] of Object.entries(r.overlay.banks)) for (const [qid, e] of Object.entries(entries)) assert(e.marks.old === runtime(bank).get(qid).marks && e.marks.new === e.marks.old, `${bank}:${qid} marks`);
  emit('boundary', 'src/data/reviewed-ib-question-boundary-repairs-v2.json', 'data/storage/ib-question-boundary-repairs-v2.manifest.json', r.overlay, r.family, r.objects, r.used);
}
{
  // 0606 entries are bound to the paths served after the source-grid and right-edge overlays.
  const family = pkg.families.additional;
  assert(/^repairs\/0606-ms-continuation-v1-[a-f0-9]{16}$/.test(family.namespace), 'additional namespace');
  const objects = objectsOf(family, 'additional');
  const maths = read('src/data/reviewed-maths-source-answer-repairs.json')['igcse-additional'];
  const edge = read('src/data/reviewed-0606-ms-right-edge-repairs.json').entries;
  const used = new Set();
  const entries = {};
  for (const [qid, e] of Object.entries(family.entries).sort()) {
    const raw = runtime('igcse-additional').get(qid)?.markschemeImages;
    assert(raw, `${qid} is not a runtime question`);
    assert(!edge[qid], `${qid} has a right-edge repair`);
    const served = maths[qid] ? maths[qid].newPaths : raw;
    assert(JSON.stringify(served) === JSON.stringify(e.oldPaths), `${qid} served paths disagree with the package`);
    const printGeometry = e.newPaths.map((p, i) => {
      if (e.oldPaths.includes(p)) return assert(e.oldSha256[e.oldPaths.indexOf(p)] === e.sha256[i], `${qid} kept hash`), null;
      const o = objects.get(`igcse-additional/${p}`);
      assert(o && o.sha256 === e.sha256[i], `${qid} new path ${p} is not packaged`);
      used.add(o.objectKey);
      o.questionIds = [qid];
      o.freeYear = FREE_YEARS['igcse-additional'].includes(yearOf(qid));
      const s = e.segments[i];
      assert(s && s.size[0] === o.width && s.size[1] === o.height, `${qid} segment geometry`);
      const [x0, y0, x1, y1] = s.rectPt;
      const h = Math.round((y1 - y0) * 100) / 100;
      return { physicalSizePt: [Math.round((x1 - x0) * 100) / 100, h], imageDimensions: s.size, segments: [[0, s.size[1], h, s.page]] };
    });
    entries[qid] = { oldPaths: e.oldPaths, oldSha256: e.oldSha256, newPaths: e.newPaths, sha256: e.sha256, printGeometry };
  }
  const overlay = { schema: 'reviewed-0606-ms-continuation-repairs-v1', bank: 'igcse-additional', namespace: family.namespace, source, reason: 'Mark-scheme rows on the next or previous page that the served crop left out: 2019 Nov 23 6(ii) final A1 (page 6) and 2017 June 21 9(i) (page 5, dropped by the source-grid repair).', entries };
  emit('additional', 'src/data/reviewed-0606-ms-continuation-repairs.json', 'data/storage/0606-ms-continuation-repairs.manifest.json', overlay, family, objects, used);
}

for (const [path, text] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, path), 'utf8') === text, `--check: ${path} is stale`);
  else writeFileSync(join(APP, path), text);
}
console.log(JSON.stringify({ check: CHECK, packageSha256: source.packageSha256, summary }));
