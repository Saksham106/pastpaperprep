import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/raw/igcse.json";
import { getCatalogBank } from "@/lib/catalog";

type RuntimeQuestion = {
  id: string;
  route?: string;
  primaryTopic?: string;
  questionImages: string[];
  markschemeImages: string[];
  classificationEvidence?: {
    method?: string;
    model?: string;
    status?: string;
    confidence?: number | string;
  };
};

type Runtime = {
  version: number;
  papers: Array<{ id: string; route?: string }>;
  questions: RuntimeQuestion[];
  coreClassificationArtifact: string;
  coreClassificationSha256: string;
  excludedQuestionIds: string[];
  extendedRuntimeSha256: string;
};

const data = runtime as Runtime;
const WITHDRAWN = ["0580-2025-november-33-q20", "0580-2025-november-33-q27"];
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

describe("IGCSE Mathematics 0580 Core 2021-2025 release", () => {
  it("adds the complete bounded Core corpus without replacing Extended", () => {
    const core = data.questions.filter((question) => question.route === "Core");
    const extended = data.questions.filter((question) => question.route !== "Core");

    expect(data.version).toBe(3);
    expect(data.questions).toHaveLength(3967);
    expect(data.papers).toHaveLength(217);
    expect(core).toHaveLength(1283);
    expect(extended).toHaveLength(2684);
    expect(new Set(data.questions.map((question) => question.id)).size).toBe(3967);
    expect(data.excludedQuestionIds).toEqual(WITHDRAWN);
    expect(data.questions.some((question) => WITHDRAWN.includes(question.id))).toBe(false);
    expect(data.extendedRuntimeSha256).toBe(PRE_CORE_RUNTIME_SHA256);
    expect(semanticHash(extended)).toBe(EXTENDED_QUESTIONS_SEMANTIC_SHA256);
    expect(semanticHash(data.papers.filter((paper) => paper.route !== "Core"))).toBe(EXTENDED_PAPERS_SEMANTIC_SHA256);
  });

  it("keeps Core classifications controlled, honest, and fully asset-backed", () => {
    const core = data.questions.filter((question) => question.route === "Core");

    expect(data.coreClassificationArtifact).toBe("data/core-2021-2025/jev-classification-final.json");
    expect(data.coreClassificationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(core.every((question) => question.primaryTopic && question.primaryTopic !== "Other")).toBe(true);
    expect(core.every((question) => question.questionImages.length > 0 && question.markschemeImages.length > 0)).toBe(true);
    expect(core.every((question) => question.questionImages.every((path) => path.startsWith("core-questions/") && path.endsWith(".webp")))).toBe(true);
    expect(core.every((question) => question.markschemeImages.every((path) => path.startsWith("core-markschemes/") && path.endsWith(".webp")))).toBe(true);
    expect(core.every((question) => question.classificationEvidence?.method?.startsWith("Jev text classification"))).toBe(true);
    expect(core.every((question) => question.classificationEvidence?.model === "jev-1.13.0")).toBe(true);
    expect(core.every((question) => typeof question.classificationEvidence?.confidence === "number")).toBe(true);
  });

  it("publishes exact catalog counts", () => {
    expect(getCatalogBank("igcse")).toMatchObject({ questionCount: 3967, paperCount: 217, level: "Core and Extended" });
  });

  it("keeps the combined artifact deterministically hashable", () => {
    expect(createHash("sha256").update(JSON.stringify(data)).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });
});
