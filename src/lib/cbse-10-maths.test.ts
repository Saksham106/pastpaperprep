import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/cbse-10-maths.json";
import taxonomyJson from "@/data/cbse-10-maths-taxonomy.json";
import privateIndex from "@/data/private-index/cbse-10-maths.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/cbse-10-maths.manifest.json";
import dryRun from "../../data/storage/cbse-10-maths.dry-run.json";
import { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } from "../../scripts/igcse-release.mjs";
import { buildRuntime, reconstructCandidate, sourceRootPath } from "../../scripts/generate-cbse-10-maths-runtime.mjs";
import { freeQuestionYears, isPreviewQuestion } from "@/lib/access";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { getCatalogBank, getCatalogBanksForDisplay, isPendingStoragePreview } from "@/lib/catalog";
import { CBSE_SUBTOPICS, cbseChapterOrder } from "@/lib/cbse";
import { defaultRouteSelection, matchesCourseRoute, routeConfigFor } from "@/lib/course-route";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const slug = "cbse-10-maths";
const CANDIDATE = "da3dfa9d1cbdea6d7c5b97e1b18f7d079d4713a9ae81180f301c7afe16700446";
const PREFIX = "cbse-10-maths/releases/full3826-v1-da3dfa9d1cbd";
const SHARED = ["cbse10m-2024-m-141-q31", "cbse10m-2025-m-111-q21-or", "cbse10m-2025-m-111-q27-or", "cbse10m-2025-m-111-q29", "cbse10m-2026-e-171-q26"];
type Row = Record<string, unknown> & { id: string; paper: number; zone: string; syllabusRoute?: string; year: number; format: string; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; setCount: number; years: string; heldQuestionIds: string[]; paperFacts: Record<string, { name: string; totalMarks: number }>; assetVerification: string; runtimeArtifact: { originalCandidateRuntimeSha256: string; sourceCommit: string; sourceRepository: string }; taxonomy: { sha256: string }; questions: Row[] };
const manifest = manifestJson as unknown as { objectPrefix: string; originalCandidateRuntimeSha256: string; assets: { objectKey: string; size: number }[] };
const finalized = runtime.assetVerification === "verified_readback";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };

