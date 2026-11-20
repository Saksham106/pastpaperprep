#!/usr/bin/env node
// Builds src/data/paper-preview-explanations.json: the free preview (first 3 explained questions) for each
// paper in src/data/paper-demand.json, and fills each page's previewQuestionIds.
//
//   node scripts/build-paper-previews.mjs --research ../research/explanations --questions <paper-question-ids.json>
//
// --questions maps "<bank>/<paperId>" to the paper's question IDs in number order, as the site lists them
// (src/lib/past-paper-pages.ts paperQuestions; some papers take their list from the bank index, not the archive).
//
// Each explanation is rebuilt exactly as scripts/explanations/publish.mjs uploads it, and its SHA-256 must match
// the newest publish receipt for that object, so the page prints the same text the paid bank serves.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PREVIEW = 3;
const args = process.argv.slice(2);
const research = resolve(args[args.indexOf('--research') + 1] ?? '');
if (!args.includes('--research') || !statSync(research, { throwIfNoEntry: false })?.isDirectory()) throw new Error('Pass --research <research/explanations dir>');

const questionsArg = args.indexOf('--questions');
if (questionsArg < 0) throw new Error('Pass --questions <paper-question-ids.json>');
const questionIds = JSON.parse(readFileSync(resolve(args[questionsArg + 1]), 'utf8'));
const demandPath = join('src', 'data', 'paper-demand.json');
const demand = JSON.parse(readFileSync(demandPath, 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex');

const receipts = new Map();
/** key -> sha256 from the newest complete receipt that lists it. */
function receiptFor(bank) {
  if (receipts.has(bank)) return receipts.get(bank);
  const dir = join(research, bank, '_publish-receipts');
  const files = readdirSync(dir).map((f) => join(dir, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  const map = new Map();
  for (const file of files) {
    const r = JSON.parse(readFileSync(file, 'utf8'));
    if (r.bank !== bank || !r.complete) continue;
    for (const e of r.expected ?? []) map.set(e.key, e.sha256);
  }
  receipts.set(bank, map);
  return map;
}

const out = {};
const report = [];
for (const page of demand.pages) {
  const ids = questionIds[`${page.bank}/${page.paperId}`];
  if (!Array.isArray(ids)) throw new Error(`${page.bank} ${page.paperId}: no question list`);
  const published = receiptFor(page.bank);
  const chosen = [];
  for (const id of ids) {
    const q = { id };
    if (chosen.length >= PREVIEW) break;
    let doc;
    try { doc = JSON.parse(readFileSync(join(research, page.bank, `${q.id}.json`), 'utf8')); } catch { continue; }
    if (doc.status === 'needs_review') continue;
    const body = JSON.stringify({ schemaVersion: 1, bank: page.bank, questionId: q.id, totalMarks: doc.totalMarks, parts: doc.parts });
    if (published.get(`explanations/${page.bank}/${q.id}.json`) !== sha(body)) continue;
    (out[page.bank] ??= {})[q.id] = JSON.parse(body);
    chosen.push(q.id);
  }
  page.previewQuestionIds = chosen;
  report.push(`${page.bank} ${page.paperId}: ${chosen.length} (${chosen.join(', ')})`);
}

writeFileSync(join('src', 'data', 'paper-preview-explanations.json'), `${JSON.stringify(out)}\n`);
writeFileSync(demandPath, `${JSON.stringify(demand, null, 2)}\n`);
console.log(report.join('\n'));
