import type { AccessEntitlement } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import type { UnifiedQuestion } from "@/lib/questions";

/** Return IDs only; rich search text never crosses this boundary. */
export function searchQuestionIds(
  questions: readonly UnifiedQuestion[],
  query: string,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): string[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  return prepareQuestionsForDelivery(questions, entitlements, now)
    .filter((question) => question.searchText.includes(normalizedQuery.toLocaleLowerCase()))
    .map((question) => question.id);
}
