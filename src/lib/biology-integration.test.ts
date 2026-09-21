import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANKS, getBank } from "@/lib/banks";
import { FREE_QUESTION_YEARS, PREVIEW_QUESTION_IDS, hasBankAccess, isPreviewQuestion } from "@/lib/access";
import { storageObjectPath } from "@/lib/assets";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy";
import type { UnifiedQuestion } from "@/lib/questions";

const ROOT = process.cwd();
const BIOLOGY_BANKS = ["ib-biology-hl", "ib-biology-sl"] as const;
const EXPECTED = {
  "ib-biology-hl": { questions: 1911, papers: 84 },
  "ib-biology-sl": { questions: 1548, papers: 87 },
} as const;
const RUNTIME_HASHES = {
  "ib-biology-hl": "78a25f6ca1986da2c85c28d04751cae8b6bdd271af591477ee21837f8f313b6e",
  "ib-biology-sl": "d13808b05ce9a2d7beb2b0a55768a8568e7eaeb28b6d256f468a62d457bbd8e3",
} as const;
const TAXONOMY_SHA256 = "f78676ee39598b5f5357ca610a928e2a12cedd3c6b1f6342fa893be8b26e03eb";

type BiologyRaw = {
  sourceType: string;
  specimenQuestionsIncluded: boolean;
  questions: Array<Record<string, unknown>>;
  papers: Array<Record<string, unknown>>;
  years: number[];
};

function rawPath(bank: (typeof BIOLOGY_BANKS)[number]) {
  return join(ROOT, "src/data/raw", `${bank}.json`);
}

function readRaw(bank: (typeof BIOLOGY_BANKS)[number]): BiologyRaw {
  const path = rawPath(bank);
  expect(existsSync(path), `${path} must be copied unchanged`).toBe(true);
  return JSON.parse(readFileSync(path, "utf8")) as BiologyRaw;
}

function questions(bank: (typeof BIOLOGY_BANKS)[number]): UnifiedQuestion[] {
  return loadBankQuestions(bank);
}

