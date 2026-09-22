import { economicsStorageObjectPath, storageObjectPath } from "@/lib/assets";
import { getBank, isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { isPrivateRuntimeBank, privateStorageObjectPath } from "@/lib/private-runtime-mapping";
import granularOverlay from "@/data/math-granular-label-overlay.json";

const GRANULAR_LABELS = new Map<string, string[]>();
const overlayBankForSlug = (slug: string) => ({
  "igcse-additional": "0606",
  "ib-hl": "ib-aa-hl",
  "ib-sl": "ib-aa-sl",
} as Record<string, string>)[slug] ?? slug;
for (const row of granularOverlay.labels) {
  const key = `${row.bank}:${row.id}`;
  GRANULAR_LABELS.set(key, [...(GRANULAR_LABELS.get(key) ?? []), row.label]);
}

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
  secondarySubtopics: string[];
  granularLabels?: string[];
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

export type QuestionRichDetails = Pick<UnifiedQuestion, "summary" | "accessibleText" | "solution" | "sourceQuestionUrl" | "sourceMarkSchemeUrl">;

type RawQuestion = Record<string, unknown>;

export type QuestionSort = "paper" | "topic" | "marks-desc" | "marks-asc";

export type QuestionFilters = {
  /** @deprecated Use `topics` so primary and secondary topics share one path. */
  topic?: string;
  year?: string;
  paper?: string;
  search?: string;
  topics?: string[];
  subtopics?: string[];
  granularLabels?: string[];
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

function assetUrl(slug: BankSlug, path: string, economicsAssetMode: "local" | "private" = "local"): string {
  if (/^https?:\/\//.test(path)) return path;
  if (isPrivateRuntimeBank(slug) && economicsAssetMode === "private") return privateStorageObjectPath(slug, path);
  if (isLocalEconomicsBank(slug)) {
    const relative = path.replace(/^\/+/, "");
    const segments = relative.split("/");
    if (!relative || segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error("Local preview asset path is invalid");
    }
    return economicsAssetMode === "private"
      ? economicsStorageObjectPath(slug, relative)
      : `/api/local-preview-assets/${slug}/${relative}`;
  }
  const base = getBank(slug)?.sourceBaseUrl;
  return `${base}/${path.replace(/^\//, "")}`;
}

function normalizeQuestion(slug: BankSlug, raw: RawQuestion, economicsAssetMode: "local" | "private"): UnifiedQuestion {
  const accessibleText = text(raw.accessibleText);
  const summary = text(raw.summary) || accessibleText.slice(0, 220);
  const primaryTopic = text(raw.primaryTopic) || "Other";
  const secondaryTopics = strings(raw.secondaryTopics);
  const controlledSkills = strings(raw.skills);
  const studentSubtopics = strings(raw.subtopics);
  const secondarySubtopics = strings(raw.secondarySubtopics);
  const detailedSubtopics = strings(raw.detailedSubtopics);
  const subtopics = Array.from(new Set(
    studentSubtopics.length
      ? studentSubtopics
      : isLocalEconomicsBank(slug)
        ? detailedSubtopics
        : controlledSkills,
  ));
  // `detailedSubtopics` is the richer classification vocabulary used by the
  // reconciled 0580 source. Keep every vocabulary during the runtime
  // migration: v2-native `skills`, legacy `subtopics`, and detailed labels may
  // temporarily coexist with different coverage.
  const skillSeed = controlledSkills.length
    ? controlledSkills
    : detailedSubtopics.length
      ? detailedSubtopics
      : subtopics;
  const skills = isLocalEconomicsBank(slug)
    ? Array.from(new Set(controlledSkills))
    : Array.from(new Set([
      ...skillSeed,
      ...controlledSkills,
      ...detailedSubtopics,
      ...subtopics,
    ]));
  const officialMarkscheme = record(raw.officialMarkscheme);
  const solution = nullableText(raw.solution) ?? nullableText(raw.independentSolution);
  const questionImages = strings(raw.questionImages).map((path) => assetUrl(slug, path, economicsAssetMode));
  const markschemeImagePaths = isPrivateRuntimeBank(slug)
    ? Array.from(new Set([...strings(raw.markschemeImages), ...strings(officialMarkscheme.images)]))
    : [...strings(raw.markschemeImages), ...strings(officialMarkscheme.images)];
  const markschemeImages = markschemeImagePaths.map((path) => assetUrl(slug, path, economicsAssetMode));
  const searchable = [
    primaryTopic,
    ...secondaryTopics,
    ...subtopics,
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
    skills,
    subtopics,
    secondarySubtopics,
    granularLabels: GRANULAR_LABELS.get(`${overlayBankForSlug(slug)}:${text(raw.id)}`) ?? [],
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
    questionAssetPaths: isPrivateRuntimeBank(slug)
      ? questionImages
      : questionImages.map((path) => storageObjectPath(slug, path)),
    markschemeAssetPaths: isPrivateRuntimeBank(slug)
      ? markschemeImages
      : markschemeImages.map((path) => storageObjectPath(slug, path)),
    solution,
    sourceQuestionUrl: nullableText(raw.sourceQuestionUrl) ?? nullableText(raw.sourceUrl) ?? nullableText(raw.pdfUrl),
    sourceMarkSchemeUrl: nullableText(raw.sourceMarkSchemeUrl) ?? nullableText(raw.markschemeUrl),
  };
}

export function normalizeBankQuestions(
  slug: BankSlug,
  rawQuestions: RawQuestion[],
  options: { economicsAssetMode?: "local" | "private" } = {},
): UnifiedQuestion[] {
  return rawQuestions
    .map((question) => normalizeQuestion(slug, question, options.economicsAssetMode ?? "local"))
    .sort((a, b) => b.year - a.year
      || a.paper - b.paper
      || a.number - b.number
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
