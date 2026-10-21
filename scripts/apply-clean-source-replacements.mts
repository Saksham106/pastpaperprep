/**
 * Point whole-paper manifests at clean copies of PDFs that carried a host stamp
 * (data/paper-archives/clean-source-replacements.json). Each replacement must name the exact stamped document
 * it replaces, on the stated paper and role; anything else fails. A changed paper gets a new version derived
 * from its old version and new documents.
 *
 *   npx tsx scripts/apply-clean-source-replacements.mts [--check]
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Doc = { sha256: string; bytes: number; pages: number };
type Replacement = { stampedSha256: string; cleanSha256: string; bytes: number; pages: number; paper: string; role: 'question' | 'markscheme'; bank: string };
const DIR = 'src/data/paper-archives';
const check = process.argv.includes('--check');
const { replacements } = JSON.parse(readFileSync('data/paper-archives/clean-source-replacements.json', 'utf8')) as { replacements: Replacement[] };
const pending = new Map(replacements.map((item) => [item.stampedSha256, item]));
const applied = new Set<string>();
let changedPapers = 0;
for (const file of readdirSync(DIR).filter((name) => name.endsWith('.json')).sort()) {
  const manifestPath = path.join(DIR, file);
  const text = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(text) as { bankSlug: string; papers: Array<{ summary: { id: string }; version: string; documents: Record<'question' | 'markscheme', Doc> }> };
  let changed = false;
  for (const paper of manifest.papers) {
    let paperChanged = false;
    for (const role of ['question', 'markscheme'] as const) {
      const document = paper.documents[role];
      if (replacements.some((item) => item.cleanSha256 === document.sha256 && item.paper === paper.summary.id && item.role === role)) {
        applied.add(replacements.find((item) => item.cleanSha256 === document.sha256)!.stampedSha256);
        continue;
      }
      const replacement = pending.get(document.sha256);
      if (!replacement) continue;
      if (replacement.bank !== manifest.bankSlug || replacement.paper !== paper.summary.id || replacement.role !== role) {
        throw new Error(`Replacement for ${document.sha256} names ${replacement.bank} ${replacement.paper} ${replacement.role}, found on ${manifest.bankSlug} ${paper.summary.id} ${role}`);
      }
      if (replacement.pages !== document.pages) throw new Error(`${paper.summary.id} ${role}: clean copy has ${replacement.pages} pages, stamped ${document.pages}`);
      paper.documents[role] = { sha256: replacement.cleanSha256, bytes: replacement.bytes, pages: replacement.pages };
      applied.add(replacement.stampedSha256);
      paperChanged = true;
    }
    if (paperChanged) {
      paper.version = createHash('sha256').update(JSON.stringify([paper.version, 'clean-source-replacements-v1', paper.documents])).digest('hex').slice(0, 20);
      changed = true;
      changedPapers += 1;
    }
  }
  if (changed && !check) writeFileSync(manifestPath, text.endsWith('\n') ? `${JSON.stringify(manifest)}\n` : JSON.stringify(manifest));
}
const missing = replacements.filter((item) => !applied.has(item.stampedSha256)).map((item) => `${item.paper} ${item.role}`);
if (missing.length) throw new Error(`Replacements not found in any manifest: ${missing.join(', ')}`);
console.log(`${changedPapers} papers ${check ? 'would change' : 'changed'}; ${applied.size} documents replaced or already clean`);
if (check && changedPapers) process.exit(1);
