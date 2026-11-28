import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/cbse-12-chemistry.json";
import taxonomyJson from "@/data/cbse-12-chemistry-taxonomy.json";
import privateIndex from "@/data/private-index/cbse-12-chemistry.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/cbse-12-chemistry.manifest.json";
import dryRun from "../../data/storage/cbse-12-chemistry.dry-run.json";
import receipt from "../../data/storage/cbse-12-chemistry.receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { buildRuntime, reconstructCandidate, sourceRootPath } from "../../scripts/generate-cbse-12-chemistry-runtime.mjs";
import { freeQuestionYears, isPreviewQuestion } from "@/lib/access";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { getCatalogBank, getCatalogBanksForDisplay, isPendingStoragePreview } from "@/lib/catalog";
import { CBSE_SUBTOPICS, cbseChapterOrder } from "@/lib/cbse";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const slug = "cbse-12-chemistry";
const CANDIDATE = "f34054df3005f67b3aa77090e5109d4c3a6c405812da6a14add691586b72c71e";
const PREFIX = "cbse-12-chemistry/releases/full1844-v1-f34054df3005";
type Row = Record<string, unknown> & { id: string; year: number; paperId: string; format: string; marks: number; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; questionImages: string[]; markschemeImages: string[]; aliasIds: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; heldQuestionIds: string[]; excludedFromSelfMarkingIds: string[]; paperFacts: Record<string, { totalMarks: number; durationMinutes: number }>; publicationStatus: string; runtimeArtifact: { originalCandidateRuntimeSha256: string; sourceCommit: string; sourceRepository: string }; taxonomy: { sha256: string }; questions: Row[] };
const manifest = manifestJson as unknown as { objectPrefix: string; storageState: string; originalCandidateRuntimeSha256: string; assets: { objectKey: string; size: number; contentType: string }[] };
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };

