import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/cbse-10-science.json";
import taxonomyJson from "@/data/cbse-10-science-taxonomy.json";
import privateIndex from "@/data/private-index/cbse-10-science.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/cbse-10-science.manifest.json";
import dryRun from "../../data/storage/cbse-10-science.dry-run.json";
import { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } from "../../scripts/igcse-release.mjs";
import { buildRuntime, reconstructCandidate, sourceRootPath } from "../../scripts/generate-cbse-10-science-runtime.mjs";
import { freeQuestionYears, isPreviewQuestion } from "@/lib/access";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { getCatalogBank, getCatalogBanksForDisplay, isPendingStoragePreview } from "@/lib/catalog";
import { CBSE_10_SCIENCE_GROUPS, CBSE_SUBTOPICS, cbseChapterOrder } from "@/lib/cbse";
import { matchesCourseRoute } from "@/lib/course-route";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const slug = "cbse-10-science";
const CANDIDATE = "957e2ef49450e08822aeb413448ed5053e7aff93536d502b656fa751452ab75f";
const PREFIX = "cbse-10-science/releases/full2375-v1-957e2ef49450";
type Row = Record<string, unknown> & { id: string; year: number; paperId: string; format: string; session: string; primaryTopic: string; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; heldQuestionIds: string[]; excludedFromSelfMarkingIds: string[]; gateWaivers: { gate: string; expires: string; papers: string[] }[]; paperFacts: Record<string, unknown>; publicationStatus: string; assetVerification: string; runtimeArtifact: { originalCandidateRuntimeSha256: string; sourceCommit: string; sourceRepository: string }; taxonomy: { sha256: string }; questions: Row[] };
const manifest = manifestJson as unknown as { objectPrefix: string; storageState: string; originalCandidateRuntimeSha256: string; assets: { objectKey: string; size: number; contentType: string }[] };
const finalized = runtime.assetVerification === "verified_readback";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };

describe("CBSE Class 10 Science: held, wired into the private release lane", () => {
  it("stays hidden and held, with its real counts", () => {
    expect(getCatalogBank(slug)).toMatchObject({ pendingStorage: true, questionCount: 2375, paperCount: 78, years: "2023-2026", productId: "bank_cbse_10_science" });
    expect(HELD_BANKS).toContain(slug);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getBank(slug, PRODUCTION)).toBeUndefined();
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(false);
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(true);
  });

  it("rides the shared private-storage lane at 1.5 px/pt", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect((RELEASE_BANKS as Record<string, { prefix: string; originalCandidateRuntimeSha256: string }>)[slug]).toMatchObject({ prefix: PREFIX, originalCandidateRuntimeSha256: CANDIDATE });
    expect(inferredPdfDpiForBank(slug)).toBe(108);
  });
});

