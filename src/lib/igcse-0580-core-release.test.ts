import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/raw/igcse.json";
import { getCatalogBank } from "@/lib/catalog";
import receipt from "../../docs/igcse-0580-2026-core-addition.json";
import { ADDED_0580_QUESTION_IDS, split0580Raw } from "@/lib/igcse-0580-additions.mjs";

type RuntimeQuestion = {
  id: string;
  year: number;
  reviewStatus?: string;
  route?: string;
  primaryTopic?: string;
  questionImages: string[];
  markschemeImages: string[];
  classificationEvidence?: {
    method?: string;
    model?: string;
    status?: string;
    confidence?: number | string;
    artifactSha256?: string;
  };
};

type Runtime = {
  version: number;
  papers: Array<{ id: string; route?: string }>;
  questions: RuntimeQuestion[];
  coreClassificationArtifact: string;
  coreClassificationSha256: string;
  coreClassificationArtifacts: Array<{ lane: string; path: string; sha256: string; rows: number; servedQuestions: number; papers: number }>;
  excludedQuestionIds: string[];
  extendedRuntimeSha256: string;
};

const data = runtime as Runtime;
const WITHDRAWN = ["0580-2025-november-33-q20", "0580-2025-november-33-q27"];
const JEV_ARTIFACT_SHA256 = "6879e1d152c0512ed0c942b2bbe15da63a513e5370a9979b232249c3de7bc005";
const MANUAL_ARTIFACT_SHA256 = "f42912e2c9c070d3f319903226d4a206d8544ce9346b6a54fe73c7f427fe1def";
const PRE_CORE_RUNTIME_SHA256 = "9c728dcc6cd46a3b9ee9100cd969dd5b0b260374b51f9bf69c328215678147d9";
const EXTENDED_QUESTIONS_SEMANTIC_SHA256 = "3d975a7444f742a39f4d4298d5fa3dbaf9edb03199f5a8cc0184fd4b1687541b";
const EXTENDED_PAPERS_SEMANTIC_SHA256 = "8e186df4c259de0cdaeecd191889bbecd65218758fa6fbe25bb589fb409d8c0b";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function semanticHash(rows: Array<{ id: string }>): string {
  return createHash("sha256")
    .update(stableJson([...rows].sort((left, right) => left.id.localeCompare(right.id))))
    .digest("hex");
}

const core = data.questions.filter((question) => question.route === "Core");
const added = new Set<string>(ADDED_0580_QUESTION_IDS);
const core2021To2025 = core.filter((question) => !added.has(question.id));
const core2026 = core.filter((question) => added.has(question.id));

