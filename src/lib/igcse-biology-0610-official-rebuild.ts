/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const BIOLOGY_0610_ERAS = ["2020_2021", "2022", "2023_2025"] as const;
export const BIOLOGY_0610_COUNTS = { rows: 3441, accepted: 3382, corrected: 55, blocked: 4, held: 0 } as const;
export const BIOLOGY_0610_OVERLAY_SHA256 = "7846ece73f808fcebcc66f31d8c10a47ddb54963604c1ffd02f67d35e7d2bc9d";
const SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-biology-0610-topic-practice";
const ASSEMBLY_PATH = path.join(SOURCE_ROOT, "data/classification/full-bank-assembly/working-assembly-ms-repair.json");
const OVERLAY_PATH = path.join(process.cwd(), "src/data/classification/igcse-biology-0610-final-reviewed-overlay.reconciled.json");
const TAXONOMY_PATH = path.join(process.cwd(), "src/data/classification/igcse-biology-0610-official-taxonomy-v2.json");

type AnyRecord = Record<string, any>;
export type BiologyRuntimeRow = AnyRecord & {
  id: string;
  primaryTopicId: string | null;
  secondaryTopicIds: string[];
  reviewStatus: "classified" | "blocked";
  classificationProvenance: AnyRecord;
};
export type BiologyRuntime = { rows: BiologyRuntimeRow[]; overlay: AnyRecord; taxonomy: AnyRecord; eras: readonly string[]; counts: typeof BIOLOGY_0610_COUNTS; overlaySha256: string };

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const cleanAsset = (value: string) => value.replace(/^assets\//, "");
const sessionNames: Record<string, string> = { m: "March", s: "June", w: "November" };

function taxonomyIndex(taxonomy: AnyRecord) {
  const byEra = new Map<string, Map<string, { topic: AnyRecord; subtopic: AnyRecord }>>();
  for (const era of taxonomy.eras) {
    const index = new Map<string, { topic: AnyRecord; subtopic: AnyRecord }>();
    for (const topic of era.topics) for (const subtopic of topic.subtopics) index.set(subtopic.normalized_subtopic_id, { topic, subtopic });
    byEra.set(era.era, index);
  }
  return byEra;
}

export function validateBiology0610Overlay(overlay: AnyRecord, rawText?: string) {
  if (overlay.schema !== "igcse-biology-0610.final-reviewed-overlay.reconciled.v3" || overlay.status !== "PASS") throw new Error("Reviewed Biology overlay is not the pinned PASS artifact");
  if (rawText && sha256(rawText) !== BIOLOGY_0610_OVERLAY_SHA256) throw new Error("Reviewed Biology overlay hash mismatch");
  if (overlay.rows.length !== BIOLOGY_0610_COUNTS.rows || new Set(overlay.rows.map((row: AnyRecord) => row.id)).size !== BIOLOGY_0610_COUNTS.rows) throw new Error("Reviewed Biology overlay row identity is not exact");
  if (overlay.taxonomy.eraRegistries.join(",") !== BIOLOGY_0610_ERAS.join(",")) throw new Error("Reviewed Biology overlay era routing changed");
  if (overlay.rows.filter((row: AnyRecord) => row.sourcePass === "pass-missing-era" && row.resolvedEra).length !== 49) throw new Error("Resolved null-era Biology coverage is not exactly 49 rows");
  if (overlay.counts.accepted !== 3382 || overlay.counts.corrected !== 55 || overlay.counts.blocked !== 4 || (overlay.counts.held ?? 0) !== 0) throw new Error("Reviewed Biology overlay counts changed");
  return { rows: 3441, accepted: 3382, corrected: 55, blocked: 4, held: 0 } as const;
}

export async function buildBiology0610Runtime(): Promise<BiologyRuntime> {
  const [assemblyText, overlayText, taxonomyText] = await Promise.all([readFile(ASSEMBLY_PATH, "utf8"), readFile(OVERLAY_PATH, "utf8"), readFile(TAXONOMY_PATH, "utf8")]);
  const assembly = JSON.parse(assemblyText) as AnyRecord;
  const overlay = JSON.parse(overlayText) as AnyRecord;
  const taxonomy = JSON.parse(taxonomyText) as AnyRecord;
  validateBiology0610Overlay(overlay, overlayText);
  if (assembly.rows.length !== 3441) throw new Error("Biology source assembly row count changed");
  const overlayById = new Map<string, AnyRecord>(overlay.rows.map((row: AnyRecord) => [row.id as string, row] as [string, AnyRecord]));
  const byEra = taxonomyIndex(taxonomy);
  const rows = assembly.rows.map((source: AnyRecord) => {
    const id = source.question_id;
    const reviewed = overlayById.get(id);
    if (!reviewed) throw new Error(`Missing reviewed overlay row: ${id}`);
    const match = /^(?:0610)-(\d{4})-([msw])-([0-9]+)-q(\d+)$/.exec(id);
    if (!match) throw new Error(`Invalid Biology id: ${id}`);
    const [, year, sessionCode, component, number] = match;
    const primary = reviewed.primary as string | null;
    const secondary = Array.isArray(reviewed.secondary) ? reviewed.secondary : [];
    const primaryMeta = primary ? byEra.get(reviewed.resolvedEra)?.get(primary) : undefined;
    const secondaryMeta = secondary.map((value: string) => byEra.get(reviewed.resolvedEra)?.get(value)).filter(Boolean) as AnyRecord[];
    if (primary && !primaryMeta) throw new Error(`Primary label is not in its routed era: ${id}`);
    const questionImages = (source.source?.images ?? []).map((asset: AnyRecord) => `questions/${cleanAsset(asset.path)}`);
    const markschemeImages = (source.source?.mark_scheme_images ?? []).map((asset: AnyRecord) => `markschemes/${cleanAsset(asset.path)}`);
    const labels = [primaryMeta?.subtopic.title, ...secondaryMeta.map((entry) => entry.subtopic.title)].filter(Boolean);
    return {
      id, canonicalId: id, bankSlug: "igcse-biology-0610", number: Number(number), paper: Number(component[0]), component, year: Number(year), session: sessionNames[sessionCode], zone: `Variant ${component[1]}`,
      courseEra: reviewed.resolvedEra, subject: "Biology 0610", course: "Cambridge IGCSE Biology 0610", primaryTopic: primaryMeta?.topic.title ?? null, primaryTopicId: primary,
      secondaryTopics: [...new Set(secondaryMeta.map((entry) => entry.topic.title))], secondaryTopicIds: secondary, subtopics: [...new Set(labels)], detailedSubtopics: [...new Set(labels)], secondarySubtopics: [...new Set(secondaryMeta.map((entry) => entry.subtopic.title))], skills: [], assessmentObjectives: [], marks: source.marks ?? null, maxMarks: source.marks ?? null,
      summary: String(source.source?.text ?? "").trim().slice(0, 220), accessibleText: String(source.source?.text ?? "").trim(), questionImages, markschemeImages, officialMarkscheme: { images: markschemeImages }, sourceQuestionUrl: source.review?.evidence_bindings?.[0]?.source_pdfs?.question_paper?.url ?? null, sourceMarkSchemeUrl: source.review?.evidence_bindings?.[0]?.source_pdfs?.mark_scheme?.url ?? null, sourceType: "actual_past_paper", sourceId: id,
      answer: source.answer ?? null, printedParts: source.printed_parts ?? ["question-level"], publicationStatus: "local_preview_candidate", classificationReviewStatus: primary ? "classified" : "blocked", reviewStatus: primary ? "classified" : "blocked",
      classificationProvenance: { overlaySha256: BIOLOGY_0610_OVERLAY_SHA256, sourceRowId: id, resolvedEra: reviewed.resolvedEra, sourcePass: reviewed.sourcePass, originalPrimaryTopicId: source.primary?.topic_id ?? null, originalSecondaryTopicIds: (source.secondary ?? []).map((entry: AnyRecord) => entry.topic_id), roleBindings: reviewed.roleBindings ?? [], sourceEvidence: reviewed.sourceEvidence ?? null },
      rightsStatus: "user_attested_private_acquisition_publication_blocked",
    } satisfies BiologyRuntimeRow;
  });
  return { rows, overlay, taxonomy, eras: BIOLOGY_0610_ERAS, counts: BIOLOGY_0610_COUNTS, overlaySha256: BIOLOGY_0610_OVERLAY_SHA256 };
}

export const biology0610PinnedPaths = { sourceRoot: SOURCE_ROOT, assembly: ASSEMBLY_PATH, overlay: OVERLAY_PATH, taxonomy: TAXONOMY_PATH } as const;
export const biology0610SourceHash = (source: string) => sha256(source);
