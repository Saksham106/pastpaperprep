import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/cbse-12-physics.json";
import taxonomyJson from "@/data/cbse-12-physics-taxonomy.json";
import privateIndex from "@/data/private-index/cbse-12-physics.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/cbse-12-physics.manifest.json";
import dryRun from "../../data/storage/cbse-12-physics.dry-run.json";
import { assertContentSealedCandidate, blankedCandidateSha256, RELEASE_BANKS } from "../../scripts/igcse-release.mjs";
import { buildRuntime, reconstructCandidate, sourceRootPath } from "../../scripts/generate-cbse-12-physics-runtime.mjs";
import { McqAnswerView } from "@/components/McqAnswerView";
import { freeQuestionYears, isPreviewQuestion } from "@/lib/access";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { calculatorAllowed } from "@/lib/calculator-policy.mjs";
import { getCatalogBank, getCatalogBanksForDisplay, isPendingStoragePreview } from "@/lib/catalog";
import { CBSE_SUBTOPICS, cbseChapterOrder } from "@/lib/cbse";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { isMcqAnswer } from "@/lib/mcq-answer";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const slug = "cbse-12-physics";
const CANDIDATE = "d2e3683c8e1d91a9d7c540c229d251754379406d3b25c64c304a2e0eabea6225";
const PREFIX = "cbse-12-physics/releases/full1624-v1-d2e3683c8e1d";
const DISPUTED = ["cbse12p-2023-c-1c3-q17", "cbse12p-2023-m-121-q5", "cbse12p-2023-m-122-q13", "cbse12p-2023-m-123-q15", "cbse12p-2024-c-1s1-q10", "cbse12p-2025-c-1s1-q11"];
type Row = Record<string, unknown> & { id: string; year: number; format: string; zone: string; answer?: string; keyNote?: string; excludedFromSelfMarking?: boolean; accessibleText: string; primaryTopic: string; secondaryTopics: string[]; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; heldQuestionIds: string[]; excludedFromSelfMarkingIds: string[]; assetVerification: string; runtimeArtifact: { originalCandidateRuntimeSha256: string; sourceCommit: string; sourceRepository: string }; taxonomy: { sha256: string }; questions: Row[] };
const manifest = manifestJson as unknown as { objectPrefix: string; originalCandidateRuntimeSha256: string; assets: { objectKey: string; size: number; contentType: string }[] };
const finalized = runtime.assetVerification === "verified_readback";
const row = (id: string) => runtime.questions.find((question) => question.id === id)!;
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" };

describe("CBSE Class 12 Physics: held, wired into the private release lane", () => {
  it("stays hidden and held, with its real counts", () => {
    expect(getCatalogBank(slug)).toMatchObject({ pendingStorage: true, questionCount: 1624, paperCount: 74, years: "2023-2026", productId: "bank_cbse_12_physics" });
    expect(HELD_BANKS).toContain(slug);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getBank(slug, PRODUCTION)).toBeUndefined();
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(false);
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(true);
  });

  it("rides the shared private-storage lane at 1.5 px/pt, with no calculator", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect((RELEASE_BANKS as Record<string, { prefix: string; originalCandidateRuntimeSha256: string }>)[slug]).toMatchObject({ prefix: PREFIX, originalCandidateRuntimeSha256: CANDIDATE });
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(calculatorAllowed(slug, { paper: 1, year: 2025 })).toBe(false);
  });
});

