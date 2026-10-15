// Builds docs/ib-economics-2026-may-papers/inventory.json for scripts/build-whole-paper-archives.mts.
//   node docs/ib-economics-2026-may-papers/make-inventory.mjs
// Existing pair records come from the pinned private receipt (private/paper-archives/receipt.json, copied from
// research/official-sources-20261013/paper-archive-state-2026-10-15); the 13 May 2026 entries are added from the
// source repo's acquisition manifest. Runtime question ids are read from the current runtime banks, so re-run
// this after the question rows land and the new papers pick them up (none exist yet -> runtimePaperId null).
import fs from 'node:fs';
import path from 'node:path';
const app = process.cwd();
const SRC = '/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice/.worktrees/may-2026';
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'data/may-2026/acquisition-manifest.json'), 'utf8'));
const receipt = JSON.parse(fs.readFileSync(path.join(app, 'private/paper-archives/receipt.json'), 'utf8'));
const levelPapers = { 'ib-economics-hl': /^2026-may-(?:none|tz\d)-(?:hl|hlsl)-p\d$/, 'ib-economics-sl': /^2026-may-tz\d-(?:sl|hlsl)-p\d$/ };
const banks = [];
for (const slug of ['ib-economics-hl', 'ib-economics-sl']) {
  const runtimeFile = path.join(app, `src/data/production/${slug}.json`);
  const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  const old = receipt.banks.find(b => b.slug === slug);
  const pairs = old.papers.map(p => p.inventoryRecord);
  for (const key of Object.keys(manifest.papers).sort()) {
    if (!levelPapers[slug].test(key)) continue;
    const entry = manifest.papers[key];
    const ids = runtime.questions.map(q => q.id).filter(id => id.replace(/-q\d+$/, '') === key).sort();
    pairs.push({
      id: `economics-${key}-english`, runtimePaperId: ids.length ? key : null,
      questionPath: path.join(SRC, entry.question.path), markschemePath: path.join(SRC, entry.markscheme.path),
      runtimeQuestionIds: ids,
    });
  }
  banks.push({
    slug, runtimeFile, pairs, unpaired: old.unpaired, runtimeWithoutPair: old.runtimeWithoutPair,
    notes: [...old.notes, '2026-10-15 ib-economics-may-2026: May 2026 official papers added from the source repo worktree .worktrees/may-2026 (acquisition-manifest.json; identity-review.json and source-scan.json all clean).'],
  });
}
fs.writeFileSync(path.join(app, 'docs/ib-economics-2026-may-papers/inventory.json'), JSON.stringify({ banks }, null, 2) + '\n');
console.log(banks.map(b => `${b.slug}: ${b.pairs.length} pairs`).join('; '));