describe("CBSE Class 10 Maths: held, wired into the private release lane", () => {
  it("stays hidden and held, with its real counts", () => {
    expect(getCatalogBank(slug)).toMatchObject({ pendingStorage: true, questionCount: 3826, paperCount: 146, years: "2023-2026", productId: "bank_cbse_10_maths" });
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

describe("CBSE Class 10 Maths runtime", () => {
  it("ships 3,826 questions from 146 of 156 sets (10 are question papers CBSE does not publish), holding 58", () => {
    expect(runtime.questionCount).toBe(3826);
    expect(runtime.paperCount).toBe(146);
    expect(runtime.setCount).toBe(156);
    expect(runtime.years).toBe("2023-2026");
    expect(runtime.heldQuestionIds).toHaveLength(58);
    const served = new Set(runtime.questions.map((question) => question.id));
    expect(runtime.heldQuestionIds.some((id) => served.has(id))).toBe(false);
    expect(runtime.paperFacts).toEqual({ 1: { name: "Mathematics (Standard)", durationMinutes: 180, totalMarks: 80 }, 2: { name: "Mathematics (Basic)", durationMinutes: 180, totalMarks: 80 } });
  });

  it("puts Standard (sets 30/…) on paper 1 and Basic (430/…) on paper 2; five shared questions are marked for both", () => {
    expect(runtime.questions.filter((question) => question.paper === 1).every((question) => question.zone.startsWith("30/"))).toBe(true);
    expect(runtime.questions.filter((question) => question.paper === 2).every((question) => question.zone.startsWith("430/"))).toBe(true);
    expect([runtime.questions.filter((question) => question.paper === 1).length, runtime.questions.filter((question) => question.paper === 2).length]).toEqual([2026, 1800]);
    expect(runtime.questions.filter((question) => question.syllabusRoute === "both").map((question) => question.id).sort()).toEqual(SHARED);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
    const candidate = finalized ? reconstructCandidate(runtimeJson) : runtimeJson;
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
    expect(runtime.runtimeArtifact).toMatchObject({ sourceRepository: "cbse-10-maths-topic-practice", sourceCommit: "369d650" });
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/cbse-10-maths-taxonomy.json"))).digest("hex")).toBe(runtime.taxonomy.sha256);
  });

  it.skipIf(!existsSync(sourceRootPath()))("rebuilds byte-identically from the pinned source workspace", async () => {
    const built = await buildRuntime();
    if (finalized) expect(JSON.stringify(reconstructCandidate(runtimeJson))).toBe(JSON.stringify(built.artifact));
    else expect(built.serialized).toBe(readFileSync(join(ROOT, "src/data/production/cbse-10-maths.json"), "utf8"));
  });

  it("frees 2023 (main and compartment): 969 questions", () => {
    expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(runtime.questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(969);
  });

  it("maps every alias set's question (either level) to its canonical question", () => {
    const block = (aliases as { banks: Record<string, Record<string, string>> }).banks[slug];
    expect(Object.keys(block)).toHaveLength(2503);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(block)) {
      expect(ids.has(canonical), alias).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("serves CBSE's key on every MCQ", () => {
    const answers = buildMcqAnswerMap(slug, runtime.questions);
    expect(runtime.questions.filter((question) => isMcqRow(slug, question))).toHaveLength(1603);
    expect(answers.size).toBe(1603);
  });
});

describe("CBSE Class 10 Maths level tabs on the real rows", () => {
  const questions = normalizeBankQuestions(slug, runtime.questions);
  it("offers Standard, Basic and All, opening on Standard", () => {
    expect(routeConfigFor(slug)!.options.map((option) => option.label)).toEqual(["Standard", "Basic"]);
    expect(defaultRouteSelection(slug)).toBe("standard");
  });

  it("Basic shows exactly the Basic-only and shared questions; Standard the Standard-only and shared ones", () => {
    const basic = questions.filter((question) => matchesCourseRoute(question.syllabusRoute, "basic"));
    const standard = questions.filter((question) => matchesCourseRoute(question.syllabusRoute, "standard"));
    expect(basic).toHaveLength(1800 + 5);
    expect(standard).toHaveLength(2026);
    expect(basic.filter((question) => question.paper === 1).map((question) => question.id).sort()).toEqual(SHARED);
    expect(basic.every((question) => question.paper === 2 || question.syllabusRoute === "both")).toBe(true);
    expect(standard.every((question) => question.paper === 1)).toBe(true);
    expect(questions.filter((question) => matchesCourseRoute(question.syllabusRoute, "all"))).toHaveLength(3826);
  });

  it("keeps the shared mark through the public bank index the explorer loads", () => {
    const hydrated = questions.map((question) => publicMetadataToQuestion(toPublicQuestionMetadata(question), slug));
    expect(hydrated.filter((question) => matchesCourseRoute(question.syllabusRoute, "basic"))).toHaveLength(1805);
  });

  it("lists the fifteen chapters in curriculum order for either level", () => {
    expect(getTopicOptions(questions)).toEqual([...cbseChapterOrder(slug)]);
    expect((taxonomyJson as { chapters: { label: string }[] }).chapters.map((chapter) => chapter.label)).toEqual([...cbseChapterOrder(slug)]);
    expect(getTopicOptions(questions.filter((question) => matchesCourseRoute(question.syllabusRoute, "basic")))).toEqual([...cbseChapterOrder(slug)]);
  });

  it("narrows subtopics to the chosen chapter, in curriculum order", () => {
    const sections = CBSE_SUBTOPICS[slug]!;
    for (const question of questions) {
      const own = [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) => sections[topic] ?? []);
      for (const subtopic of question.subtopics) expect(own, `${question.id} ${subtopic}`).toContain(subtopic);
    }
    const trig = getSubtopicGroups(questions, ["Trigonometric Identities"], []);
    expect(trig.relevant).toEqual(sections["Trigonometric Identities"].filter((label) => trig.relevant.includes(label)));
  });
});

describe("CBSE Class 10 Maths storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 8,619 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(8619);
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 8619, uniqueKeys: 8619, mismatches: 0, localSha256ReHashed: 8619, sha256MatchesSegmentationRecord: 8619, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(3826);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
