import "server-only";
import { hasBankAccess, isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import type { UnifiedQuestion } from "@/lib/questions";
import { buildSearchCorpus, type SearchCorpusRow } from "@/lib/question-search-corpus-build";

export type { SearchCorpusRow };
type SearchRow = SearchCorpusRow & { preview: boolean };

// The loader owns immutable normalized corpora. Key by that exact array, not bank
// name (runtime modes may differ). Weak keys retain no superseded corpus; no user
// decisions or query results are cached. Callers replacing data must use a new array.
const preparedCorpora = new WeakMap<readonly UnifiedQuestion[], readonly SearchRow[]>();
const preparedRows = new WeakMap<readonly SearchCorpusRow[], readonly SearchRow[]>();

function withPreview(rows: readonly SearchCorpusRow[]): SearchRow[] {
  return rows.map(row => ({ ...row, preview: isPreviewQuestion(row.bankSlug, row.id) }));
}

function prepareSearch(questions: readonly UnifiedQuestion[]): readonly SearchRow[] {
  const cached = preparedCorpora.get(questions);
  if (cached) return cached;
  const rows = withPreview(buildSearchCorpus(questions));
  // Publish only a complete preparation; a thrown preparation is retryable.
  preparedCorpora.set(questions, rows);
  return rows;
}

function prepareCorpus(corpus: readonly SearchCorpusRow[]): readonly SearchRow[] {
  const cached = preparedRows.get(corpus);
  if (cached) return cached;
  const rows = withPreview(corpus);
  preparedRows.set(corpus, rows);
  return rows;
}

/** Return IDs only; rich search text never crosses this server-only boundary. */
export function searchQuestionIds(
  questions: readonly UnifiedQuestion[],
  query: string,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
  allowLocalPreview = false,
): string[] {
  if (!query.trim()) return [];
  return matchIds(prepareSearch(questions), query, entitlements, now, allowLocalPreview);
}

/** Same result as searchQuestionIds, over a prebuilt corpus (see question-search-corpus.ts). */
export function searchCorpusIds(
  corpus: readonly SearchCorpusRow[],
  query: string,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): string[] {
  if (!query.trim()) return [];
  return matchIds(prepareCorpus(corpus), query, entitlements, now, false);
}

function matchIds(
  rows: readonly SearchRow[],
  query: string,
  entitlements: readonly AccessEntitlement[],
  now: Date,
  allowLocalPreview: boolean,
): string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  // Question and answer access currently have identical preview/bank predicates.
  // Resolve bank access once per request, never across users or expiry boundaries.
  const bankAccess = new Map<BankSlug, boolean>();
  const ids: string[] = [];
  for (const question of rows) {
    let allowed = bankAccess.get(question.bankSlug);
    if (allowed === undefined) {
      allowed = (allowLocalPreview && isLocalEconomicsBank(question.bankSlug)) ||
        hasBankAccess(question.bankSlug, entitlements, now);
      bankAccess.set(question.bankSlug, allowed);
    }
    const text = allowed || question.preview ? question.fullText : question.publicText;
    if (text.includes(normalizedQuery)) ids.push(question.id);
  }
  return ids;
}
