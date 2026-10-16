#!/usr/bin/env node
// Reviewed printed-marks overlay for the finalized Biology 0610 runtime. The runtime, its storage receipt and
// the historical crop overlay (with its own verified upload receipt) stay byte-identical; this lists the
// question totals the printed-marks census proves wrong and that no earlier repair already corrects.
//
// Evidence: scripts/data/igcse-science-printed-marks-census.json (docs/igcse-science-printed-marks-repair.md).
// A paper contributes only when its printed totals reconcile to its maximum with the stored question count.
// A census difference already served by the historical crop overlay must agree with it and is not repeated.
//
// usage: node scripts/build-0610-printed-marks.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dirname, '..');
const BANK = 'igcse-biology-0610';
const CENSUS = 'scripts/data/igcse-science-printed-marks-census.json';
const OUT = 'src/data/reviewed-biology-printed-marks.json';
const PAPER_MAX = { 3: 80, 4: 80, 5: 40, 6: 40 };
const json = (path) => JSON.parse(readFileSync(join(APP, path), 'utf8'));
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const assert = (condition, reason) => { if (!condition) throw new Error(`0610 printed marks: ${reason}`); };

const census = json(CENSUS);
assert(census.schemaVersion === 'igcse-science-printed-marks-census-v1', 'census schema changed');
const entry = census.banks[BANK];
const runtime = json(`src/data/production/${BANK}.json`);
const crop = json('src/data/reviewed-biology-historical-crop-repairs.json').entries;
const stored = new Map(runtime.questions.map((q) => [q.id, q]));

const entries = {};
for (const [paper, { paperMax, questions }] of Object.entries(entry.papers)) {
  assert(paperMax === PAPER_MAX[paper.split('-').at(-1)[0]], `${paper}: unexpected maximum`);
  assert(questions.length === runtime.questions.filter((q) => q.id.startsWith(`${paper}-q`)).length, `${paper}: question count differs from the runtime`);
  assert(questions.reduce((sum, row) => sum + row[2], 0) === paperMax, `${paper}: printed totals do not sum to ${paperMax}`);
  for (const [number, before, printed] of questions) {
    const id = `${paper}-q${number}`;
    assert(stored.get(id)?.marks === before, `${id}: stored marks drifted from the census`);
    if (before === printed || entry.excludedQuestionIds.includes(id)) continue;
    if (crop[id]?.marks) {
      assert(crop[id].marks.old === before && crop[id].marks.new === printed, `${id}: historical crop overlay disagrees with the census`);
      continue;
    }
    entries[id] = { old: before, new: printed, evidence: `The question paper prints [Total: ${printed}]; ${paper} reconciles to its maximum of ${paperMax} with the printed totals.` };
  }
}

const overlay = {
  schema: 'reviewed-biology-printed-marks-v1',
  bank: BANK,
  source: { census: CENSUS, bankSha256: sha256(JSON.stringify(entry)) },
  entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
};
const text = `${JSON.stringify(overlay, null, 1)}\n`;
if (process.argv.includes('--check')) assert(readFileSync(join(APP, OUT), 'utf8') === text, `${OUT} is stale`);
else writeFileSync(join(APP, OUT), text);
console.log(JSON.stringify({ check: process.argv.includes('--check'), marks: Object.keys(entries).length }));
