import { isIGCSEReleaseBank, isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import type { QuestionRichDetails, UnifiedQuestion } from "@/lib/questions";
import { resolveCourseRoute } from "@/lib/course-route";

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
  granularLabels: string[];
  officialCodeRefs?: string[];
  retrievalFacets?: string[];
  officialItems?: string[];
  subject: string;
  option: string;
  zone: string;
  component: string;
  calculator: boolean | null;
  marks: number | null;
  questionImageCount: number;
  markschemeImageCount: number;
  /** Pixel [width, height] of each question image (null where unknown), so its placeholder has the image's shape. */
  imageSizes?: Array<[number, number] | null>;
  /** Shared case study (IB Business Management): the leading question images that every question of one case repeats. */
  stimulusId?: string;
  stimulusImageCount?: number;
  stimulusKey?: string;
  hasExplanation?: true;
  /** Only "both", and only where the paper alone would give one route (see resolveCourseRoute). */
  syllabusRoute?: "both";
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
    granularLabels: [...(question.granularLabels ?? [])],
    ...(question.officialCodeRefs?.length ? { officialCodeRefs: [...question.officialCodeRefs] } : {}),
    ...(question.retrievalFacets?.length ? { retrievalFacets: [...question.retrievalFacets] } : {}),
    ...(question.officialItems?.length ? { officialItems: [...question.officialItems] } : {}),
    subject: question.subject,
    option: question.option,
    zone: question.zone,
    component: question.component,
    calculator: question.calculator,
    marks: question.marks,
    questionImageCount: question.questionImageCount,
    markschemeImageCount: question.markschemeImageCount,
    ...(Array.isArray(question.imageSizes) && question.imageSizes.length === question.questionImageCount && question.imageSizes.some(Boolean)
      ? { imageSizes: question.imageSizes.map((size) => size && [size[0], size[1]] as [number, number]) } : {}),
    ...(question.stimulusId && question.stimulusImageCount ? { stimulusId: question.stimulusId, stimulusImageCount: question.stimulusImageCount, ...(question.stimulusKey ? { stimulusKey: question.stimulusKey } : {}) } : {}),
    ...(question.hasExplanation ? { hasExplanation: true as const } : {}),
    ...(question.syllabusRoute === "both" && resolveCourseRoute(question.bankSlug, question.paper, undefined, question.primaryTopic) !== "both" ? { syllabusRoute: "both" as const } : {}),
  } satisfies PublicQuestionMetadata;
}

/**
 * `imageSizes` (src/data/image-shapes, via loadQuestionImageShapes) gives each card's question
 * images their real shape, as scripts/generate-bank-index.mjs does for the static index.
 */
export function createPublicBankIndex(
  bank: BankSlug,
  questions: readonly UnifiedQuestion[],
  imageSizes?: (questionId: string) => Array<[number, number] | null> | undefined,
): PublicBankIndex {
  return {
    version: PUBLIC_BANK_INDEX_VERSION,
    bank,
    questions: questions.map((question) => toPublicQuestionMetadata(imageSizes ? { ...question, imageSizes: imageSizes(question.id) } : question)),
  };
}

export function publicQuestionSearchText(question: PublicQuestionMetadata): string {
  return [
    question.primaryTopic,
    ...question.secondaryTopics,
    ...question.skills,
    ...question.subtopics,
    ...(question.granularLabels ?? []),
    ...(question.officialCodeRefs ?? []),
    ...(question.retrievalFacets ?? []),
    question.subject,
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
    courseEra: "",
    secondarySubtopics: [],
    syllabusRoute: resolveCourseRoute(bank, question.paper, question.syllabusRoute, question.primaryTopic),
    bankSlug: bank,
    officialCodeRefs: [...(question.officialCodeRefs ?? [])],
    retrievalFacets: [...(question.retrievalFacets ?? [])],
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
  const filename = (PUBLIC_BANK_INDEX_FILES as Partial<Record<BankSlug, string>>)[bank];
  if (!filename) throw new Error(`No public index file exists for ${bank}`);
  return `/bank-index/${filename}`;
}

export function localPreviewBankIndexUrl(bank: BankSlug): string {
  if (!isLocalEconomicsBank(bank)) throw new Error("Only Economics banks have local preview index files");
  return `/api/local-preview-index/${bank}`;
}

export function privateEconomicsBankIndexUrl(bank: BankSlug): string {
  if (!isLocalEconomicsBank(bank) && !isIGCSEReleaseBank(bank)) throw new Error("Only private candidate banks have private index files");
  return `/api/private-bank-index/${bank}`;
}
