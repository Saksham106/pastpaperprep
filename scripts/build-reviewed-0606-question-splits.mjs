#!/usr/bin/env node
// Reviewed 0606 question split (docs/0606-question-splits.md). 0606-2024-june-22-q10 was served as one crop stitched
// from QP pages 14 and 15, so it carried Q11 and 16 marks. The repaired Q10 is the page-14 segment of today's crop
// (pixel-identical, lossless) with its printed 8 marks and a reviewed transcription. Q11 has no official mark scheme
// and is held out as a question-paper-only record. The raw bank and its seals are unchanged.
// Built from ../research/0606-2024-june-22-q11-split (build_split.py).
//
// Writes:
//   src/data/reviewed-0606-question-splits.json        overlay read by the app
//   data/storage/0606-question-splits.manifest.json    new objects to upload (create-only)
//
// usage: node scripts/build-reviewed-0606-question-splits.mjs <research package dir> [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse-additional';
const OUT = { overlay: 'src/data/reviewed-0606-question-splits.json', manifest: 'data/storage/0606-question-splits.manifest.json' };
// Read from the repaired crop. Maths uses linear notation, as in docs/igcse-0606-2026-march-transcripts.json.
const TRANSCRIPTS = {
  '0606-2024-june-22-q10': '10 The functions f and fg are defined by f(x) = e^(x^2 + 3) for x < 0 and fg(x) = e^(2x) for x > 3/2. (a) Explain why f^(-1) exists. [1] (b) Find an expression for f^(-1)(x) and state the domain and range of f^(-1). [5] (c) Hence find and simplify an expression for g(x). [2]',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, reason) => { if (!ok) throw new Error(`0606 question split: ${reason}`); };
const read = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));

const research = process.argv[2];
assert(research, 'pass the research package directory');
const CHECK = process.argv.includes('--check');
const packageBytes = readFileSync(join(research, 'build-a', 'candidate.json'));
const c = JSON.parse(packageBytes);
assert(c.schema === '0606-question-split-v1', 'unexpected package');
const namespace = `repairs/0606-question-split-v1-${sha256(packageBytes).slice(0, 16)}`;

const raw = read(`src/data/raw/${BANK}.json`);
const row = raw.questions.find((q) => q.id === c.questionId);
assert(row && row.marks === c.marks.old && JSON.stringify(row.questionImages) === JSON.stringify([c.served.path]), 'raw row disagrees with the package');
assert(!raw.questions.some((q) => q.id === c.held.id), `${c.held.id} is already a runtime question`);
const paper = raw.questions.filter((q) => q.paperId === row.paperId);
assert(paper.reduce((n, q) => n + q.marks, 0) === 80, 'paper does not total 80 before the split');
const geometry = read('src/data/print-geometry-0606.json').entries[c.questionId][0];
assert(JSON.stringify(geometry.imageDimensions) === JSON.stringify(c.served.rasterSizePx), 'pinned geometry is not the served crop');
const bytes = readFileSync(join(research, 'build-a', 'images', `${c.repaired.sha256}.webp`));
assert(sha256(bytes) === c.repaired.sha256 && bytes.length === c.repaired.bytes, 'candidate bytes differ');
const text = TRANSCRIPTS[c.questionId];
assert(text, 'no reviewed transcription');

const path = `${namespace}/${c.repaired.sha256}.webp`;
const overlay = {
  schema: 'reviewed-0606-question-splits-v1',
  bank: BANK,
  namespace,
  source: { research: 'research/0606-2024-june-22-q11-split', packageSha256: sha256(packageBytes), builderSha256: c.builderSha256,
    questionPdfSha256: c.sourceQuestionPdfSha256, markSchemePdfSha256: c.sourceMarkSchemePdfSha256 },
  entries: {
    [c.questionId]: {
      oldPaths: [c.served.path], oldSha256: [c.served.sha256], newPaths: [path], sha256: [c.repaired.sha256],
      marks: c.marks,
      accessibleText: { oldSha256: sha256(row.accessibleText), text },
      printGeometry: { physicalSizePt: c.repaired.physicalSizePt, imageDimensions: c.repaired.rasterSizePx, segments: c.repaired.segments },
      held: c.held,
    },
  },
};
const manifest = {
  schema: '0606-question-splits-upload-v1',
  namespace,
  questionReplacementCount: 1,
  objectCount: 1,
  objectBytes: bytes.length,
  objects: [{ objectKey: `${BANK}/${path}`, sha256: c.repaired.sha256, bytes: bytes.length }],
};
const outputs = { [OUT.overlay]: `${JSON.stringify(overlay, null, 1)}\n`, [OUT.manifest]: `${JSON.stringify(manifest, null, 1)}\n` };
for (const [file, content] of Object.entries(outputs)) {
  if (CHECK) assert(readFileSync(join(APP, file), 'utf8') === content, `--check: ${file} is stale`);
  else writeFileSync(join(APP, file), content);
}
console.log(JSON.stringify({ check: CHECK, namespace, objects: 1, bytes: bytes.length }));
