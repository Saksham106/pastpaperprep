import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPreviewQuestion } from './access';
import type { BankSlug } from './catalog';
import { parseExplanation, type Explanation } from './explanation-format';

/** Free-year worked explanations downloaded at prebuild (scripts/generate-free-explanations.mts).
 * Past-paper pages are pre-rendered at build, after prebuild, so this read never runs on a request.
 * A missing file means no worked answers, and those pages then fall back to noindex. */
const CACHE = new Map<BankSlug, ReadonlyMap<string, Explanation>>();

export function freeExplanations(slug: BankSlug): ReadonlyMap<string, Explanation> {
  const cached = CACHE.get(slug);
  if (cached) return cached;
  const map = new Map<string, Explanation>();
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'generated', 'free-explanations', `${slug}.json`), 'utf8')) as Record<string, unknown>;
    for (const [questionId, value] of Object.entries(raw)) {
      // Re-check at render: only free-year questions, only well-formed explanations for that question.
      const explanation = isPreviewQuestion(slug, questionId) ? parseExplanation(value, slug, questionId) : null;
      if (explanation) map.set(questionId, explanation);
    }
  } catch { /* not generated: no worked answers */ }
  CACHE.set(slug, map);
  return map;
}
