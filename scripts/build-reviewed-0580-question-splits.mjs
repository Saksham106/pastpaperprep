#!/usr/bin/env node
// Reviewed 0580 question splits (docs/0580-question-splits.md). In 0580-2020-june-41 the 6(c) grid's y-axis label
// "7" sits in the question-number column and was taken as the Question 7 heading, so Q6 was served cut off mid-grid
// with 3 marks and Q7 began with the rest of 6(c) and all of 6(d), with 24 marks. The source repository re-cuts both
// at the real Question 7 heading through a reviewed boundary override; this projects those two crops, their printed
// marks (10 and 17) and their transcripts into the app. The raw bank, its seals and every storage receipt are unchanged.
//
// Writes:
//   src/data/reviewed-0580-question-splits.json        overlay read by the app
//   data/storage/0580-question-splits.manifest.json    new objects to upload (create-only)
//
// usage: node scripts/build-reviewed-0580-question-splits.mjs <igcse-0580-topic-practice checkout> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGeometry } from './generate-print-geometry-0580.mjs';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse';
const PAPER = '0580-2020-june-41';
const IDS = [`${PAPER}-q6`, `${PAPER}-q7`];
// The original question paper the re-cut was reviewed against (Best Exam Help, the manifest's pinned source).
const QUESTION_PDF_SHA256 = '53144f655d86f073ab49ea8bd396ac52a0bde684aaccf26e5b7c5b8bd004a710';
const OUT = { overlay: 'src/data/reviewed-0580-question-splits.json', manifest: 'data/storage/0580-question-splits.manifest.json' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`0580 question split: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const source = process.argv[2];
assert(source, 'pass the igcse-0580-topic-practice checkout');
const CHECK = process.argv.includes('--check');
const override = JSON.parse(readFileSync(join(source, 'data/crop-boundary-overrides.json'), 'utf8')).overrides[PAPER];
assert(override?.question && Object.keys(override.question).join() === '7', 'source has no reviewed Question 7 boundary override');
const registry = new Map(JSON.parse(readFileSync(join(source, 'data/question-images.json'), 'utf8')).images.map((image) => [image.id, image]));
const paper = JSON.parse(readFileSync(join(source, `data/papers/${PAPER}.json`), 'utf8'));
const transcripts = new Map(paper.questions.map((q) => [q.id, q]));
assert(paper.questions.reduce((n, q) => n + q.marks, 0) === paper.paper.maximum_marks, 'source paper does not total its maximum');

const images = IDS.map((id) => {
  const image = registry.get(id);
  assert(image?.source_pdf === `data/raw/2020/${PAPER}-question.pdf`, `${id} has no source crop`);
  const bytes = readFileSync(join(source, image.path));
  assert(sha256(bytes) === image.sha256, `${image.path} bytes differ from the source registry`);
  return { image, bytes };
});
const packageJson = JSON.stringify({ paper: PAPER, questionPdfSha256: QUESTION_PDF_SHA256, override,
  crops: images.map(({ image }) => ({ id: image.id, sha256: image.sha256, width: image.width, height: image.height, source_pages: image.source_pages, bounds_pt: image.bounds_pt })) });
const packageSha256 = sha256(packageJson);
const namespace = `repairs/0580-question-split-v1-${packageSha256.slice(0, 16)}`;

const raw = read(`src/data/raw/${BANK}.json`);
const historical = read('src/data/print-geometry-0580.json').entries;
const rows = raw.questions.filter((q) => q.id.startsWith(`${PAPER}-`));
assert(rows.reduce((n, q) => n + q.marks, 0) === paper.paper.maximum_marks, 'served paper does not total its maximum');
const entries = {};
const objects = [];
for (const { image, bytes } of images) {
  const row = rows.find((q) => q.id === image.id);
  const oldPath = `questions/${image.id}.webp`;
  assert(row && JSON.stringify(row.questionImages) === JSON.stringify([oldPath]), `${image.id} raw row disagrees`);
  const oldSha256 = historical[image.id]?.[0]?.[1];
  assert(historical[image.id]?.[0]?.[0] === oldPath && oldSha256 !== image.sha256, `${image.id} pinned geometry is not the served crop`);
  const transcript = transcripts.get(image.id);
  const printed = [...transcript.accessible_text.matchAll(/\[\s*(\d+)\s*\]/g)].map((m) => Number(m[1]));
  assert(printed.reduce((n, m) => n + m, 0) === transcript.marks && transcript.accessible_text.startsWith(`${image.id.split('-q').at(-1)} `), `${image.id} transcript is not its own question`);
  const path = `${namespace}/${image.sha256}.webp`;
  const [geometry] = Object.values(buildGeometry([['question', [{ ...image, path }]]], []).entries);
  entries[image.id] = {
    oldPaths: [oldPath], oldSha256: [oldSha256], newPaths: [path], sha256: [image.sha256],
    marks: { old: row.marks, new: transcript.marks, printed },
    accessibleText: { oldSha256: sha256(row.accessibleText), text: transcript.accessible_text },
    printGeometry: geometry[0],
  };
  objects.push({ objectKey: `${BANK}/${path}`, sha256: image.sha256, bytes: bytes.length, sourcePath: image.path });
}

const overlay = {
  schema: 'reviewed-0580-question-splits-v1',
  bank: BANK,
  namespace,
  source: { repository: 'Saksham106/igcse-0580-topic-practice', packageSha256, questionPdfSha256: QUESTION_PDF_SHA256, override },
  entries,
};
const manifest = {
  schema: '0580-question-splits-upload-v1',
  namespace,
  questionReplacementCount: IDS.length,
  objectCount: objects.length,
  objectBytes: objects.reduce((n, o) => n + o.bytes, 0),
  objects,
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay, null, 1)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [file, content] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, file), 'utf8') === content, `--check: ${file} is stale`);
  else writeFileSync(join(APP, file), content);
}
console.log(JSON.stringify({ check: CHECK, namespace, objects: objects.length, bytes: manifest.objectBytes }));
