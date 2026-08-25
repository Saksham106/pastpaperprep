import igcseData from "@/data/raw/igcse.json";
import ibHlData from "@/data/raw/ib-hl.json";
import ibSlData from "@/data/raw/ib-sl.json";
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
  marks: number | null;
  summary: string;
  accessibleText: string;
  searchText: string;
  questionImages: string[];
  markschemeImages: string[];
  solution: string | null;
  sourceQuestionUrl: string | null;
  sourceMarkSchemeUrl: string | null;
};

type RawQuestion = Record<string, unknown>;

type Filters = {
  topic?: string;
  year?: string;
  paper?: string;
  search?: string;
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
  const skills = [...strings(raw.skills), ...strings(raw.subtopics), ...strings(raw.detailedSubtopics)];
  const solution = nullableText(raw.solution) ?? nullableText(raw.independentSolution);
  const searchable = [
    primaryTopic,
    ...secondaryTopics,
    ...skills,
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
    skills: Array.from(new Set(skills)),
    marks: typeof raw.marks === "number" ? raw.marks : null,
    summary,
    accessibleText,
    searchText: searchable,
    questionImages: strings(raw.questionImages).map((path) => assetUrl(slug, path)),
    markschemeImages: strings(raw.markschemeImages).map((path) => assetUrl(slug, path)),
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

export function filterQuestions(questions: UnifiedQuestion[], filters: Filters): UnifiedQuestion[] {
  const search = filters.search?.trim().toLocaleLowerCase();
  return questions.filter((question) => {
    if (filters.topic && question.primaryTopic !== filters.topic) return false;
    if (filters.year && question.year !== Number(filters.year)) return false;
    if (filters.paper && question.paper !== Number(filters.paper)) return false;
    if (search && !question.searchText.includes(search)) return false;
    return true;
  });
}
