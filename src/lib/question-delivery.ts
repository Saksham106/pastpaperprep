import {
  canViewAnswer,
  canViewQuestionAsset,
  type AccessEntitlement,
} from "@/lib/access";
import { isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import type { UnifiedQuestion, QuestionRichDetails } from "@/lib/questions";

function publicSearchText(question: UnifiedQuestion): string {
  return [
    question.primaryTopic,
    ...question.secondaryTopics,
    ...question.skills,
    ...question.subtopics,
    question.subject,
    question.courseEra,
    question.option,
    question.zone,
    question.component,
    String(question.year),
    question.session,
    String(question.paper),
    String(question.number),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function prepareQuestionsForDelivery(
  questions: readonly UnifiedQuestion[],
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
  allowLocalPreview = false,
): UnifiedQuestion[] {
  return questions.map((question) => {
    const localPreview = allowLocalPreview && isLocalEconomicsBank(question.bankSlug);
    const canViewQuestion = localPreview || canViewQuestionAsset(
      question.bankSlug,
      question.id,
      entitlements,
      now,
    );
    const canViewQuestionAnswer = localPreview || canViewAnswer(
      question.bankSlug,
      question.id,
      entitlements,
      now,
    );

    return {
      ...question,
      questionImages: [],
      markschemeImages: [],
      questionAssetPaths: [],
      markschemeAssetPaths: [],
      summary: canViewQuestion ? question.summary : "",
      accessibleText: canViewQuestion ? question.accessibleText : "",
      solution: canViewQuestionAnswer ? question.solution : null,
      sourceQuestionUrl: canViewQuestion ? question.sourceQuestionUrl : null,
      sourceMarkSchemeUrl: canViewQuestionAnswer ? question.sourceMarkSchemeUrl : null,
      searchText: canViewQuestion || canViewQuestionAnswer
        ? question.searchText
        : publicSearchText(question),
    };
  });
}

export function getQuestionRichDetails(
  question: UnifiedQuestion,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
  allowLocalPreview = false,
): QuestionRichDetails {
  return richDetailsFor(question.bankSlug, question.id, {
    summary: question.summary,
    accessibleText: question.accessibleText,
    solution: question.solution,
    sourceQuestionUrl: question.sourceQuestionUrl,
    sourceMarkSchemeUrl: question.sourceMarkSchemeUrl,
  }, entitlements, now, allowLocalPreview);
}

/** Same gating as prepareQuestionsForDelivery, for callers that hold only manifest fields. */
export function richDetailsFor(
  bankSlug: BankSlug,
  questionId: string,
  details: QuestionRichDetails,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
  allowLocalPreview = false,
): QuestionRichDetails {
  const localPreview = allowLocalPreview && isLocalEconomicsBank(bankSlug);
  const canViewQuestion = localPreview || canViewQuestionAsset(bankSlug, questionId, entitlements, now);
  const canViewQuestionAnswer = localPreview || canViewAnswer(bankSlug, questionId, entitlements, now);
  return {
    summary: canViewQuestion ? details.summary : "",
    accessibleText: canViewQuestion ? details.accessibleText : "",
    solution: canViewQuestionAnswer ? details.solution : null,
    sourceQuestionUrl: canViewQuestion ? details.sourceQuestionUrl : null,
    sourceMarkSchemeUrl: canViewQuestionAnswer ? details.sourceMarkSchemeUrl : null,
  };
}
