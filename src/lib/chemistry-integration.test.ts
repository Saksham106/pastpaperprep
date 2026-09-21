import { describe, expect, it } from "vitest";
import { PREVIEW_QUESTION_IDS, hasBankAccess } from "@/lib/access";
import { storageObjectPath } from "@/lib/assets";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy";
import chemistryHlRaw from "@/data/raw/ib-chemistry-hl.json";
import chemistrySlRaw from "@/data/raw/ib-chemistry-sl.json";

const CHEMISTRY_BANKS = ["ib-chemistry-hl", "ib-chemistry-sl"] as const;
const REVIEW_MANIFEST_SHA256 = "97efc2671d80832e257d57afde209361cf3af3e900630bab2501a75f956c274b";

function serializedIndex(bank: (typeof CHEMISTRY_BANKS)[number]) {
  return JSON.stringify(createPublicBankIndex(bank, loadBankQuestions(bank)));
}

describe("IB Chemistry HL/SL integration", () => {
  it("loads the exact reviewed corpus counts and actual-paper years", () => {
    for (const raw of [chemistryHlRaw, chemistrySlRaw]) {
      expect(raw.sourceType).toBe("actual_past_paper");
      expect(raw.specimenQuestionsIncluded).toBe(false);
      expect(raw.questions.every((question) => question.sourceUrl === question.pdfUrl)).toBe(true);
      expect(raw.questions.every((question) => question.sourceUrl.startsWith("https://ibdocs.re/"))).toBe(true);
      expect(raw.questions.every((question) => question.classificationVersion === "ib-chemistry-reviewed-2026.09.1" || question.classificationVersion === "ib-chemistry-extension-2016-2019")).toBe(true);
      expect(raw.questions.every((question) => question.classificationReviewStatus === "classified")).toBe(true);
      expect(raw.questions.every((question) => question.classificationEvidence.finalManifestSha256 === REVIEW_MANIFEST_SHA256 || question.classificationEvidence.sourceCommit === "85cae43c22852460af47699c94cca16d86380755")).toBe(true);
      expect(raw.questions.every((question) => ["neutral_reconciliation", "semantic_qa", "independent_exact_agreement", "sealed_source_reconciliation"].includes(question.classificationEvidence.method))).toBe(true);
      expect(raw.questions.every((question) => question.classificationEvidence.summary.length > 0)).toBe(true);
    }
    expect(loadBankQuestions("ib-chemistry-hl")).toHaveLength(1872);
    expect(loadBankQuestions("ib-chemistry-sl")).toHaveLength(1412);
    for (const bank of CHEMISTRY_BANKS) {
      const questions = loadBankQuestions(bank);
      expect(new Set(questions.map((question) => question.year))).toEqual(new Set([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]));
      expect(questions.every((question) => question.courseEra === "")).toBe(true);
      expect(questions.every((question) => question.subject === "Chemistry")).toBe(true);
    }
  });

  it("uses the controlled Chemistry taxonomy without exposing course-era labels", () => {
    for (const bank of CHEMISTRY_BANKS) {
      expect(getTopicOptions(loadBankQuestions(bank))).toEqual([
        "Matter, amounts and stoichiometry",
        "Atomic structure and periodicity",
        "Bonding, structure and materials",
        "Energetics, thermodynamics and fuels",
        "Kinetics",
        "Equilibrium",
        "Acids and bases",
        "Redox and electrochemistry",
        "Organic chemistry and molecular analysis",
        "Measurement, data and practical work",
      ]);
      expect(getControlledSubtopics(bank, "Matter, amounts and stoichiometry")).toContain("The mole and reacting quantities");
      expect(getControlledSubtopics(bank, "Organic chemistry and molecular analysis")).toContain("Functional groups and reactions");
      expect(serializedIndex(bank)).not.toContain("courseEra");
    }
  });

  it("maps only referenced Chemistry assets to the private bucket", () => {
    expect(storageObjectPath("ib-chemistry-hl", "https://saksham106.github.io/ib-chemistry-topic-practice/questions/2020-november-tz0-hl-p1-q1-page-4.webp"))
      .toBe("ib-chemistry-hl/questions/2020-november-tz0-hl-p1-q1-page-4.webp");
    expect(storageObjectPath("ib-chemistry-sl", "https://saksham106.github.io/ib-chemistry-topic-practice/markschemes/2025-may-tz1-sl-p3-q1-page-1.webp"))
      .toBe("ib-chemistry-sl/markschemes/2025-may-tz1-sl-p3-q1-page-1.webp");
    expect(() => storageObjectPath("ib-chemistry-hl", "https://saksham106.github.io/ib-maths-aa-hl-topic-practice/questions/q.webp")).toThrow();
  });

  it("keeps Chemistry preview and pair access scoped to Chemistry", () => {
    expect(PREVIEW_QUESTION_IDS["ib-chemistry-hl"]).toHaveLength(3);
    expect(hasBankAccess("ib-chemistry-hl", [{ productId: "bundle_ib_chemistry", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-25T00:00:00Z"))).toBe(true);
    expect(hasBankAccess("ib-chemistry-sl", [{ productId: "bundle_ib_chemistry", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], new Date("2026-08-25T00:00:00Z"))).toBe(true);
  });

  it("keeps public Chemistry index metadata free of protected content and assets", () => {
    for (const bank of CHEMISTRY_BANKS) {
      const serialized = serializedIndex(bank);
      for (const key of ["summary", "accessibleText", "solution", "sourceQuestionUrl", "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths"]) {
        expect(serialized).not.toContain(`"${key}"`);
      }
    }
  });
});