describe("CBSE Class 12 Physics runtime", () => {
  it("ships 1,624 questions with questions in 74 of the 75 sets, holding 405", () => {
    expect(runtime.questionCount).toBe(1624);
    expect(runtime.paperCount).toBe(74);
    expect(runtime.years).toBe("2023-2026");
    expect(runtime.heldQuestionIds).toHaveLength(405);
    const served = new Set(runtime.questions.map((question) => question.id));
    expect(runtime.heldQuestionIds.some((id) => served.has(id))).toBe(false);
    expect(runtime.questions.every((question) => /^55\/[0-9A-Z]+\/\d$/.test(question.zone))).toBe(true);
    expect(runtime.questions.filter((question) => question.format === "multiple_choice")).toHaveLength(707);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
    const candidate = finalized ? reconstructCandidate(runtimeJson) : runtimeJson;
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
    expect(runtime.runtimeArtifact).toMatchObject({ sourceRepository: "cbse-12-physics-topic-practice", sourceCommit: "b2537af" });
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/cbse-12-physics-taxonomy.json"))).digest("hex")).toBe(runtime.taxonomy.sha256);
  });

  it.skipIf(!existsSync(sourceRootPath()))("rebuilds byte-identically from the pinned source workspace", async () => {
    const built = await buildRuntime();
    if (finalized) expect(JSON.stringify(reconstructCandidate(runtimeJson))).toBe(JSON.stringify(built.artifact));
    else expect(built.serialized).toBe(readFileSync(join(ROOT, "src/data/production/cbse-12-physics.json"), "utf8"));
  });

  it("frees 2023 (main and compartment): 504 questions", () => {
    expect(freeQuestionYears(slug)).toEqual([2023]);
    expect(runtime.questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(504);
  });

  it("maps every alias set's question to its canonical question", () => {
    const block = (aliases as { banks: Record<string, Record<string, string>> }).banks[slug];
    expect(Object.keys(block)).toHaveLength(720);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(block)) {
      expect(ids.has(canonical), alias).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("serves the reviewed transcript fixes and the recorded label audit", () => {
    expect(row("cbse12p-2024-m-141-q9").accessibleText).toMatch(/30°/);
    expect(row("cbse12p-2025-m-121-q10")).toMatchObject({ primaryTopic: "Atoms", secondaryTopics: ["Dual Nature of Radiation and Matter"] });
  });
});

describe("CBSE Class 12 Physics answers", () => {
  const answers = buildMcqAnswerMap(slug, runtime.questions);

  it("serves the six disputed keys with CBSE's letter and the owner-approved note, never self-marked", () => {
    for (const id of DISPUTED) {
      const question = row(id);
      expect(question.excludedFromSelfMarking).toBe(true);
      expect(question.keyNote).toMatch(/^CBSE's marking scheme gives \([A-D]\)\. The physics suggests \([A-D]\)/);
      const answer = answers.get(id)!;
      expect(answer).toEqual({ answers: [question.answer], note: question.keyNote });
      expect(isMcqAnswer(answer)).toBe(true);
    }
    const answer = answers.get("cbse12p-2023-c-1c3-q17")!;
    render(<McqAnswerView answer={answer} />);
    expect(screen.getByText("D", { selector: ".mcq-answer-chip" })).toBeInTheDocument();
    expect(screen.getByText(/The physics suggests \(C\): a proton and an alpha particle/)).toBeInTheDocument();
  });

  it("serves the thirteen 'no option correct / full marks' items without a key, and the rest with CBSE's key", () => {
    const notices = runtime.excludedFromSelfMarkingIds.filter((id) => !DISPUTED.includes(id));
    expect(notices).toHaveLength(13);
    for (const id of notices) {
      expect(row(id)).toMatchObject({ excludedFromSelfMarking: true });
      expect(row(id).answer).toBeUndefined();
      expect(answers.has(id)).toBe(false);
    }
    expect(runtime.questions.filter((question) => isMcqRow(slug, question))).toHaveLength(707);
    expect(answers.size).toBe(707 - 13);
  });

  it("takes either letter where the scheme prints two, and the settled key where OCR misread one", () => {
    for (const id of ["cbse12p-2025-m-121-q12", "cbse12p-2025-m-122-q11", "cbse12p-2025-m-123-q10"]) expect(answers.get(id)).toEqual({ answers: ["A", "C"], note: null });
    expect(answers.get("cbse12p-2026-m-123-q12")).toEqual({ answers: ["B"], note: null });
  });
});

describe("CBSE Class 12 Physics topic picker on the real rows", () => {
  const questions = normalizeBankQuestions(slug, runtime.questions);
  it("lists the fourteen chapters in curriculum order, matching the app and the taxonomy", () => {
    expect(getTopicOptions(questions)).toEqual([...cbseChapterOrder(slug)]);
    expect((taxonomyJson as { chapters: { label: string }[] }).chapters.map((chapter) => chapter.label)).toEqual([...cbseChapterOrder(slug)]);
  });

  it("narrows subtopics to the chosen chapter, in curriculum order", () => {
    const sections = CBSE_SUBTOPICS[slug]!;
    for (const question of questions) {
      const own = [question.primaryTopic, ...question.secondaryTopics].flatMap((topic) => sections[topic] ?? []);
      for (const subtopic of question.subtopics) expect(own, `${question.id} ${subtopic}`).toContain(subtopic);
    }
    const optics = getSubtopicGroups(questions, ["Ray Optics and Optical Instruments"], []);
    expect(optics.relevant.length).toBeGreaterThan(0);
    expect(optics.relevant).toEqual(sections["Ray Optics and Optical Instruments"].filter((label) => optics.relevant.includes(label)));
  });
});

describe("CBSE Class 12 Physics storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 3,909 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(3909);
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 3909, uniqueKeys: 3909, mismatches: 0, localSha256ReHashed: 3909, sha256MatchesSegmentationRecord: 3909, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(1624);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "keyNote", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
