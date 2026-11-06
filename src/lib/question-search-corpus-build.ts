import type { BankSlug } from "@/lib/banks";
import type { UnifiedQuestion } from "@/lib/questions";

// No "server-only" marker so the prebuild script can import it; the output it writes is
// server-only (generated/question-search, never public/) because `fullText` is premium.

function publicSearchText(question: UnifiedQuestion): string {
  // Keep this representation identical to question-delivery's locked search text.
  return [question.primaryTopic, ...question.secondaryTopics, ...question.skills,
    ...question.subtopics, question.subject, question.courseEra, question.option,
    question.zone, question.component, String(question.year), question.session,
    String(question.paper), String(question.number)]
    .filter(Boolean).join(" ").toLocaleLowerCase();
}

/** One bank's search text, prebuilt by `npm run generate:asset-manifest`. */
export type SearchCorpusRow = { id: string; bankSlug: BankSlug; fullText: string; publicText: string };

/** The build-time projection, so the search route never loads or normalizes a bank. */
export function buildSearchCorpus(questions: readonly UnifiedQuestion[]): SearchCorpusRow[] {
  return questions.map(question => ({
    id: question.id, bankSlug: question.bankSlug, fullText: question.searchText,
    publicText: publicSearchText(question),
  }));
}
