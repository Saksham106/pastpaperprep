// Writes src/data/reprint-question-aliases.json: for every runtime row whose `aliasIds` name a reprinted variant
// (Cambridge A Level prints one variant's questions again as another variant of the same series), the reprint paper's
// printed question number -> the canonical bank question id. The /past-papers fallback for PDF-only papers uses it to
// list a reprint's questions; the public bank index carries no aliases.
//
//   node scripts/generate-reprint-aliases.mjs [--check]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'src/data/production';
const OUT = 'src/data/reprint-question-aliases.json';

export function reprintAliases(runtimes) {
  const banks = {};
  for (const [slug, runtime] of runtimes) {
    for (const q of runtime.questions ?? []) for (const alias of q.aliasIds ?? []) {
      const match = /^(.*)-q(\d+)$/.exec(alias);
      if (!match) throw new Error(`Unreadable alias ${alias} on ${q.id}`);
      const [, paper, number] = match;
      const rows = ((banks[slug] ??= {})[paper] ??= []);
      if (rows.some(([n]) => n === Number(number))) throw new Error(`Two rows alias ${alias}`);
      rows.push([Number(number), q.id]);
    }
  }
  const sorted = {};
  for (const slug of Object.keys(banks).sort()) {
    sorted[slug] = {};
    for (const paper of Object.keys(banks[slug]).sort()) sorted[slug][paper] = banks[slug][paper].sort((a, b) => a[0] - b[0]);
  }
  return { schema: 'reprint-question-aliases-v1', generatedFrom: `${DIR}/*.json aliasIds`, banks: sorted };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/generate-reprint-aliases.mjs')) {
  const runtimes = readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
    .map(f => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(path.join(DIR, f), 'utf8'))]);
  const text = `${JSON.stringify(reprintAliases(runtimes))}\n`;
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== text) { console.error(`${OUT} is stale: run node scripts/generate-reprint-aliases.mjs`); process.exit(1); }
  } else writeFileSync(OUT, text);
  console.log(`${OUT}: ${Object.entries(reprintAliases(runtimes).banks).map(([slug, papers]) => `${slug} ${Object.keys(papers).length} papers`).join(', ')}`);
}