describe("CBSE Class 12 Chemistry: held, wired into the private release lane", () => {
  it("stays hidden and held, with its real counts", () => {
    const bank = getCatalogBank(slug)!;
    expect(bank).toMatchObject({ pendingStorage: true, questionCount: 1844, paperCount: 75, years: "2023-2026", productId: "bank_cbse_12_chemistry" });
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

describe("CBSE Class 12 Chemistry runtime", () => {
  it("ships 1,844 questions from 75 sets, 2023-2026 main and compartment, holding 5", () => {
    expect(runtime.questionCount).toBe(1844);
    expect(runtime.questions).toHaveLength(1844);
    expect(runtime.paperCount).toBe(75);
    expect(runtime.years).toBe("2023-2026");
    expect(new Set(runtime.questions.map((question) => question.session))).toEqual(new Set(["Main", "Compartment"]));
    expect(runtime.heldQuestionIds).toHaveLength(5);
    for (const id of runtime.heldQuestionIds) expect(runtime.questions.some((question) => question.id === id)).toBe(false);
    expect(runtime.paperFacts).toEqual({ 1: { name: "Chemistry (Theory)", durationMinutes: 180, totalMarks: 70 } });
    expect(runtime.questions.every((question) => question.paper === 1 && question.maxMarks === 70 && /^56\/[0-9A-Z]+\/\d$/.test(question.zone as string) && question.component === question.zone)).toBe(true);
    expect(runtime.questions.every((question) => (question.accessibleText as string).length > 10)).toBe(true);
    expect(runtime.questions.filter((question) => question.format === "multiple_choice")).toHaveLength(933);
  });

  it("is finalized from its pinned, content-derived candidate", () => {
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(releaseRuntimeSha256(runtimeJson)).toBe((runtimeJson.runtimeArtifact as unknown as { runtimeSha256: string }).runtimeSha256);
    const candidate = reconstructCandidate(runtimeJson);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
    expect(runtime.runtimeArtifact).toMatchObject({ sourceRepository: "cbse-12-chemistry-topic-practice", sourceCommit: "33bc420" });
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/cbse-12-chemistry-taxonomy.json"))).digest("hex")).toBe(runtime.taxonomy.sha256);
  });

  it.skipIf(!existsSync(sourceRootPath()))("rebuilds byte-identically from the pinned source workspace", async () => {
    const built = await buildRuntime();
    expect(JSON.stringify(reconstructCandidate(runtimeJson))).toBe(JSON.stringify(built.artifact));
    expect(built.taxonomySerialized).toBe(readFileSync(join(ROOT, "src/data/cbse-12-chemistry-taxonomy.json"), "utf8"));
  });

  it("frees 2023 (main and compartment): 448 questions", () => {
    expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(runtime.questions.filter((question) => question.year === 2023)).toHaveLength(448);
    expect(runtime.questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(448);
  });

  it("maps every alias set's question to its canonical question", () => {
    const block = (aliases as { banks: Record<string, Record<string, string>> }).banks[slug];
    expect(Object.keys(block)).toHaveLength(997);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(block)) {
      expect(ids.has(canonical), alias).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });
});

describe("CBSE Class 12 Chemistry answers", () => {
  const answers = buildMcqAnswerMap(slug, runtime.questions);
  it("serves CBSE's official key on 927 MCQs, either letter on the 5 settled two-letter keys", () => {
    expect(runtime.questions.filter((question) => isMcqRow(slug, question))).toHaveLength(933);
    expect(answers.size).toBe(927);
    const two = [...answers].filter(([, answer]) => answer.answers.length === 2);
    expect(two.map(([id]) => id).sort()).toEqual(["cbse12c-2023-m-151-q16", "cbse12c-2024-m-151-q14", "cbse12c-2024-m-152-q15", "cbse12c-2024-m-153-q13", "cbse12c-2026-m-121-q14"]);
    expect([...answers.values()].every((answer) => answer.note === null)).toBe(true);
  });

  it("serves the six full-marks-for-any-option items without a key, never self-marked", () => {
    expect(runtime.excludedFromSelfMarkingIds).toHaveLength(6);
    for (const id of runtime.excludedFromSelfMarkingIds) {
      const row = runtime.questions.find((question) => question.id === id)!;
      expect(row).toMatchObject({ excludedFromSelfMarking: true, format: "multiple_choice" });
      expect(row.answer).toBeUndefined();
      expect(answers.has(id)).toBe(false);
    }
  });
});

describe("CBSE Class 12 Chemistry topic picker on the real rows", () => {
  const questions = normalizeBankQuestions(slug, runtime.questions);
  it("lists the ten chapters in curriculum order, matching the app's chapter list and the taxonomy", () => {
    expect(getTopicOptions(questions)).toEqual([...cbseChapterOrder(slug)]);
    expect((taxonomyJson as { chapters: { label: string }[] }).chapters.map((chapter) => chapter.label)).toEqual([...cbseChapterOrder(slug)]);
  });

  it("narrows subtopics to the chosen chapter, in curriculum order", () => {
    const sections = CBSE_SUBTOPICS[slug]!;
    expect(Object.keys(sections)).toEqual([...cbseChapterOrder(slug)]);
    for (const question of questions) {
      const own = [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) => sections[topic] ?? []);
      for (const subtopic of question.subtopics) expect(own, `${question.id} ${subtopic}`).toContain(subtopic);
    }
    const amines = getSubtopicGroups(questions, ["Amines"], []);
    expect(amines.relevant.length).toBeGreaterThan(0);
    expect(amines.relevant.every((label) => sections.Amines.includes(label))).toBe(true);
    expect(amines.relevant).toEqual(sections.Amines.filter((label) => amines.relevant.includes(label)));
  });

  it("finds every question that awards marks for a chapter", () => {
    const amines = questions.filter((question) => [question.primaryTopic, ...question.secondaryTopics].includes("Amines"));
    expect(amines.length).toBe(177);
  });
});

describe("CBSE Class 12 Chemistry storage", () => {
  it("is finalized against a complete verified readback of exactly the manifest's crops", () => {
    const read = receipt as unknown as { bank: string; storageState: string; failed: unknown[]; assetManifestSha256: string; completed: string[]; readbackProvenance: { log: string; logSha256: string; existedBefore: number } };
    expect(read).toMatchObject({ bank: slug, storageState: "verified_readback", failed: [], assetManifestSha256: manifestSha256(manifest) });
    expect([...read.completed].sort()).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    const logText = readFileSync(join(ROOT, read.readbackProvenance.log), "utf8");
    expect(createHash("sha256").update(logText).digest("hex")).toBe(read.readbackProvenance.logSha256);
    const log = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean });
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset as unknown as { sha256: string; size: number }]));
    expect(log).toHaveLength(4072);
    expect(new Set(log.map((row) => row.key)).size).toBe(4072);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta).toMatchObject({ assetVerification: "verified_readback", assetManifestSha256: manifestSha256(manifest) });
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/cbse-12-chemistry.receipt.json"), "utf8")).digest("hex"));
  });

  it("plans a create-only upload of exactly the runtime's 4,072 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(4072);
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.contentType === "image/webp")).toBe(true);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 4072, uniqueKeys: 4072, mismatches: 0, localSha256ReHashed: 4072, sha256MatchesSegmentationRecord: 4072, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(1844);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
