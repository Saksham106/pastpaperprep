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
  const subtopics = Array.from(new Set([
    ...strings(raw.skills),
    ...strings(raw.subtopics),
    ...strings(raw.detailedSubtopics),
  ]));
  const officialMarkscheme = record(raw.officialMarkscheme);
  const solution = nullableText(raw.solution) ?? nullableText(raw.independentSolution);
  const searchable = [
    primaryTopic,
    ...secondaryTopics,
    ...subtopics,
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
    skills: subtopics,
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
    questionImages: strings(raw.questionImages).map((path) => assetUrl(slug, path)),
    markschemeImages: [...strings(raw.markschemeImages), ...strings(officialMarkscheme.images)]
      .map((path) => assetUrl(slug, path)),
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

function includesAny(selected: string[] | undefined, values: string[]): boolean {
  return !selected?.length || selected.some((value) => values.includes(value));
}

export function filterQuestions(questions: UnifiedQuestion[], filters: QuestionFilters): UnifiedQuestion[] {
  const search = filters.search?.trim().toLocaleLowerCase();
  const filtered = questions.filter((question) => {
    if (filters.topic && question.primaryTopic !== filters.topic) return false;
    if (filters.year && question.year !== Number(filters.year)) return false;
    if (filters.paper && question.paper !== Number(filters.paper)) return false;
    if (!includesAny(filters.topics, [question.primaryTopic, ...question.secondaryTopics])) return false;
    if (!includesAny(filters.subtopics, question.subtopics)) return false;
    if (!includesAny(filters.years, [String(question.year)])) return false;
    if (!includesAny(filters.papers, [String(question.paper)])) return false;
    if (!includesAny(filters.sessions, [question.session])) return false;
    if (!includesAny(filters.subjects, [question.subject])) return false;
    if (!includesAny(filters.zones, [question.zone])) return false;
    if (!includesAny(filters.courseEras, [question.courseEra])) return false;
    if (!includesAny(filters.options, [question.option])) return false;
    if (!includesAny(filters.components, [question.component])) return false;
    if (filters.calculator?.length) {
      const mode = question.calculator ? "calculator" : "non-calculator";
      if (!filters.calculator.includes(mode)) return false;
    }
    if (search && !question.searchText.includes(search)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "marks-desc") return (b.marks ?? -1) - (a.marks ?? -1);
    if (filters.sort === "marks-asc") return (a.marks ?? Number.MAX_SAFE_INTEGER) - (b.marks ?? Number.MAX_SAFE_INTEGER);
    if (filters.sort === "topic") return a.primaryTopic.localeCompare(b.primaryTopic) || b.year - a.year;
    return b.year - a.year || a.paper - b.paper || a.number - b.number;
  });
}
