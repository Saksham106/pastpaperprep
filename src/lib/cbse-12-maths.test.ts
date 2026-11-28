import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/cbse-12-maths.json";
import taxonomyJson from "@/data/cbse-12-maths-taxonomy.json";
import privateIndex from "@/data/private-index/cbse-12-maths.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/cbse-12-maths.manifest.json";
import dryRun from "../../data/storage/cbse-12-maths.dry-run.json";
import { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } from "../../scripts/igcse-release.mjs";
import { buildRuntime, reconstructCandidate, sourceRootPath } from "../../scripts/generate-cbse-12-maths-runtime.mjs";
import { freeQuestionYears, isPreviewQuestion } from "@/lib/access";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { getCatalogBank, getCatalogBanksForDisplay, isPendingStoragePreview } from "@/lib/catalog";
import { CBSE_SUBTOPICS, cbseChapterOrder } from "@/lib/cbse";
import { routeConfigFor } from "@/lib/course-route";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { filterQuestions } from "@/lib/question-filter";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const slug = "cbse-12-maths";
const CANDIDATE = "6929531a08feab796a760c86559a7639d2d57796f14454840075cc95c74a13b5";
const PREFIX = "cbse-12-maths/releases/full2088-v1-6929531a08fe";
const RANDOM_VARIABLES = "Random variables and probability distributions (earlier syllabus)";
type Row = Record<string, unknown> & { id: string; year: number; format: string; zone: string; subtopics: string[]; sourceQuestionUrl: string; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; heldQuestionIds: string[]; excludedFromSelfMarkingIds: string[]; gateWaivers: { gate: string; expires: string; papers: string[] }[]; assetVerification: string; runtimeArtifact: { originalCandidateRuntimeSha256: string; sourceCommit: string; sourceRepository: string }; taxonomy: { sha256: string }; questions: Row[] };
const manifest = manifestJson as unknown as { objectPrefix: string; originalCandidateRuntimeSha256: string; assets: { objectKey: string; size: number }[] };
const finalized = runtime.assetVerification === "verified_readback";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };

describe("CBSE Class 12 Maths: held, wired into the private release lane", () => {
  it("stays hidden and held, with its real counts", () => {
    expect(getCatalogBank(slug)).toMatchObject({ pendingStorage: true, questionCount: 2088, paperCount: 75, years: "2023-2026", productId: "bank_cbse_12_maths" });
    expect(HELD_BANKS).toContain(slug);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getBank(slug, PRODUCTION)).toBeUndefined();
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(false);
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(true);
    expect(routeConfigFor(slug)).toBeUndefined();
  });

  it("rides the shared private-storage lane at 1.5 px/pt", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect((RELEASE_BANKS as Record<string, { prefix: string; originalCandidateRuntimeSha256: string }>)[slug]).toMatchObject({ prefix: PREFIX, originalCandidateRuntimeSha256: CANDIDATE });
    expect(inferredPdfDpiForBank(slug)).toBe(108);
  });
});

