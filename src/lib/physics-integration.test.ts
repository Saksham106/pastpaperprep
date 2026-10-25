import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sealedRuntimeBytes } from "../../scripts/ib-science-receipt-contract.mjs";
import { BANKS, getBank } from "@/lib/banks";
import { PREVIEW_QUESTION_IDS, FREE_QUESTION_YEARS, hasBankAccess, isPreviewQuestion } from "@/lib/access";
import { storageObjectPath } from "@/lib/assets";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy";
import type { UnifiedQuestion } from "@/lib/questions";

type PhysicsQuestionFixture = {
  year: number;
  sourceUrl: string;
  pdfUrl: string;
  classificationVersion: string;
  classificationReviewStatus: string;
  classificationEvidence: { finalManifestSha256: string; summary: string };
  courseEra?: unknown;
  private?: unknown;
  privateAsset?: unknown;
  officialTopicCodes: string[];
  primaryTopic: string;
  id: string;
};

type PhysicsPaperFixture = {
  year: number;
  sourceUrl: string;
  pdfUrl: string;
  id: string;
};

type PhysicsRawFixture = {
  sourceType: string;
  specimenQuestionsIncluded: boolean;
  questions: PhysicsQuestionFixture[];
  papers: PhysicsPaperFixture[];
  years: number[];
};

const ROOT = process.cwd();
const PHYSICS_BANKS = ["ib-physics-hl", "ib-physics-sl"] as const;
const EXPECTED = {
  "ib-physics-hl": { questions: 2028, papers: 93 },
  "ib-physics-sl": { questions: 1413, papers: 93 },
} as const;
const RUNTIME_HASHES = {
  "ib-physics-hl": "714ab4d4cedfe7278c330ce6e7cc16bd327fbd346d387c22c7e4e4f369ff85ca",
  "ib-physics-sl": "72d64ea9572c9c1e58f3bda4976cccc5500828ec5287fb43aae5558698aef4cf",
} as const;
// The runtime before the official May 2026 papers were appended (origin/main 5d0f243): every row, paper and header field must survive.
const PRE_2026_RUNTIME_HASHES = {
  "ib-physics-hl": "92bdbf445cde1cf50c3d05b767e45c2e99952f57fdd24bf8cb003814ace81104",
  "ib-physics-sl": "f6b6b31863b02b9c4624efeb106a8462b8abfa0674b1f1a5e738916820ddfbe2",
} as const;
const PRE_2026_COUNTS = { "ib-physics-hl": { questions: 1875, papers: 84 }, "ib-physics-sl": { questions: 1314, papers: 84 } } as const;
const PHYSICS_MANIFEST_SHA256 = "d36853411d95f71617d77f2d269f069facca1e047296373a34ae36dbbcfbb54a";
const PHYSICS_TAXONOMY_SHA256 = "2cd12dbb2275462a79589f92e3dfde7c258ceb5c3eb3885b7994aac2a9d0b767";

function rawPath(bank: (typeof PHYSICS_BANKS)[number]) {
  return join(ROOT, "src/data/raw", `${bank}.json`);
}

function readRaw(bank: (typeof PHYSICS_BANKS)[number]): PhysicsRawFixture {
  const path = rawPath(bank);
  expect(existsSync(path), `${path} must be copied unchanged`).toBe(true);
  return JSON.parse(readFileSync(path, "utf8")) as PhysicsRawFixture;
}

function questions(bank: (typeof PHYSICS_BANKS)[number]): UnifiedQuestion[] {
  return loadBankQuestions(bank);
}

