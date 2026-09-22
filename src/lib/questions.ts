import { economicsStorageObjectPath, storageObjectPath } from "@/lib/assets";
import { getBank, isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { isPrivateRuntimeBank, privateStorageObjectPath } from "@/lib/private-runtime-mapping";
import granularOverlay from "@/data/math-granular-label-overlay.json";
import aaTaxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import aaOverlay from "@/data/aa-official-subtopics/overlay.json";
import biologyOfficialTaxonomy from "@/data/ib-biology-official-subtopics/taxonomy.json";
import biologyOfficialOverlay from "@/data/ib-biology-official-subtopics/overlay.json";

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

const AA_GROUP_NAMES = new Map(aaTaxonomy.groups.map((group) => [group.id, group.studentFacingName]));
const AA_RECORDS = new Map(aaOverlay.records.map((record) => [`${record.level}:${record.id}`, record]));
const BIOLOGY_GROUP_NAMES = new Map(biologyOfficialTaxonomy.curatedGroups.map((group) => [group.id, group.studentFacingName]));
const BIOLOGY_RECORDS = new Map(biologyOfficialOverlay.rows.map((record) => [`${record.bank}:${record.id}`, record]));

type ClassificationProvenance = {
  oldPrimaryTopic: string;
  oldSecondaryTopics: string[];
  oldSkills: string[];
  oldSubtopics: string[];
  legacyGranularLabels: string[];
  status: "accepted" | "blocked";
  blockedReason: string | null;
};

type AaRecord = (typeof aaOverlay.records)[number];
type BiologyRecord = (typeof biologyOfficialOverlay.rows)[number];

function isCurrentAa(slug: BankSlug, raw: RawQuestion): "SL" | "HL" | null {
  if (slug === "ib-sl" && text(raw.subject).toLocaleLowerCase() === "mathematics: analysis and approaches sl") return "SL";
  if (slug === "ib-hl" && text(raw.courseEra) === "aa-hl" && text(raw.course).toLocaleLowerCase() === "mathematics: analysis and approaches hl") return "HL";
  return null;
}

function aaClassification(slug: BankSlug, raw: RawQuestion): { record: AaRecord; provenance: ClassificationProvenance; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; skills: string[] } | null {
  const level = isCurrentAa(slug, raw);
  if (!level) return null;
  const record = AA_RECORDS.get(`${level}:${text(raw.id)}`);
  if (!record) throw new Error(`Missing official AA classification for ${raw.id}`);
  const oldLabels = GRANULAR_LABELS.get(`${overlayBankForSlug(slug)}:${text(raw.id)}`) ?? [];
  const provenance = {
    oldPrimaryTopic: record.provenance.oldPrimaryTopic,
    oldSecondaryTopics: record.provenance.oldSecondaryTopics,
    oldSkills: record.provenance.oldSkills,
    oldSubtopics: record.provenance.oldSubtopics,
    legacyGranularLabels: oldLabels,
    status: record.status as "accepted" | "blocked",
    blockedReason: record.blockedReason,
  } satisfies ClassificationProvenance;
  return {
    record,
    provenance,
    primaryTopic: record.primaryTopic,
    secondaryTopics: record.secondaryTopics,
    subtopics: record.status === "accepted" ? record.subtopics.map((id) => AA_GROUP_NAMES.get(id) ?? (() => { throw new Error(`Unknown official AA group ${id}`); })()) : [],
    skills: [],
  };
}

function isBiologyBank(slug: BankSlug): boolean {
  return slug === "ib-biology-hl" || slug === "ib-biology-sl";
}

function biologyClassification(slug: BankSlug, raw: RawQuestion): { record: BiologyRecord; provenance: ClassificationProvenance; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; skills: string[] } | null {
  if (!isBiologyBank(slug)) return null;
  const record = BIOLOGY_RECORDS.get(`${slug}:${text(raw.id)}`);
  if (!record) throw new Error(`Missing official Biology classification for ${raw.id}`);
  const groups = [record.primary, ...record.secondary].filter(Boolean) as Array<NonNullable<typeof record.primary>>;
  const provenance = {
    oldPrimaryTopic: record.provenance.oldPrimaryTopic,
    oldSecondaryTopics: record.provenance.oldSecondaryTopics,
    oldSkills: record.provenance.oldSkills,
    oldSubtopics: record.provenance.oldSubtopics,
    legacyGranularLabels: record.provenance.oldGranularLabels,
    status: record.blocked ? "blocked" : "accepted",
    blockedReason: record.blockedReasons.join("; ") || null,
  } satisfies ClassificationProvenance;
  return {
    record,
    provenance,
    primaryTopic: record.primary?.parentTopic ?? (text(raw.primaryTopic) || "Other"),
    secondaryTopics: [...new Set(groups.slice(1).map((group) => group.parentTopic))],
    subtopics: groups.map((group) => BIOLOGY_GROUP_NAMES.get(group.id) ?? (() => { throw new Error(`Unknown official Biology group ${group.id}`); })()),
    skills: [],
  };
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
  /** Era-qualified official syllabus units and additive retrieval facets. */
  officialCodeRefs?: string[];
  retrievalFacets?: string[];
  classificationProvenance?: ClassificationProvenance;
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
  officialCodeRefs?: string[];
  retrievalFacets?: string[];
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
  const aa = aaClassification(slug, raw);
  const biology = biologyClassification(slug, raw);
  const primaryTopic = aa?.primaryTopic ?? biology?.primaryTopic ?? (text(raw.primaryTopic) || "Other");
  const secondaryTopics = aa?.secondaryTopics ?? biology?.secondaryTopics ?? strings(raw.secondaryTopics);
  const controlledSkills = aa?.skills ?? biology?.skills ?? strings(raw.skills);
  const studentSubtopics = aa?.subtopics ?? biology?.subtopics ?? strings(raw.subtopics);
  const secondarySubtopics = biology ? biology.subtopics.slice(1) : strings(raw.secondarySubtopics);
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
  const skills = aa || biology ? [] : isLocalEconomicsBank(slug)
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
    granularLabels: aa || biology ? [] : GRANULAR_LABELS.get(`${overlayBankForSlug(slug)}:${text(raw.id)}`) ?? [],
    officialCodeRefs: biology ? biology.record.officialCodes : strings(raw.officialCodeRefs),
    retrievalFacets: strings(raw.retrievalFacets),
    classificationProvenance: aa?.provenance ?? biology?.provenance,
    subject: text(raw.subject) || text(raw.course),
    courseEra: biology?.record.era ?? text(raw.courseEra),
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