describe("CBSE Class 12 Maths runtime", () => {
  it("ships 2,088 questions from all 75 sets, holding 201", () => {
    expect(runtime.questionCount).toBe(2088);
    expect(runtime.paperCount).toBe(75);
    expect(runtime.years).toBe("2023-2026");
    expect(runtime.heldQuestionIds).toHaveLength(201);
    const served = new Set(runtime.questions.map((question) => question.id));
    expect(runtime.heldQuestionIds.some((id) => served.has(id))).toBe(false);
    expect(runtime.questions.every((question) => /^65\/[0-9A-Z]+\/\d$/.test(question.zone))).toBe(true);
    expect(runtime.questions.every((question) => question.sourceQuestionUrl.startsWith("https://www.cbse.gov.in/"))).toBe(true);
    expect(runtime.questions.filter((question) => question.format === "multiple_choice")).toHaveLength(967);
  });

  it("records the two coordinator waivers, expiring 2026-12-15", () => {
    expect(runtime.gateWaivers.map((waiver) => [waiver.gate, waiver.papers.length, waiver.expires])).toEqual([
      ["cbse.segmentation_clean", 6, "2026-12-15"],
      ["cbse.pages_alternate", 3, "2026-12-15"],
    ]);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
    const candidate = finalized ? reconstructCandidate(runtimeJson) : runtimeJson;
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
    expect(runtime.runtimeArtifact).toMatchObject({ sourceRepository: "cbse-12-maths-topic-practice", sourceCommit: "ec81723" });
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/cbse-12-maths-taxonomy.json"))).digest("hex")).toBe(runtime.taxonomy.sha256);
  });

  it.skipIf(!existsSync(sourceRootPath()))("rebuilds byte-identically from the pinned source workspace", async () => {
    const built = await buildRuntime();
    if (finalized) expect(JSON.stringify(reconstructCandidate(runtimeJson))).toBe(JSON.stringify(built.artifact));
    else expect(built.serialized).toBe(readFileSync(join(ROOT, "src/data/production/cbse-12-maths.json"), "utf8"));
  });

  it("frees 2023 (main and compartment): 477 questions", () => {
    expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(runtime.questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(477);
  });

  it("maps every alias set's question to its canonical question", () => {
    const block = (aliases as { banks: Record<string, Record<string, string>> }).banks[slug];
    expect(Object.keys(block)).toHaveLength(1034);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(block)) {
      expect(ids.has(canonical), alias).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });
});

describe("CBSE Class 12 Maths answers", () => {
  const answers = buildMcqAnswerMap(slug, runtime.questions);
  it("serves CBSE's key on every MCQ but the four scheme-notice items; either printed answer scores on the two-answer key", () => {
    expect(runtime.questions.filter((question) => isMcqRow(slug, question))).toHaveLength(967);
    expect(runtime.excludedFromSelfMarkingIds).toHaveLength(6);
    for (const id of ["cbse12m-2023-m-121-q18", "cbse12m-2025-m-121-q6", "cbse12m-2025-m-161-q16", "cbse12m-2025-m-163-q17"]) expect(answers.has(id)).toBe(false);
    expect(answers.size).toBe(963);
    expect(answers.get("cbse12m-2024-m-143-q5")).toEqual({ answers: ["B", "C"], note: null });
  });

  it("shows CBSE's key with the note on the two disputed keys (owner's rule: no auto-mark, show note)", () => {
    expect(answers.get("cbse12m-2023-m-142-q13")).toEqual({ answers: ["B"], note: expect.stringContaining("The maths gives (a) zero") });
    expect(answers.get("cbse12m-2026-m-151-q18")).toEqual({ answers: ["D"], note: expect.stringContaining("The data are inconsistent") });
    for (const id of ["cbse12m-2023-m-142-q13", "cbse12m-2026-m-151-q18"]) expect(runtime.excludedFromSelfMarkingIds).toContain(id);
  });
});

describe("CBSE Class 12 Maths topics, with the earlier-syllabus subtopic", () => {
  const questions = normalizeBankQuestions(slug, runtime.questions);
  it("lists the thirteen chapters in curriculum order", () => {
    expect(getTopicOptions(questions)).toEqual([...cbseChapterOrder(slug)]);
    expect((taxonomyJson as { chapters: { label: string }[] }).chapters.map((chapter) => chapter.label)).toEqual([...cbseChapterOrder(slug)]);
  });

  it("tags random variables only on 2023-2025 papers, and filters to them under Probability", () => {
    const tagged = runtime.questions.filter((question) => question.subtopics.includes(RANDOM_VARIABLES));
    expect(tagged).toHaveLength(42);
    expect(new Set(tagged.map((question) => question.year))).toEqual(new Set([2023, 2024, 2025]));
    expect(filterQuestions(questions, { subtopics: [RANDOM_VARIABLES] })).toHaveLength(42);
    const probability = (taxonomyJson as { chapters: { label: string; subtopics: { label: string; allowedYears?: number[] }[] }[] }).chapters.find((chapter) => chapter.label === "Probability")!;
    expect(probability.subtopics.at(-1)).toMatchObject({ label: RANDOM_VARIABLES, allowedYears: [2023, 2024, 2025] });
  });

  it("narrows subtopics to the chosen chapter, in curriculum order", () => {
    const sections = CBSE_SUBTOPICS[slug]!;
    expect(Object.values(sections).flat()).toHaveLength(41);
    for (const question of questions) {
      const own = [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) => sections[topic] ?? []);
      for (const subtopic of question.subtopics) expect(own, `${question.id} ${subtopic}`).toContain(subtopic);
    }
    const probability = getSubtopicGroups(questions, ["Probability"], []);
    expect(probability.relevant).toEqual(sections.Probability);
  });
});

describe("CBSE Class 12 Maths storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 4,671 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(4671);
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 4671, uniqueKeys: 4671, mismatches: 0, localSha256ReHashed: 4671, sha256MatchesSegmentationRecord: 4671, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(2088);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
