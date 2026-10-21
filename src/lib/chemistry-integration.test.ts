import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sealedRuntimeBytes } from "../../scripts/ib-science-receipt-contract.mjs";
import { PREVIEW_QUESTION_IDS, hasBankAccess } from "@/lib/access";
import { storageObjectPath } from "@/lib/assets";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy";
import chemistryHlRaw from "@/data/raw/ib-chemistry-hl.json";
import chemistrySlRaw from "@/data/raw/ib-chemistry-sl.json";

const CHEMISTRY_BANKS = ["ib-chemistry-hl", "ib-chemistry-sl"] as const;
const REVIEW_MANIFEST_SHA256 = "97efc2671d80832e257d57afde209361cf3af3e900630bab2501a75f956c274b";
const EXPECTED = { "ib-chemistry-hl": { questions: 2036, papers: 93 }, "ib-chemistry-sl": { questions: 1521, papers: 93 } } as const;
// The runtime before the official May 2026 papers were appended (origin/main 18d8b98): every row, paper and header field must survive.
const PRE_2026_RUNTIME_HASHES = {
  "ib-chemistry-hl": "fe059ade723f328d5b85f0175124fd1e31d3ad187b711d293585468e2091de09",
  "ib-chemistry-sl": "8cb8f40de9fc1b9c953dce263bda0fbdd357b9d282170e02b54efaa1e18114fd",
} as const;
const PRE_2026_COUNTS = { "ib-chemistry-hl": { questions: 1872, papers: 84 }, "ib-chemistry-sl": { questions: 1412, papers: 84 } } as const;
const MAY_2026_LABELS_SHA256 = "6f8befc9962e18652bbdcbc810677e4c9481297a3e8126ce0b9e26ca9063a290";
// The 2019 HL Paper 2 re-inclusion (scripts/add-ib-chemistry-hl-2019-p2.mjs) is labelled from this source commit.
const HL_2019_P2_SOURCE_COMMIT = "2eb267c32622dd6d53b30f36dfe43264a600c5ed";

function serializedIndex(bank: (typeof CHEMISTRY_BANKS)[number]) {
  return JSON.stringify(createPublicBankIndex(bank, loadBankQuestions(bank)));
}

describe("IB Chemistry HL/SL integration", () => {
  it("loads the exact reviewed corpus counts and actual-paper years", () => {
    for (const raw of [chemistryHlRaw, chemistrySlRaw]) {
      expect(raw.sourceType).toBe("actual_past_paper");
      expect(raw.specimenQuestionsIncluded).toBe(false);
      expect(raw.questions.every((question) => question.sourceUrl === question.pdfUrl)).toBe(true);
      // Earlier papers come from IB Docs; the official May 2026 papers from the xtremepape.rs mirror of the IB release.
      expect(raw.questions.every((question) => question.sourceUrl.startsWith(question.year === 2026 ? "https://papers.xtremepape.rs/IB/2026%20Examination%20Session/" : "https://ibdocs.re/"))).toBe(true);
      expect(raw.questions.every((question) => question.classificationVersion === "ib-chemistry-reviewed-2026.09.1" || question.classificationVersion === "ib-chemistry-extension-2016-2019" || (question.year === 2026 && question.classificationVersion === "ib-chemistry-reviewed-2026.10.may2026"))).toBe(true);
      expect(raw.questions.every((question) => question.classificationReviewStatus === "classified")).toBe(true);
      expect(raw.questions.every((question) => question.classificationEvidence.finalManifestSha256 === REVIEW_MANIFEST_SHA256 || question.classificationEvidence.sourceCommit === "85cae43c22852460af47699c94cca16d86380755" || question.classificationEvidence.sourceCommit === HL_2019_P2_SOURCE_COMMIT || (question.year === 2026 && (question.classificationEvidence as { finalLabelsSha256?: string }).finalLabelsSha256 === MAY_2026_LABELS_SHA256))).toBe(true);
      expect(raw.questions.every((question) => ["neutral_reconciliation", "semantic_qa", "independent_exact_agreement", "sealed_source_reconciliation", "drex_triage_blind_two_pass_adjudicated", "reviewed_reinclusion_2026_10_21"].includes(question.classificationEvidence.method))).toBe(true);
      expect(raw.questions.every((question) => question.classificationEvidence.summary.length > 0)).toBe(true);
    }
    expect(loadBankQuestions("ib-chemistry-hl")).toHaveLength(EXPECTED["ib-chemistry-hl"].questions);
    expect(loadBankQuestions("ib-chemistry-sl")).toHaveLength(EXPECTED["ib-chemistry-sl"].questions);
    for (const bank of CHEMISTRY_BANKS) {
      const questions = loadBankQuestions(bank);
      expect(new Set(questions.map((question) => question.year))).toEqual(new Set([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]));
      expect(questions.every((question) => question.courseEra === "")).toBe(true);
      expect(questions.every((question) => question.subject === "Chemistry")).toBe(true);
    }
  });

  it("appends the May 2026 papers and leaves every earlier row, paper and header field byte-identical", () => {
    for (const [bank, raw] of [["ib-chemistry-hl", chemistryHlRaw], ["ib-chemistry-sl", chemistrySlRaw]] as const) {
      const bytes = readFileSync(join(process.cwd(), "src/data/raw", `${bank}.json`));
      const release = (raw as unknown as { may2026Release: { baseQuestionCount: number; addedQuestionCount: number; addedPaperCount: number } }).may2026Release;
      // Removing the append must give back exactly the sealed pre-2026 runtime (same bytes as origin/main 18d8b98).
      expect(createHash("sha256").update(sealedRuntimeBytes(`src/data/raw/${bank}.json`, bytes)).digest("hex")).toBe(PRE_2026_RUNTIME_HASHES[bank]);
      expect(release.baseQuestionCount).toBe(PRE_2026_COUNTS[bank].questions);
      expect(raw.papers.length).toBe(EXPECTED[bank].papers);
      expect(raw.papers.length - release.addedPaperCount).toBe(PRE_2026_COUNTS[bank].papers);
      // Chemistry HL appends its 2019 Paper 2 questions after the 2026 rows (hl2019Paper2Release).
      const later = (raw as unknown as { hl2019Paper2Release?: { baseQuestionCount: number; addedQuestionCount: number } }).hl2019Paper2Release;
      const end = later ? later.baseQuestionCount : raw.questions.length;
      expect(raw.questions.slice(release.baseQuestionCount, end).every((row) => row.year === 2026)).toBe(true);
      if (later) {
        expect(later.baseQuestionCount).toBe(release.baseQuestionCount + release.addedQuestionCount);
        expect(raw.questions.slice(end).map((row) => row.id)).toEqual(Array.from({ length: later.addedQuestionCount }, (_, i) => raw.questions[end + i].id).filter((id) => /^2019-(may-tz[12]|november-tz0)-hl-p2-q\d$/.test(id)));
      }
      expect(raw.questions.filter((row) => row.year === 2026)).toHaveLength(release.addedQuestionCount);
      expect(raw.questions.slice(0, release.baseQuestionCount).some((row) => row.year === 2026)).toBe(false);
      // production mirrors raw byte for byte
      expect(readFileSync(join(process.cwd(), "src/data/production", `${bank}.json`)).equals(bytes)).toBe(true);
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
