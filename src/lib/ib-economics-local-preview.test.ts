import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANKS, LOCAL_PREVIEW_BANKS, getAvailableBanks, getBank } from "@/lib/banks";
import { hasBankAccess } from "@/lib/access";
import { filterQuestions } from "@/lib/question-filter";
import { loadBankQuestions } from "@/lib/question-loader";
import { createPublicBankIndex } from "@/lib/question-index";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy";
import { isLocalEconomicsPreviewEnabled } from "@/lib/local-preview";

describe("IB Economics HL/SL local preview", () => {
  it("keeps the production catalog and index surface at the existing twelve banks", () => {
    expect(BANKS).toHaveLength(12);
    expect(BANKS.some((bank) => bank.slug === "ib-economics-hl")).toBe(false);
    expect(BANKS.some((bank) => bank.slug === "ib-economics-sl")).toBe(false);
    expect(getBank("ib-economics-hl", { NODE_ENV: "development" })).toBeUndefined();
    expect(getAvailableBanks({ NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true" })).toHaveLength(14);
    expect(getAvailableBanks({ NODE_ENV: "development", PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true", PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true" }).map((bank) => bank.slug)).not.toContain("ib-economics-hl");
    expect(LOCAL_PREVIEW_BANKS.map((bank) => bank.questionCount)).toEqual([111, 89]);
  });

  it("requires development plus the explicit preview flag", () => {
    expect(isLocalEconomicsPreviewEnabled({ NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true" })).toBe(true);
    for (const NODE_ENV of [undefined, "", "test", "staging", "preview", "production"]) {
      expect(isLocalEconomicsPreviewEnabled({ NODE_ENV, PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "true" })).toBe(false);
    }
    expect(isLocalEconomicsPreviewEnabled({ NODE_ENV: "development", PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW: "false" })).toBe(false);
  });

  it("loads the sealed HL and SL runtime records with exact counts and paper/session scope", async () => {
    const hl = await loadBankQuestions("ib-economics-hl");
    const sl = await loadBankQuestions("ib-economics-sl");
    expect(hl).toHaveLength(111);
    expect(sl).toHaveLength(89);
    expect(new Set(hl.map((question) => question.paper))).toEqual(new Set([1, 2, 3]));
    expect(new Set(sl.map((question) => question.paper))).toEqual(new Set([1, 2]));
    expect(new Set([...hl, ...sl].map((question) => question.session))).toEqual(new Set(["May", "November"]));
    expect(new Set([...hl, ...sl].map((question) => question.courseEra))).toEqual(new Set(["legacy_pre_2022", "new_first_assessment_2022"]));
    expect(hl.every((question) => question.subject === "Economics" && question.bankSlug === "ib-economics-hl")).toBe(true);
    expect(sl.every((question) => question.subject === "Economics" && question.bankSlug === "ib-economics-sl")).toBe(true);
  });

  it("keeps content subtopics separate from controlled skill identifiers", async () => {
    const questions = await loadBankQuestions("ib-economics-hl");
    expect(questions.every((question) => question.subtopics.every((value) => !value.startsWith("skill.")))).toBe(true);
    expect(questions.every((question) => question.skills.every((value) => value.startsWith("skill.")))).toBe(true);
    expect(getTopicOptions(questions)).toEqual(["Foundations", "Microeconomics", "Macroeconomics", "Global economy"]);
    expect(getControlledSubtopics("ib-economics-hl", "Microeconomics")).toContain("Market equilibrium and price mechanism");
    const grouped = getSubtopicGroups(questions, ["Microeconomics"], []);
    expect(grouped.relevant).toContain("Market equilibrium and price mechanism");
    expect(grouped.relevant).not.toContain("skill.application_to_context");
  });

  it("filters a secondary topic/detail without relabeling the primary topic", async () => {
    const questions = await loadBankQuestions("ib-economics-hl");
    const source = questions.find((question) => question.primaryTopic !== "Microeconomics" && question.secondaryTopics.includes("Microeconomics") && question.secondarySubtopics.length > 0);
    expect(source).toBeDefined();
    const detail = source!.secondarySubtopics[0];
    const matches = filterQuestions(questions, { topics: ["Microeconomics"], subtopics: [detail] });
    expect(matches.map((question) => question.id)).toContain(source!.id);
    expect(source!.primaryTopic).not.toBe("Microeconomics");
  });

  it("builds a protected metadata index without rich text or asset paths", async () => {
    const questions = await loadBankQuestions("ib-economics-sl");
    const serialized = JSON.stringify(createPublicBankIndex("ib-economics-sl", questions));
    expect(serialized).not.toContain("accessibleText");
    expect(serialized).not.toContain("questionImages");
    expect(serialized).not.toContain("markschemeImages");
    expect(serialized).toContain("Global economy");
    expect(serialized).toContain("Trade protection instruments");
  });

  it("does not let local preview alter entitlement semantics", () => {
    const active = [{ productId: "bundle_all" as const, status: "active" as const, startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];
    expect(hasBankAccess("ib-economics-hl", active)).toBe(true);
    expect(hasBankAccess("ib-economics-sl", active)).toBe(true);
  });

  it("preserves the final artifact provenance hash on every copied question", async () => {
    const finalSha = createHash("sha256").update(readFileSync(join(process.env.PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT ?? join(process.cwd(), "..", "ib-economics-topic-practice"), "data/classification/final-classifications.json"))).digest("hex");
    const questions = [...await loadBankQuestions("ib-economics-hl"), ...await loadBankQuestions("ib-economics-sl")];
    expect(finalSha).toBe("28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb");
    expect(questions.every((question) => question.sourceQuestionUrl?.startsWith("https://") && question.sourceMarkSchemeUrl?.startsWith("https://"))).toBe(true);
    for (const file of ["ib-economics-hl.json", "ib-economics-sl.json"]) {
      const runtime = JSON.parse(readFileSync(`src/data/local-preview/${file}`, "utf8"));
      expect(runtime.questions.every((question: { classificationEvidence?: { finalArtifactSha256?: string }; classificationReviewStatus?: string }) =>
        question.classificationEvidence?.finalArtifactSha256 === finalSha && question.classificationReviewStatus === "semantic_qa_approved",
      )).toBe(true);
    }
  });

  it("retains all sixteen shared question records and their complete image sets", async () => {
    const [hl, sl] = await Promise.all([loadBankQuestions("ib-economics-hl"), loadBankQuestions("ib-economics-sl")]);
    const slIds = new Set(sl.map((question) => question.id));
    const shared = hl.filter((question) => slIds.has(question.id));
    expect(shared).toHaveLength(16);
    expect(shared.every((question) => question.questionImageCount > 0 && question.markschemeImageCount > 0)).toBe(true);
    expect(shared.every((question) => question.questionImages.every((url) => url.startsWith("/api/local-preview-assets/")))).toBe(true);
    expect(shared.every((question) => question.markschemeImages.every((url) => url.startsWith("/api/local-preview-assets/")))).toBe(true);
    expect(shared.every((question) => new Set(question.markschemeImages).size === question.markschemeImages.length)).toBe(true);
  });
});