describe("IB Biology HL/SL integration", () => {
  it("registers both Biology banks with exact catalog counts and years", () => {
    expect(BANKS.map((bank) => bank.slug)).toEqual([
      "igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl",
      "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl",
      "ib-biology-hl", "ib-biology-sl",
    ]);
    for (const bank of BIOLOGY_BANKS) {
      expect(getBank(bank)?.questionCount).toBe(EXPECTED[bank].questions);
      expect(getBank(bank)?.paperCount).toBe(EXPECTED[bank].papers);
      expect(getBank(bank)?.years).toBe("2016-2025");
    }
  });

  it("copies the sealed Biology runtime JSONs and taxonomy byte-for-byte", () => {
    for (const bank of BIOLOGY_BANKS) {
      const path = rawPath(bank);
      expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(RUNTIME_HASHES[bank]);
      const raw = readRaw(bank);
      expect(raw.sourceType).toBe("actual_past_paper");
      expect(raw.specimenQuestionsIncluded).toBe(false);
      expect(raw.questions).toHaveLength(EXPECTED[bank].questions);
      expect(raw.papers).toHaveLength(EXPECTED[bank].papers);
      expect(raw.years).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
      expect(raw.papers.every((paper) => paper.sourceUrl === paper.pdfUrl)).toBe(true);
      expect(raw.questions.every((question) => question.sourceUrl === question.pdfUrl)).toBe(true);
      expect(raw.questions.every((question) => typeof question.sourceUrl === "string" && question.sourceUrl.startsWith("https://ibdocs.re/"))).toBe(true);
      expect(raw.questions.every((question) => question.classificationVersion === "ib-biology-reviewed-2026.09.1" || question.classificationVersion === "ib-biology-extension-2016-2019")).toBe(true);
      expect(raw.questions.every((question) => question.classificationReviewStatus === "classified")).toBe(true);
    }
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/ib-biology-taxonomy.json"))).digest("hex")).toBe(TAXONOMY_SHA256);
  });

  it("uses the controlled Biology taxonomy without semantic relabeling", () => {
    const topics = [
      "Molecules and cells",
      "Organisms and body systems",
      "Information, inheritance and evolution",
      "Populations, ecosystems and environmental change",
    ];
    for (const bank of BIOLOGY_BANKS) {
      expect(getTopicOptions(questions(bank))).toEqual(topics);
      expect(getControlledSubtopics(bank, "Molecules and cells")).toContain("Biological molecules and water");
      expect(getControlledSubtopics(bank, "Organisms and body systems")).toContain("Gas exchange and transport");
      expect(getControlledSubtopics(bank, "Information, inheritance and evolution")).toContain("DNA, genes and chromosomes");
      expect(getControlledSubtopics(bank, "Populations, ecosystems and environmental change")).toContain("Conservation and biodiversity");
    }
  });

  it("uses bank-prefixed Biology asset roots and only referenced assets", () => {
    expect(storageObjectPath("ib-biology-hl", "https://saksham106.github.io/ib-biology-topic-practice/questions/2020-november-tz0-hl-p1-q1-page-3.webp"))
      .toBe("ib-biology-hl/questions/2020-november-tz0-hl-p1-q1-page-3.webp");
    expect(storageObjectPath("ib-biology-sl", "https://saksham106.github.io/ib-biology-topic-practice/markschemes/2025-may-tz1-sl-p3-q1-page-1.webp"))
      .toBe("ib-biology-sl/markschemes/2025-may-tz1-sl-p3-q1-page-1.webp");
    expect(() => storageObjectPath("ib-biology-hl", "https://saksham106.github.io/ib-physics-topic-practice/questions/q.webp")).toThrow();
    const plan = buildAssetRetentionPlan(BIOLOGY_BANKS.map((slug) => ({ slug, questions: questions(slug) })));
    for (const assetPath of plan.allPaths) {
      const [bank, ...relativeParts] = assetPath.split("/");
      expect(BIOLOGY_BANKS).toContain(bank);
      expect(relativeParts.length).toBeGreaterThan(1);
    }
    expect(plan.allPaths.size).toBe(5550 + 4432);
    expect(plan.previewPaths.size).toBe(366);
    expect(plan.premiumPaths.size).toBe(9616);
  });

  it("makes every actual 2020 Biology paper the explicit free preview year", () => {
    expect(FREE_QUESTION_YEARS["ib-biology-hl"]).toEqual([2020]);
    expect(FREE_QUESTION_YEARS["ib-biology-sl"]).toEqual([2020]);
    expect(PREVIEW_QUESTION_IDS["ib-biology-hl"]).toHaveLength(3);
    expect(PREVIEW_QUESTION_IDS["ib-biology-sl"]).toHaveLength(3);
    for (const bank of BIOLOGY_BANKS) {
      expect(PREVIEW_QUESTION_IDS[bank].every((id) => questions(bank).some((question) => question.id === id))).toBe(true);
    }
    expect(isPreviewQuestion("ib-biology-hl", "2020-november-tz0-hl-p1-q1")).toBe(true);
    expect(isPreviewQuestion("ib-biology-sl", "2025-may-tz1-sl-p1-q1")).toBe(false);
    expect(hasBankAccess("ib-biology-hl", [{ productId: "bundle_ib_biology", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-25T00:00:00Z"))).toBe(true);
    expect(hasBankAccess("ib-biology-sl", [{ productId: "bundle_ib_biology", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-25T00:00:00Z"))).toBe(true);
  });

  it("keeps public Biology indexes privacy-safe and ordered", () => {
    for (const bank of BIOLOGY_BANKS) {
      const index = createPublicBankIndex(bank, questions(bank));
      expect(index.questions).toHaveLength(EXPECTED[bank].questions);
      expect(index.questions).toEqual([...index.questions].sort((a, b) => b.year - a.year || a.paper - b.paper || a.number - b.number || a.id.localeCompare(b.id)));
      const serialized = JSON.stringify(index);
      for (const key of ["summary", "accessibleText", "solution", "sourceQuestionUrl", "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths", "courseEra", "private"]) {
        expect(serialized).not.toContain(`"${key}"`);
      }
    }
  });
});