describe("CBSE Class 10 Science runtime", () => {
  it("ships 2,375 questions from 78 sets: main, compartment and the 2026 second exam, holding 144", () => {
    expect(runtime.questionCount).toBe(2375);
    expect(runtime.paperCount).toBe(78);
    expect(runtime.years).toBe("2023-2026");
    expect(new Set(runtime.questions.map((question) => question.session))).toEqual(new Set(["Main", "Compartment", "Second exam"]));
    expect(runtime.questions.filter((question) => question.session === "Second exam").every((question) => question.year === 2026)).toBe(true);
    expect(runtime.heldQuestionIds).toHaveLength(144);
    const served = new Set(runtime.questions.map((question) => question.id));
    expect(runtime.heldQuestionIds.some((id) => served.has(id))).toBe(false);
    expect(runtime.paperFacts).toEqual({ 1: { name: "Science", durationMinutes: 180, totalMarks: 80 } });
    expect(runtime.questions.every((question) => question.paper === 1 && question.maxMarks === 80 && /^31\/[0-9A-Z]+\/\d$/.test(question.zone as string))).toBe(true);
    expect(runtime.questions.filter((question) => question.format === "multiple_choice")).toHaveLength(998);
  });

  it("records the coordinator's segmentation waiver with its expiry", () => {
    expect(runtime.gateWaivers).toHaveLength(1);
    expect(runtime.gateWaivers[0]).toMatchObject({ gate: "cbse.segmentation_clean", expires: "2026-12-15" });
    expect(runtime.gateWaivers[0].papers).toHaveLength(13);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
    const candidate = finalized ? reconstructCandidate(runtimeJson) : runtimeJson;
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
    expect(runtime.runtimeArtifact).toMatchObject({ sourceRepository: "cbse-10-science-topic-practice", sourceCommit: "cd87616" });
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/cbse-10-science-taxonomy.json"))).digest("hex")).toBe(runtime.taxonomy.sha256);
  });

  it.skipIf(!existsSync(sourceRootPath()))("rebuilds byte-identically from the pinned source workspace", async () => {
    const built = await buildRuntime();
    if (finalized) expect(JSON.stringify(reconstructCandidate(runtimeJson))).toBe(JSON.stringify(built.artifact));
    else expect(built.serialized).toBe(readFileSync(join(ROOT, "src/data/production/cbse-10-science.json"), "utf8"));
    expect(built.taxonomySerialized).toBe(readFileSync(join(ROOT, "src/data/cbse-10-science-taxonomy.json"), "utf8"));
  });

  it("frees 2023 (main and compartment): 510 questions", () => {
    expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(runtime.questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(510);
  });

  it("maps every alias set's question to its canonical question", () => {
    const block = (aliases as { banks: Record<string, Record<string, string>> }).banks[slug];
    expect(Object.keys(block)).toHaveLength(966);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(block)) {
      expect(ids.has(canonical), alias).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("serves CBSE's official key on every MCQ, either letter on the settled 2026 Q8", () => {
    const answers = buildMcqAnswerMap(slug, runtime.questions);
    expect(runtime.questions.filter((question) => isMcqRow(slug, question))).toHaveLength(998);
    expect(answers.size).toBe(998);
    expect([...answers].filter(([, answer]) => answer.answers.length > 1)).toEqual([["cbse10s-2026-m-121-q8", { answers: ["A", "C"], note: null }]]);
    expect(runtime.excludedFromSelfMarkingIds).toEqual([]);
  });
});

describe("CBSE Class 10 Science topic picker on the real rows", () => {
  const questions = normalizeBankQuestions(slug, runtime.questions);
  it("lists the thirteen chapters in NCERT order, matching the app and the taxonomy", () => {
    expect(getTopicOptions(questions)).toEqual([...cbseChapterOrder(slug)]);
    expect((taxonomyJson as { chapters: { label: string }[] }).chapters.map((chapter) => chapter.label)).toEqual([...cbseChapterOrder(slug)]);
  });

  it("files every question under the science tab of its chapter, and a tab lists only its own chapters", () => {
    const groups = (taxonomyJson as { chapters: { label: string; group: string }[] }).chapters;
    for (const tab of CBSE_10_SCIENCE_GROUPS) expect(tab.chapters).toEqual(groups.filter((chapter) => chapter.group === tab.route).map((chapter) => chapter.label));
    expect(questions.every((question) => ["biology", "chemistry", "physics"].includes(question.syllabusRoute ?? ""))).toBe(true);
    const physics = questions.filter((question) => matchesCourseRoute(question.syllabusRoute, "physics"));
    expect(getTopicOptions(physics)).toEqual(["Light – Reflection and Refraction", "The Human Eye and the Colourful World", "Electricity", "Magnetic Effects of Electric Current"]);
  });

  it("narrows subtopics to the chosen chapter's NCERT sections, in book order", () => {
    const sections = CBSE_SUBTOPICS[slug]!;
    for (const question of questions) {
      const own = [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) => sections[topic] ?? []);
      for (const subtopic of question.subtopics) expect(own, `${question.id} ${subtopic}`).toContain(subtopic);
    }
    const electricity = getSubtopicGroups(questions, ["Electricity"], []);
    expect(electricity.relevant.length).toBeGreaterThan(0);
    expect(electricity.relevant).toEqual(sections.Electricity.filter((label) => electricity.relevant.includes(label)));
  });
});

describe("CBSE Class 10 Science storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 5,317 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(5317);
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.contentType === "image/webp")).toBe(true);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 5317, uniqueKeys: 5317, mismatches: 0, localSha256ReHashed: 5317, sha256MatchesSegmentationRecord: 5317, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(2375);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
