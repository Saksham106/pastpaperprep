import "server-only";
import { hasBankAccess, isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import type { UnifiedQuestion } from "@/lib/questions";

function publicSearchText(question: UnifiedQuestion): string {
  // Keep this representation identical to question-delivery's locked search text.
  return [question.primaryTopic, ...question.secondaryTopics, ...question.skills,
    ...question.subtopics, question.subject, question.courseEra, question.option,
    question.zone, question.component, String(question.year), question.session,
    String(question.paper), String(question.number)]
    .filter(Boolean).join(" ").toLocaleLowerCase();
}

type SearchRow = { id: string; bankSlug: BankSlug; fullText: string; publicText: string; preview: boolean };
// The loader owns immutable normalized corpora. Key by that exact array, not bank
// name (runtime modes may differ). Weak keys retain no superseded corpus; no user
// decisions or query results are cached. Callers replacing data must use a new array.
const preparedCorpora = new WeakMap<readonly UnifiedQuestion[], readonly SearchRow[]>();

function prepareSearch(questions: readonly UnifiedQuestion[]): readonly SearchRow[] {
  const cached = preparedCorpora.get(questions);
  if (cached) return cached;
  const rows = questions.map(question => ({
    id: question.id, bankSlug: question.bankSlug, fullText: question.searchText,
    publicText: publicSearchText(question),
    preview: isPreviewQuestion(question.bankSlug, question.id),
  }));
  // Publish only a complete preparation; a thrown preparation is retryable.
  preparedCorpora.set(questions, rows);
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
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  // Question and answer access currently have identical preview/bank predicates.
  // Resolve bank access once per request, never across users or expiry boundaries.
  const bankAccess = new Map<BankSlug, boolean>();
  const ids: string[] = [];
  for (const question of prepareSearch(questions)) {
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