describe("IB Physics HL/SL integration", () => {
  it("registers both Physics banks with exact catalog counts and years", () => {
    expect(BANKS.map((bank) => bank.slug)).toEqual([
      "igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl",
      "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl",
      "ib-biology-hl", "ib-biology-sl",
    ]);
    expect(getBank("ib-physics-hl")?.questionCount).toBe(2028);
    expect(getBank("ib-physics-sl")?.questionCount).toBe(1413);
    expect(getBank("ib-physics-hl")?.paperCount).toBe(93);
    expect(getBank("ib-physics-sl")?.paperCount).toBe(93);
    expect(getBank("ib-physics-hl")?.years).toBe("2016-2026");
    expect(getBank("ib-physics-sl")?.years).toBe("2016-2026");
  });

  it("loads sealed runtime JSONs with reviewed provenance and no specimens", () => {
    const taxonomyHash = createHash("sha256")
      .update(readFileSync(join(ROOT, "src/data/ib-physics-taxonomy.json")))
      .digest("hex");
    expect(taxonomyHash).toBe(PHYSICS_TAXONOMY_SHA256);
    for (const bank of PHYSICS_BANKS) {
      const raw = readRaw(bank);
      expect(raw.sourceType).toBe("actual_past_paper");
      expect(raw.specimenQuestionsIncluded).toBe(false);
      expect(raw.questions).toHaveLength(EXPECTED[bank].questions);
      expect(raw.papers).toHaveLength(EXPECTED[bank].papers);
      expect(raw.years).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
      expect(raw.papers.every((paper) => [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].includes(paper.year))).toBe(true);
      expect(raw.papers.every((paper) => paper.sourceUrl === paper.pdfUrl && !/specimen/i.test(paper.id))).toBe(true);
      expect(raw.questions.every((question) => [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].includes(question.year))).toBe(true);
      expect(raw.questions.every((question) => question.sourceUrl === question.pdfUrl)).toBe(true);
      // Earlier papers come from IB Docs; the official May 2026 papers from the xtremepape.rs mirror of the IB release.
      expect(raw.questions.every((question) => question.sourceUrl.startsWith(question.year === 2026 ? "https://papers.xtremepape.rs/IB/2026%20Examination%20Session/" : "https://ibdocs.re/"))).toBe(true);
      expect(raw.questions.every((question) => question.classificationVersion === "ib-physics-reviewed-2026.09.1" || question.classificationVersion === "ib-physics-extension-2016-2019" || (question.year === 2026 && question.classificationVersion === "ib-physics-reviewed-2026.10.may2026"))).toBe(true);
      expect(raw.questions.every((question) => question.classificationReviewStatus === "classified")).toBe(true);
      expect(raw.questions.every((question) => question.classificationEvidence.finalManifestSha256 === PHYSICS_MANIFEST_SHA256 || question.year === 2026 || (question.classificationEvidence as Record<string, unknown>).sourceCommit === "0bdfc1a888e4bc3f8163badbaeb16268a814e1a2")).toBe(true);
      expect(raw.questions.every((question) => question.classificationEvidence.summary.length > 0)).toBe(true);
      expect(raw.questions.every((question) => !question.courseEra && !question.private && !question.privateAsset)).toBe(true);
    }
  });

  it("appends the May 2026 papers and leaves every earlier row, paper and header field byte-identical", () => {
    for (const bank of PHYSICS_BANKS) {
      const bytes = readFileSync(rawPath(bank));
      const raw = readRaw(bank);
      const release = (raw as unknown as { may2026Release: { baseQuestionCount: number; addedQuestionCount: number; addedPaperCount: number } }).may2026Release;
      // Removing the append must give back exactly the sealed pre-2026 runtime (same bytes as origin/main 5d0f243).
      expect(createHash("sha256").update(sealedRuntimeBytes(`src/data/raw/${bank}.json`, bytes)).digest("hex")).toBe(PRE_2026_RUNTIME_HASHES[bank]);
      expect(release.baseQuestionCount).toBe(PRE_2026_COUNTS[bank].questions);
      expect(raw.papers.length - release.addedPaperCount).toBe(PRE_2026_COUNTS[bank].papers);
      expect(raw.questions.slice(release.baseQuestionCount).every((row) => row.year === 2026)).toBe(true);
      expect(raw.questions.filter((row) => row.year === 2026)).toHaveLength(release.addedQuestionCount);
      expect(raw.questions.slice(0, release.baseQuestionCount).some((row) => row.year === 2026)).toBe(false);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(RUNTIME_HASHES[bank]);
      expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/production", `${bank}.json`))).digest("hex")).toBe(RUNTIME_HASHES[bank]);
    }
  });

  it("permits only the known empty official-code classification", () => {
    for (const bank of PHYSICS_BANKS) {
      const raw = readRaw(bank);
      const empty = raw.questions.filter((question) => question.officialTopicCodes.length === 0);
      expect(empty).toHaveLength(bank === "ib-physics-sl" ? 1 : 0);
      if (empty.length) {
        expect(empty[0].year).toBe(2025);
        expect(empty[0].primaryTopic).toBe("Foundations, measurement and data");
        expect(empty[0].id).toBe("2025-may-tz1-sl-p1b-q1");
      }
    }
  });

  it("keeps Physics taxonomy relationships controlled and deterministic", () => {
    const hlTopics = getTopicOptions(questions("ib-physics-hl"));
    expect(hlTopics).toEqual([
      "Foundations, measurement and data",
      "Mechanics and motion",
      "Thermal and energy systems",
      "Waves, optics and imaging",
      "Electricity, circuits and electromagnetism",
      "Atomic, quantum, nuclear and particle physics",
      "Relativity, astrophysics and cosmology",
    ]);
    expect(getControlledSubtopics("ib-physics-hl", "Foundations, measurement and data")).toContain("Uncertainty, error and significant figures");
    expect(getControlledSubtopics("ib-physics-sl", "Mechanics and motion")).toContain("Momentum, impulse and collisions");
    expect(getControlledSubtopics("ib-physics-hl", "Relativity, astrophysics and cosmology")).toContain("Cosmology and the large-scale universe");
    expect(getTopicOptions(questions("ib-physics-hl"))).toEqual(hlTopics);
  });

  it("uses bank-prefixed Physics asset roots and only referenced assets", () => {
    expect(storageObjectPath("ib-physics-hl", "https://saksham106.github.io/ib-physics-topic-practice/questions/2020-november-tz0-hl-p1-q1-page-3.webp"))
      .toBe("ib-physics-hl/questions/2020-november-tz0-hl-p1-q1-page-3.webp");
    expect(storageObjectPath("ib-physics-sl", "https://saksham106.github.io/ib-physics-topic-practice/markschemes/2025-may-tz1-sl-p3-q1-page-1.webp"))
      .toBe("ib-physics-sl/markschemes/2025-may-tz1-sl-p3-q1-page-1.webp");
    expect(() => storageObjectPath("ib-physics-hl", "https://saksham106.github.io/ib-chemistry-topic-practice/questions/q.webp")).toThrow();
    const plan = buildAssetRetentionPlan(PHYSICS_BANKS.map((slug) => ({ slug, questions: questions(slug) })));
    for (const assetPath of plan.allPaths) {
      const [bank, ...relativeParts] = assetPath.split("/");
      expect(PHYSICS_BANKS).toContain(bank);
      expect(relativeParts.length).toBeGreaterThan(1);
    }
    // 653 official May 2026 question and mark-scheme crops (HL 395, SL 258) are added to the pre-2026 5196 and 4220.
    expect(plan.allPaths.size).toBe(5196 + 4220 + 653);
    // Free years 2016-2020 sign from R2, so Supabase retains none of them.
    expect(plan.previewPaths.size).toBe(0);
    expect(plan.premiumPaths.size).toBe(plan.allPaths.size);
  });

  it("makes 2016-2020 free and scopes pair access", () => {
    expect(FREE_QUESTION_YEARS["ib-physics-hl"]).toEqual([2016, 2017, 2018, 2019, 2020]);
    expect(FREE_QUESTION_YEARS["ib-physics-sl"]).toEqual([2016, 2017, 2018, 2019, 2020]);
    expect(PREVIEW_QUESTION_IDS["ib-physics-hl"]).toHaveLength(3);
    expect(PREVIEW_QUESTION_IDS["ib-physics-sl"]).toHaveLength(3);
    expect(PREVIEW_QUESTION_IDS["ib-physics-hl"].every((id) => questions("ib-physics-hl").some((question) => question.id === id))).toBe(true);
    expect(PREVIEW_QUESTION_IDS["ib-physics-sl"].every((id) => questions("ib-physics-sl").some((question) => question.id === id))).toBe(true);
    expect(isPreviewQuestion("ib-physics-hl", "2020-november-tz0-hl-p1-q1")).toBe(true);
    expect(isPreviewQuestion("ib-physics-sl", "2025-may-tz1-sl-p1a-q1")).toBe(false);
    expect(hasBankAccess("ib-physics-hl", [{ productId: "bundle_ib_physics", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-25T00:00:00Z"))).toBe(true);
    expect(hasBankAccess("ib-physics-sl", [{ productId: "bundle_ib_physics", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-25T00:00:00Z"))).toBe(true);
  });

  it("keeps public Physics indexes privacy-safe and ordered", () => {
    for (const bank of PHYSICS_BANKS) {
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
