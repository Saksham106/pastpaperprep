import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/cbse-12-biology.json";
import taxonomyJson from "@/data/cbse-12-biology-taxonomy.json";
import privateIndex from "@/data/private-index/cbse-12-biology.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/cbse-12-biology.manifest.json";
import dryRun from "../../data/storage/cbse-12-biology.dry-run.json";
import { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } from "../../scripts/igcse-release.mjs";
import { buildRuntime, reconstructCandidate, sourceRootPath } from "../../scripts/generate-cbse-12-biology-runtime.mjs";
import { freeQuestionYears, isPreviewQuestion } from "@/lib/access";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { getCatalogBank, getCatalogBanksForDisplay, isPendingStoragePreview } from "@/lib/catalog";
import { CBSE_SUBTOPICS, cbseChapterOrder } from "@/lib/cbse";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { filterQuestions } from "@/lib/question-filter";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const slug = "cbse-12-biology";
const CANDIDATE = "0ba3847d4293e900e9ecc7e6418717a54d662be5c2b4b8bac4dd0f75f2693c96";
const PREFIX = "cbse-12-biology/releases/full1805-v1-0ba3847d4293";
const FOOD = "Strategies for Enhancement in Food Production (earlier syllabus)";
const ENVIRONMENT = "Environmental Issues (earlier syllabus)";
type Row = Record<string, unknown> & { id: string; year: number; format: string; zone: string; answer?: string; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; sourceQuestionUrl: string; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; heldQuestionIds: string[]; excludedFromSelfMarkingIds: string[]; assetVerification: string; runtimeArtifact: { originalCandidateRuntimeSha256: string; sourceCommit: string; sourceRepository: string }; taxonomy: { sha256: string }; questions: Row[] };
const manifest = manifestJson as unknown as { objectPrefix: string; originalCandidateRuntimeSha256: string; assets: { objectKey: string; size: number; contentType: string }[] };
const finalized = runtime.assetVerification === "verified_readback";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };

