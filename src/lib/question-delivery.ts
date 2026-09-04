import {
  canViewAnswer,
  canViewQuestionAsset,
  type AccessEntitlement,
} from "@/lib/access";
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
): UnifiedQuestion[] {
  return questions.map((question) => {
    const canViewQuestion = canViewQuestionAsset(
      question.bankSlug,
      question.id,
      entitlements,
      now,
    );
    const canViewQuestionAnswer = canViewAnswer(
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
): QuestionRichDetails {
  const delivered = prepareQuestionsForDelivery([question], entitlements, now)[0];
  return {
    summary: delivered.summary,
    accessibleText: delivered.accessibleText,
    solution: delivered.solution,
    sourceQuestionUrl: delivered.sourceQuestionUrl,
    sourceMarkSchemeUrl: delivered.sourceMarkSchemeUrl,
  };
}
