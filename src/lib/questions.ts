import igcseData from "@/data/raw/igcse.json";
import ibHlData from "@/data/raw/ib-hl.json";
import ibSlData from "@/data/raw/ib-sl.json";
import { storageObjectPath } from "@/lib/assets";
import { getBank, type BankSlug } from "@/lib/banks";

export type UnifiedQuestion = {
  id: string;
  bankSlug: BankSlug;
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
  summary: string;
  accessibleText: string;
  searchText: string;
  questionImages: string[];
  markschemeImages: string[];
  questionImageCount: number;
  markschemeImageCount: number;
  questionAssetPaths: string[];
  markschemeAssetPaths: string[];
  solution: string | null;
  sourceQuestionUrl: string | null;
  sourceMarkSchemeUrl: string | null;
};

type RawQuestion = Record<string, unknown>;

export type QuestionSort = "paper" | "topic" | "marks-desc" | "marks-asc";

export type QuestionFilters = {
  topic?: string;
  year?: string;
  paper?: string;
  search?: string;
  topics?: string[];
  subtopics?: string[];
  years?: string[];
  papers?: string[];
  sessions?: string[];
  subjects?: string[];
  zones?: string[];
  courseEras?: string[];
  options?: string[];
  components?: string[];
  calculator?: Array<"calculator" | "non-calculator">;
  sort?: QuestionSort;
};

const rawBanks: Record<BankSlug, { questions: RawQuestion[] }> = {
  igcse: igcseData as { questions: RawQuestion[] },
  "ib-hl": ibHlData as { questions: RawQuestion[] },
  "ib-sl": ibSlData as { questions: RawQuestion[] },
};

const cache = new Map<BankSlug, UnifiedQuestion[]>();

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function record(value: unknown): RawQuestion {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawQuestion : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  const valueText = text(value).trim();
  return valueText || null;
}

function integer(value: unknown): number {
  return typeof value === "number" ? value : Number.parseInt(String(value), 10) || 0;
}

function assetUrl(slug: BankSlug, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = getBank(slug)?.sourceBaseUrl;
  return `${base}/${path.replace(/^\//, "")}`;
}

function normalizeQuestion(slug: BankSlug, raw: RawQuestion): UnifiedQuestion {
  const accessibleText = text(raw.accessibleText);
  const summary = text(raw.summary) || accessibleText.slice(0, 220);
  const primaryTopic = text(raw.primaryTopic) || "Other";
  const secondaryTopics = strings(raw.secondaryTopics);
  const controlledSkills = strings(raw.skills);
  const studentSubtopics = strings(raw.subtopics);
  const detailedSubtopics = strings(raw.detailedSubtopics);
  const subtopics = Array.from(new Set(studentSubtopics.length ? studentSubtopics : controlledSkills));
  const officialMarkscheme = record(raw.officialMarkscheme);
  const solution = nullableText(raw.solution) ?? nullableText(raw.independentSolution);
  const questionImages = strings(raw.questionImages).map((path) => assetUrl(slug, path));
  const markschemeImages = [...strings(raw.markschemeImages), ...strings(officialMarkscheme.images)]
    .map((path) => assetUrl(slug, path));
  const searchable = [
    primaryTopic,
    ...secondaryTopics,
    ...subtopics,
    ...detailedSubtopics,
    summary,
    accessibleText,
    solution ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase();

  return {
    id: text(raw.id),
    bankSlug: slug,
    number: integer(raw.number),
    paper: integer(raw.paper),
    year: integer(raw.year),
    session: text(raw.session),
    primaryTopic,
    secondaryTopics,
    skills: controlledSkills.length ? controlledSkills : subtopics,
    subtopics,
    subject: text(raw.subject) || text(raw.course),
    courseEra: text(raw.courseEra),
    option: text(raw.p3Option),
    zone: text(raw.timezone) || text(raw.zone),
    component: text(raw.component),
    calculator: typeof raw.calculator === "boolean" ? raw.calculator : null,
    marks: typeof raw.marks === "number" ? raw.marks : null,
    summary,
    accessibleText,
    searchText: searchable,
    questionImages,
    markschemeImages,
    questionImageCount: questionImages.length,
    markschemeImageCount: markschemeImages.length,
    questionAssetPaths: questionImages.map((path) => storageObjectPath(slug, path)),
    markschemeAssetPaths: markschemeImages.map((path) => storageObjectPath(slug, path)),
    solution,
    sourceQuestionUrl: nullableText(raw.sourceQuestionUrl) ?? nullableText(raw.sourceUrl) ?? nullableText(raw.pdfUrl),
    sourceMarkSchemeUrl: nullableText(raw.sourceMarkSchemeUrl) ?? nullableText(raw.markschemeUrl),
  };
}

export function loadBankQuestions(slug: BankSlug): UnifiedQuestion[] {
  const cached = cache.get(slug);
  if (cached) return cached;

  const questions = rawBanks[slug].questions
    .map((question) => normalizeQuestion(slug, question))
    .sort((a, b) => b.year - a.year || a.paper - b.paper || a.number - b.number);

  cache.set(slug, questions);
  return questions;
}
