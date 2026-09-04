import type { BankSlug } from "@/lib/banks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import type { QuestionRichDetails, UnifiedQuestion } from "@/lib/questions";

export const PUBLIC_BANK_INDEX_VERSION = 1 as const;

export type PublicQuestionMetadata = {
  id: string;
  number: number;
  paper: number;
  year: number;
  session: string;
  primaryTopic: string;
  secondaryTopics: string[];
  skills: string[];
  subtopics: string[];
  subject: string;
  courseEra: string;
  option: string;
  zone: string;
  component: string;
  calculator: boolean | null;
  marks: number | null;
  questionImageCount: number;
  markschemeImageCount: number;
};

export type PublicBankIndex = {
  version: typeof PUBLIC_BANK_INDEX_VERSION;
  bank: BankSlug;
  questions: PublicQuestionMetadata[];
};

export function toPublicQuestionMetadata(question: UnifiedQuestion): PublicQuestionMetadata {
  return {
    id: question.id,
    number: question.number,
    paper: question.paper,
    year: question.year,
    session: question.session,
    primaryTopic: question.primaryTopic,
    secondaryTopics: [...question.secondaryTopics],
    skills: [...question.skills],
    subtopics: [...question.subtopics],
    subject: question.subject,
    courseEra: question.courseEra,
    option: question.option,
    zone: question.zone,
    component: question.component,
    calculator: question.calculator,
    marks: question.marks,
    questionImageCount: question.questionImageCount,
    markschemeImageCount: question.markschemeImageCount,
  };
}

export function createPublicBankIndex(
  bank: BankSlug,
  questions: readonly UnifiedQuestion[],
): PublicBankIndex {
  return {
    version: PUBLIC_BANK_INDEX_VERSION,
    bank,
    questions: questions.map(toPublicQuestionMetadata),
  };
}

export function publicQuestionSearchText(question: PublicQuestionMetadata): string {
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

export function publicMetadataToQuestion(question: PublicQuestionMetadata, bank: BankSlug): UnifiedQuestion {
  return {
    ...question,
    bankSlug: bank,
    summary: "",
    accessibleText: "",
    searchText: publicQuestionSearchText(question),
    questionImages: [],
    markschemeImages: [],
    questionAssetPaths: [],
    markschemeAssetPaths: [],
    solution: null,
    sourceQuestionUrl: null,
    sourceMarkSchemeUrl: null,
  };
}

export function mergeQuestionRichDetails(
  question: UnifiedQuestion,
  details: QuestionRichDetails,
): UnifiedQuestion {
  return {
    ...question,
    summary: details.summary,
    accessibleText: details.accessibleText,
    solution: details.solution,
    sourceQuestionUrl: details.sourceQuestionUrl,
    sourceMarkSchemeUrl: details.sourceMarkSchemeUrl,
  };
}

export function publicBankIndexUrl(bank: BankSlug): string {
  return `/bank-index/${PUBLIC_BANK_INDEX_FILES[bank]}`;
}