describe("IGCSE Mathematics 0580 Core 2021-2025 release plus the reviewed Core 2026 addition", () => {
  it("adds the complete bounded Core corpus without replacing Extended", () => {
    const extended = data.questions.filter((question) => question.route !== "Core");

    expect(data.version).toBe(3);
    expect(data.questions).toHaveLength(4174);
    expect(data.papers).toHaveLength(225);
    expect(core).toHaveLength(1490);
    expect(core2021To2025).toHaveLength(1283);
    expect(core2026).toHaveLength(207);
    expect(extended).toHaveLength(2684);
    expect(new Set(data.questions.map((question) => question.id)).size).toBe(4174);
    expect(data.excludedQuestionIds).toEqual(WITHDRAWN);
    expect(data.questions.some((question) => WITHDRAWN.includes(question.id))).toBe(false);
    expect(data.extendedRuntimeSha256).toBe(PRE_CORE_RUNTIME_SHA256);
    expect(semanticHash(extended)).toBe(EXTENDED_QUESTIONS_SEMANTIC_SHA256);
    expect(semanticHash(data.papers.filter((paper) => paper.route !== "Core"))).toBe(EXTENDED_PAPERS_SEMANTIC_SHA256);
  });

  it("keeps the 2021-2025 base bank and adds exactly the pinned 2026 Core rows and papers", () => {
    const { base, added: rows, addedPapers } = split0580Raw(data);
    expect(base.questions).toHaveLength(3967);
    expect(base.papers).toHaveLength(217);
    expect(rows.map((row: { id: string }) => row.id)).toEqual(receipt.addedQuestionIds);
    expect(core2026.map((row) => row.id)).toEqual(receipt.addedQuestionIds);
    expect(addedPapers.map((paper: { id: string }) => paper.id)).toEqual(receipt.paperIds);
    expect(receipt.addedQuestionIds).toHaveLength(207);
    expect(core2026.every((question) => question.year === 2026)).toBe(true);
    expect(core2021To2025.every((question) => question.year >= 2021 && question.year <= 2025)).toBe(true);
  });

  it("keeps Core classifications controlled, honest, and fully asset-backed", () => {
    // The singular header keys still name the 2021-2025 Jev lane; the lane list adds the 2026 lane.
    expect(data.coreClassificationArtifact).toBe("data/core-2021-2025/jev-classification-final.json");
    expect(data.coreClassificationSha256).toBe(JEV_ARTIFACT_SHA256);
    expect(data.coreClassificationArtifacts).toEqual([
      { lane: "data/core-2021-2025", path: "data/core-2021-2025/jev-classification-final.json", sha256: JEV_ARTIFACT_SHA256, rows: 1285, servedQuestions: 1283, papers: 70 },
      { lane: "data/core-2026", path: "data/core-2026/core-classification-final.json", sha256: MANUAL_ARTIFACT_SHA256, rows: 207, servedQuestions: 207, papers: 8 },
    ]);
    expect(core.every((question) => question.primaryTopic && question.primaryTopic !== "Other")).toBe(true);
    expect(core.every((question) => question.questionImages.length > 0 && question.markschemeImages.length > 0)).toBe(true);
    expect(core.every((question) => question.questionImages.every((path) => path.startsWith("core-questions/") && path.endsWith(".webp")))).toBe(true);
    expect(core.every((question) => question.markschemeImages.every((path) => path.startsWith("core-markschemes/") && path.endsWith(".webp")))).toBe(true);
    expect(core.every((question) => typeof question.classificationEvidence?.confidence === "number")).toBe(true);

    // 2021-2025: Jev exactly as released.
    expect(core2021To2025.every((question) => question.classificationEvidence?.method?.startsWith("Jev text classification"))).toBe(true);
    expect(core2021To2025.every((question) => question.classificationEvidence?.model === "jev-1.13.0")).toBe(true);
    expect(core2021To2025.every((question) => question.classificationEvidence?.artifactSha256 === JEV_ARTIFACT_SHA256)).toBe(true);
    expect(core2021To2025.every((question) => question.reviewStatus === "jev-classified-mvp")).toBe(true);

    // 2026: Jev could not run; the manual two-pass review is labelled as such and never as Jev.
    expect(core2026.every((question) => question.classificationEvidence?.method?.startsWith("Manual two-pass classification"))).toBe(true);
    expect(core2026.every((question) => question.classificationEvidence?.model === "manual-two-pass-review-v1")).toBe(true);
    expect(core2026.every((question) => question.classificationEvidence?.artifactSha256 === MANUAL_ARTIFACT_SHA256)).toBe(true);
    expect(core2026.every((question) => question.reviewStatus === "manually-classified-mvp")).toBe(true);
    // The method text may say "(Jev unavailable)"; nothing may claim a Jev decision.
    expect(core2026.some((question) => /^jev/i.test(question.classificationEvidence?.model ?? "") || /^jev/i.test(question.classificationEvidence?.method ?? ""))).toBe(false);
    expect(core2026.every((question) => question.classificationEvidence?.method?.includes("(Jev unavailable)"))).toBe(true);
    expect(receipt.classification).toMatchObject({ model: "manual-two-pass-review-v1", artifact: { sha256: MANUAL_ARTIFACT_SHA256 } });
  });

  it("publishes exact catalog counts", () => {
    expect(getCatalogBank("igcse")).toMatchObject({ questionCount: 4174, paperCount: 225, level: "Core and Extended" });
  });

  it("keeps the combined artifact deterministically hashable", () => {
    expect(createHash("sha256").update(JSON.stringify(data)).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });
});