describe("CBSE Class 12 Biology: held, wired into the private release lane", () => {
  it("stays hidden and held, with its real counts", () => {
    expect(getCatalogBank(slug)).toMatchObject({ pendingStorage: true, questionCount: 1805, paperCount: 68, years: "2023-2026", productId: "bank_cbse_12_biology" });
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

describe("CBSE Class 12 Biology runtime", () => {
  it("ships 1,805 questions with questions in 68 of the 69 sets, holding 35", () => {
    expect(runtime.questionCount).toBe(1805);
    expect(runtime.paperCount).toBe(68);
    expect(runtime.years).toBe("2023-2026");
    expect(runtime.heldQuestionIds).toHaveLength(35);
    const served = new Set(runtime.questions.map((question) => question.id));
    expect(runtime.heldQuestionIds.some((id) => served.has(id))).toBe(false);
    expect(runtime.questions.every((question) => /^57\/[0-9A-Z]+\/\d$/.test(question.zone))).toBe(true);
    expect(runtime.questions.filter((question) => question.format === "multiple_choice")).toHaveLength(813);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
    const candidate = finalized ? reconstructCandidate(runtimeJson) : runtimeJson;
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
    expect(runtime.runtimeArtifact).toMatchObject({ sourceRepository: "cbse-12-biology-topic-practice", sourceCommit: "23da57a" });
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/cbse-12-biology-taxonomy.json"))).digest("hex")).toBe(runtime.taxonomy.sha256);
  });

  it.skipIf(!existsSync(sourceRootPath()))("rebuilds byte-identically from the pinned source workspace", async () => {
    const built = await buildRuntime();
    if (finalized) expect(JSON.stringify(reconstructCandidate(runtimeJson))).toBe(JSON.stringify(built.artifact));
    else expect(built.serialized).toBe(readFileSync(join(ROOT, "src/data/production/cbse-12-biology.json"), "utf8"));
  });

  it("frees 2023 (main and compartment): 343 questions", () => {
    expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(runtime.questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(343);
  });

  it("cites the three 2023 compartment papers CBSE does not publish from their recorded mirror", () => {
    const mirrored = runtime.questions.filter((question) => !question.sourceQuestionUrl.startsWith("https://www.cbse.gov.in/"));
    expect(new Set(mirrored.map((question) => question.zone))).toEqual(new Set(["57/C/1", "57/C/2", "57/C/3"]));
    expect(mirrored.every((question) => question.sourceQuestionUrl.startsWith("https://www.selfstudys.com/"))).toBe(true);
  });

  it("maps every alias set's question to its canonical question", () => {
    const block = (aliases as { banks: Record<string, Record<string, string>> }).banks[slug];
    expect(Object.keys(block)).toHaveLength(813);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(block)) {
      expect(ids.has(canonical), alias).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });
});

describe("CBSE Class 12 Biology answers", () => {
  const answers = buildMcqAnswerMap(slug, runtime.questions);
  it("serves CBSE's key on every MCQ but the six 'any attempt' items, with any listed letter on multi-letter keys", () => {
    expect(runtime.questions.filter((question) => isMcqRow(slug, question))).toHaveLength(813);
    expect(runtime.excludedFromSelfMarkingIds).toHaveLength(6);
    for (const id of runtime.excludedFromSelfMarkingIds) expect(answers.has(id)).toBe(false);
    expect(answers.size).toBe(807);
    expect(answers.get("cbse12b-2023-m-132-q6")).toEqual({ answers: ["A", "B", "C"], note: null });
    expect(answers.get("cbse12b-2025-m-121-q12")).toEqual({ answers: ["B", "D"], note: null });
    // A settled key where the text read took "(A)" from "Assertion (A)".
    expect(answers.get("cbse12b-2023-c-1c1-q13")).toEqual({ answers: ["C"], note: null });
  });
});

describe("CBSE Class 12 Biology topics, including the earlier-syllabus chapters", () => {
  const questions = normalizeBankQuestions(slug, runtime.questions);
  it("lists the thirteen current chapters in curriculum order, then the two earlier-syllabus topics", () => {
    const options = getTopicOptions(questions);
    expect(options.slice(0, 13)).toEqual([...cbseChapterOrder(slug)]);
    expect(options.slice(13)).toEqual([ENVIRONMENT, FOOD]);
    expect((taxonomyJson as { chapters: { label: string }[]; earlierSyllabusTopics: { label: string; allowedYears: number[] }[] }).earlierSyllabusTopics.map((topic) => topic.label)).toEqual([FOOD, ENVIRONMENT]);
  });

  it("finds every question tagged with an earlier-syllabus topic, which has no subtopics", () => {
    expect(filterQuestions(questions, { topics: [FOOD] })).toHaveLength(15);
    expect(filterQuestions(questions, { topics: [ENVIRONMENT] })).toHaveLength(2);
    const food = questions.filter((question) => question.primaryTopic === FOOD);
    expect(food).toHaveLength(12);
    expect(food.every((question) => question.subtopics.length === 0)).toBe(true);
    expect(getSubtopicGroups(questions, [FOOD], []).relevant).toEqual([]);
  });

  it("narrows subtopics to the chosen current chapter, in curriculum order", () => {
    const sections = CBSE_SUBTOPICS[slug]!;
    for (const question of questions) {
      const own = [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) => sections[topic] ?? []);
      for (const subtopic of question.subtopics) expect(own, `${question.id} ${subtopic}`).toContain(subtopic);
    }
    const evolution = getSubtopicGroups(questions, ["Evolution"], []);
    expect(evolution.relevant.length).toBeGreaterThan(0);
    expect(evolution.relevant).toEqual(sections.Evolution.filter((label) => evolution.relevant.includes(label)));
  });
});

describe("CBSE Class 12 Biology storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 4,093 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(4093);
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 4093, uniqueKeys: 4093, mismatches: 0, localSha256ReHashed: 4093, sha256MatchesSegmentationRecord: 4093, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(1805);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
