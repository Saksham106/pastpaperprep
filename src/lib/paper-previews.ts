import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BankSlug } from './catalog';
import { parseExplanation, type Explanation } from './explanation-format';
import demand from '@/data/paper-demand.json';

/**
 * Paper pages with evidence of search demand (src/data/paper-demand.json, selection rule in its `rule`
 * field) print a free preview of 2–3 worked explanations and are indexed (past-paper-indexing.ts).
 * The preview explanations are committed in src/data/paper-preview-explanations.json: they are public
 * once printed, so they live with the code, and each is re-checked with parseExplanation at build.
 */
export type DemandPage = { bank: BankSlug; paperId: string; previewQuestionIds: readonly string[] };

const PAGES: readonly DemandPage[] = (demand as { pages: DemandPage[] }).pages;
const KEY = (bank: string, paperId: string) => `${bank}\u0000${paperId}`;
const BY_PAPER = new Map(PAGES.map(page => [KEY(page.bank, page.paperId), page]));

export const demandPage = (bank: BankSlug, paperId: string): DemandPage | undefined => BY_PAPER.get(KEY(bank, paperId));
export const demandPages = (): readonly DemandPage[] => PAGES;

let previews: Record<string, Record<string, unknown>> | null = null;
function previewFile(): Record<string, Record<string, unknown>> {
  if (previews) return previews;
  try {
    previews = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'paper-preview-explanations.json'), 'utf8')) as Record<string, Record<string, unknown>>;
  } catch { previews = {}; }
  return previews;
}

/** The preview explanations for a demand-listed paper, in question order; empty for any other paper. */
export function previewExplanations(bank: BankSlug, paperId: string): ReadonlyMap<string, Explanation> {
  const page = demandPage(bank, paperId);
  const map = new Map<string, Explanation>();
  if (!page) return map;
  const raw = previewFile()[bank] ?? {};
  for (const id of page.previewQuestionIds) {
    const explanation = parseExplanation(raw[id], bank, id);
    if (explanation) map.set(id, explanation);
  }
  return map;
}
