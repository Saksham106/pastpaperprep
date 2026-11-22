import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/a-level-economics-9708.json";
import taxonomyJson from "@/data/a-level-economics-9708-taxonomy.json";
import privateIndex from "@/data/private-index/a-level-economics-9708.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/a-level-economics-9708.manifest.json";
import dryRun from "../../data/storage/a-level-economics-9708.dry-run.json";
import receipt from "../../data/storage/a-level-economics-9708.receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { A_LEVEL_ECONOMICS_9708, ECONOMICS_9708_EARLIER_TOPICS, ECONOMICS_9708_SUBTOPICS, ECONOMICS_9708_TOPICS } from "@/lib/a-level-9708";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, getCatalogBillingBanks, isPendingStoragePreview } from "@/lib/catalog";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { BANK_PRODUCTS, bankEntryHref, hasBankAccess, hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { getCustomBundlePlan } from "@/lib/custom-bundles";
import { PURCHASABLE_PRODUCTS } from "@/lib/pricing-intent";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { filterQuestions } from "@/lib/question-filter";
import { generatePaper } from "@/lib/paper-builder";
import type { PublicBankIndex } from "@/lib/question-index";
import { publicMetadataToQuestion, type PublicQuestionMetadata } from "@/lib/question-index";
import { defaultRouteSelection, deriveCourseRoute, routeConfigFor } from "@/lib/course-route";
import { isNotSatSeries } from "@/lib/series-notes";
import { formulaListFor, formulaListsForYears } from "@/lib/formula-lists";
import { hasPeriodicTable } from "@/lib/periodic-table";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { calculatorAllowed, CALCULATOR_FILTER_BANKS } from "@/lib/calculator-policy.mjs";
import { getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { qualificationOfBank, SUBJECT_SLUGS } from "@/lib/past-paper-catalog";
import { PARTIAL_EXPLANATION_BANKS } from "@/lib/articles-explanation-coverage.test";
import { HELD_BANKS } from "@/lib/held-banks.mjs";
import { metadataFromRaw, publishedBankSources } from "../../scripts/generate-bank-index.mjs";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { BOARD_SUBJECT_ORDER } from "@/lib/qualifications";
import { assessmentGuideFor } from "@/lib/assessment-guides";
import removedPartMarks from "@/data/reviewed-science-removed-part-marks.json";

const ROOT = process.cwd();
const slug = A_LEVEL_ECONOMICS_9708;
const product = "bank_a_level_economics_9708";
const CANDIDATE = "264205541ced6de96ea479d18441317a01a0661833ca8e1119b7b60882351ccd";
const PREFIX = "a-level-economics-9708/releases/full3208-v1-a51a32c54f4e";
const HELD_COPYRIGHT = [
  "9708-2020-w-42-q1", "9708-2021-m-22-q1", "9708-2022-w-42-q1", "9708-2023-m-22-q1", "9708-2023-w-42-q1", "9708-2025-m-42-q1", "9708-2025-s-21-q1",
  "9708-2025-s-24-q1", "9708-2025-s-41-q1", "9708-2025-s-42-q1", "9708-2025-w-22-q1", "9708-2025-w-23-q1", "9708-2026-s-22-q1", "9708-2026-s-23-q1",
];
const HELD_MCQ = ["9708-2023-w-13-q24", "9708-2025-w-13-q17"];
/** Held in the app (owner review of #500): QP p. 3 removes Fig. 1.2, which Q1(c) names. Its 5 crops stay in R2, unserved. */
const APP_HELD = "9708-2025-m-22-q1";
const EXCLUDED = ["9708-2023-s-11-q22", "9708-2023-s-11-q30", "9708-2024-s-12-q4", "9708-2024-s-12-q6", "9708-2024-s-12-q8", "9708-2025-s-14-q2"];
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
type RuntimeQuestion = {
  id: string; paperId: string; number: number; paper: number; year: number; era: string; session: string; examStatus: string; format: string; component: string; section?: string;
  marks: number; maxMarks: number; aliasIds: string[]; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; choiceGroup?: string; choiceRequired?: number;
  removedParts?: string[]; sharedStimulusImages?: string[]; accessibleText: string; answer?: string;
  answerProvenance?: { status: string; questionId: string; keyReads: { markSchemeText: string; renderedView: string; examinerReport?: string }; servedFrom?: string };
  questionImages: string[]; markschemeImages: string[]; secondarySubtopics: string[];
};
const runtime = runtimeJson as unknown as {
  questionCount: number; paperCount: number; years: string; assetVerification: string; publicationStatus: string; heldQuestionIds: string[]; excludedQuestionIds: string[];
  paperFacts: Record<string, { name: string; durationMinutes: number; totalMarks: number; durationMinutesByEra: Record<string, number>; totalMarksByEra: Record<string, number> }>;
  questions: RuntimeQuestion[]; runtimeArtifact: { originalCandidateRuntimeSha256: string; runtimeSha256: string };
};
const taxonomy = taxonomyJson as { topics: Array<{ id: string; label: string; earlierSyllabus: boolean; questions: number; subtopics: Array<{ label: string }> }> };
const manifest = manifestJson as { storageState: string; objectPrefix: string; originalCandidateRuntimeSha256: string; assets: Array<{ objectKey: string; sha256: string; size: number; contentType: string }> };
/** Undo exactly what `generate-igcse-release.mjs --finalize` writes; the result must be the pinned candidate. */
function reconstructCandidate(finalized: unknown) {
  const candidate = JSON.parse(JSON.stringify(finalized));
  for (const question of candidate.questions) {
    question.publicationStatus = "authorized_production_candidate";
    question.classificationReviewStatus = "candidate_not_approved";
  }
  candidate.releaseStatus = "authorized_production_candidate";
  candidate.publicationStatus = "authorized_production_candidate";
  candidate.assetVerification = "pending_upload";
  const meta = candidate.runtimeArtifact;
  meta.assetVerification = "pending_upload";
  meta.publicationStatus = "authorized_production_candidate";
  meta.assetManifestSha256 = null;
  meta.storageReceiptSha256 = null;
  delete meta.storageState;
  delete meta.finalizedContentSha256;
  meta.runtimeSha256 = null;
  meta.runtimeSha256 = createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
  return candidate;
}
const questions = normalizeBankQuestions(slug, runtimeJson.questions as unknown as Array<Record<string, unknown>>);
/** The explorer's rows after metadata hydration: bank-index metadata built from the runtime, then rehydrated. */
const hydrated = (runtimeJson.questions as unknown as Array<Record<string, unknown>>).map((raw) => publicMetadataToQuestion(metadataFromRaw(raw, { bank: slug }) as PublicQuestionMetadata, slug));
const stripeConfig = validateStripeConfig({
  NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly", STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
  STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly", STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
  STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly", STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
  STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly", STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
  STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly", STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
});

describe("A Level Economics 9708 catalog entry", () => {
  it("is a launched, gated, paid Cambridge A Level bank with no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Economics", title: "Economics 9708", syllabusCode: "9708", questionCount: 3207, paperCount: 183, years: "2020-2026", productId: product, release: "gated", delivery: "hosted" });
    expect("pendingStorage" in entry).toBe(false);
    // Subject-named pair bundles are IB-only: A Level Economics never inherits bundle_ib_economics.
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
    expect(BOARD_SUBJECT_ORDER["a-level"]).toEqual(["Mathematics", "Further Mathematics", "Chemistry", "Physics", "Biology", "Economics", "Computer Science"]);
  });

  it("rides the shared release lane, finalized against a verified readback, and is served", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(RELEASE_BANKS[slug]).toEqual({ prefix: PREFIX, sourceRootEnv: "PASTPAPERPREP_A_LEVEL_ECONOMICS_SOURCE_ROOT", candidateSeal: "blanked-v1", originalCandidateRuntimeSha256: CANDIDATE });
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(getIGCSERuntimeArtifact(slug, PRODUCTION).questions).toHaveLength(3207);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(true);
    expect(getCatalogBanksForDisplay({ NODE_ENV: "production" }).some((entry) => entry.slug === slug)).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((entry) => entry.slug === slug)).toBe(true);
    expect(getBank(slug, PRODUCTION)?.qualification).toBe("Cambridge A Level");
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(true);
    // No longer staged: never read through the pending-storage preview path.
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(false);
  });

  it("is no longer held: production publishes its static index and manifest entry", () => {
    expect(HELD_BANKS).not.toContain(slug);
    expect(publishedBankSources({ NODE_ENV: "production" }).some(({ bank }) => bank === slug)).toBe(true);
    expect(PUBLIC_BANK_INDEX_FILES[slug as keyof typeof PUBLIC_BANK_INDEX_FILES]).toMatch(/^a-level-economics-9708\.v1-[a-f0-9]{12}\.json$/);
  });

  it("has a course guide from the 2026-2028 syllabus, with the 2020-2022 written-paper totals", () => {
    const guide = assessmentGuideFor(getCatalogBank(slug)!);
    expect(guide.version).toBe("2026–2028 syllabus");
    expect(guide.papers.map((paper) => [paper.name, paper.marks])).toEqual([["Paper 1", "30"], ["Paper 2", "60 (40 in 2020–22)"], ["Paper 3", "30"], ["Paper 4", "60 (70 in 2020–22)"]]);
    expect(guide.papers.map((paper) => paper.weighting)).toEqual(["33% of AS, 17% of A Level", "67% of AS, 33% of A Level", "17% of A Level", "33% of A Level"]);
  });
});

describe("A Level Economics 9708 billing", () => {
  it("sells as a single bank at the shared single-bank price and joins Build Your Plan", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toMatchObject({ priceId: "price_single_monthly" });
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, { NODE_ENV: "production" })).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleAnnualPriceId, stripeConfig, "annual")).toBe(true);
    expect(getCustomBundlePlan("monthly", [slug, "a-level-chemistry-9701"], stripeConfig, PRODUCTION)).toMatchObject({ productId: "bundle_custom", quantity: 2 });
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by a pair bundle", () => {
    for (const ok of [entitlement(product), entitlement("bundle_all"), entitlement("lifetime_all_access"), entitlement("bundle_custom", [slug, "igcse"])]) expect(hasBankAccess(slug, ok)).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_economics", "bank_ib_economics_hl", "bank_igcse_economics_0455", "bank_a_level_biology_9700"]) expect(hasBankAccess(slug, entitlement(other))).toBe(false);
  });

  it("registers the product in an unapplied migration copied from Biology 9700's billing definitions, with no Stripe id", () => {
    const name = "20261120000000_a_level_economics_9708_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    expect(new Set(migrations.map((file) => file.slice(0, 14))).size).toBe(migrations.length);
    // A later bank release may redefine these objects only by carrying 9708 forward in every list.
    for (const later of migrations.filter((file) => file > name)) {
      const body = readFileSync(join(ROOT, "supabase/migrations", later), "utf8");
      if (!/products_known_id|function public\.confirm_billing_checkout/.test(body)) continue;
      expect(body.match(/'bank_a_level_economics_9708'/g)?.length, `${later} drops bank_a_level_economics_9708`).toBe(6);
      expect(body.match(/'a-level-economics-9708'/g)?.length, `${later} drops a-level-economics-9708`).toBe(3);
    }
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration.match(/'bank_a_level_economics_9708'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-economics-9708'/g)?.length).toBe(3);
    // Every earlier bank is carried forward in each list it redefines.
    for (const id of ["bank_a_level_biology_9700", "bank_a_level_chemistry_9701", "bank_a_level_physics_9702", "bank_a_level_maths_9709", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(6);
    for (const id of ["a-level-biology-9700", "a-level-chemistry-9701", "a-level-physics-9702", "a-level-maths-9709"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    // Apart from the new product and slug, it is the 9700 migration's body verbatim.
    const body = (sql: string) => sql.slice(sql.indexOf("alter table public.products drop constraint"));
    const biology = readFileSync(join(ROOT, "supabase/migrations/20261119000000_a_level_biology_9700_release.sql"), "utf8");
    expect(body(migration).replaceAll(",'bank_a_level_economics_9708'", "").replaceAll(",'a-level-economics-9708'", "").replaceAll("('bank_a_level_economics_9708', 'A Level Economics 9708', true)", "('bank_a_level_biology_9700', 'A Level Biology 9700', true)").replaceAll("(values ('bank_a_level_economics_9708'))", "(values ('bank_a_level_biology_9700'))")).toBe(body(biology));
  });

  it("has a named exemption from the full-explanation article claim", () => {
    expect(PARTIAL_EXPLANATION_BANKS[slug]).toMatch(/2026-11-17/);
  });
});

describe("A Level Economics 9708 runtime", () => {
  it("ships 3,207 questions from 183 canonical papers: P1 1,492, P2 215, P3 1,260, P4 240", () => {
    expect(runtime.questionCount).toBe(3207);
    expect(runtime.paperCount).toBe(183);
    expect(new Set(runtime.questions.map((question) => question.paperId)).size).toBe(183);
    const count = (paper: number) => runtime.questions.filter((question) => question.paper === paper).length;
    expect([count(1), count(2), count(3), count(4)]).toEqual([1492, 215, 1260, 240]);
    expect(runtime.questions.every((question) => ([1, 3].includes(question.paper)) === (question.format === "multiple_choice"))).toBe(true);
    expect(runtime.questions.every((question) => [1, 2, 3, 4].includes(question.paper))).toBe(true);
  });

  it("serves each paper's total and timing for its syllabus era (2020-2022 written papers were shorter or longer)", () => {
    for (const question of runtime.questions) expect(question.maxMarks, question.id).toBe(runtime.paperFacts[String(question.paper)].totalMarksByEra[question.year <= 2022 ? "2019" : "2023"]);
    expect(runtime.paperFacts["1"]).toMatchObject({ durationMinutes: 60, totalMarks: 30, durationMinutesByEra: { 2019: 60, 2023: 60 } });
    expect(runtime.paperFacts["2"]).toMatchObject({ durationMinutes: 120, totalMarks: 60, durationMinutesByEra: { 2019: 90, 2023: 120 }, totalMarksByEra: { 2019: 40, 2023: 60 } });
    expect(runtime.paperFacts["3"]).toMatchObject({ durationMinutes: 75, totalMarks: 30, durationMinutesByEra: { 2019: 75, 2023: 75 } });
    expect(runtime.paperFacts["4"]).toMatchObject({ durationMinutes: 120, totalMarks: 60, durationMinutesByEra: { 2019: 135, 2023: 120 }, totalMarksByEra: { 2019: 70, 2023: 60 } });
  });

  it("keeps the 17 held questions out: 15 data-response Q1s with content removed for copyright, and 2 MCQ items", () => {
    expect([...runtime.heldQuestionIds].sort()).toEqual([...HELD_COPYRIGHT, APP_HELD, ...HELD_MCQ].sort());
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const id of runtime.heldQuestionIds) expect(ids.has(id), id).toBe(false);
    // The rest of each affected written paper is served: its essays.
    for (const id of [...HELD_COPYRIGHT, APP_HELD]) expect(runtime.questions.filter((question) => question.paperId === id.slice(0, -3)).length, id).toBeGreaterThan(0);
  });

  it("excludes the 6 multiple-choice items Cambridge removed, which have no key", () => {
    expect(runtime.excludedQuestionIds).toEqual(EXCLUDED);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const id of EXCLUDED) expect(ids.has(id), id).toBe(false);
    expect(runtime.questions.filter((question) => question.paperId === "9708-2024-s-12")).toHaveLength(27);
    expect(runtime.questions.filter((question) => question.paperId === "9708-2023-s-11")).toHaveLength(28);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(releaseRuntimeSha256(runtime)).toBe(runtime.runtimeArtifact.runtimeSha256);
    const candidate = reconstructCandidate(runtime);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(slug, candidate)).not.toThrow();
  });

  it("is finalized against a complete verified readback of exactly the manifest's crops", () => {
    expect(receipt).toMatchObject({ bank: slug, storageState: "verified_readback", failed: [], assetManifestSha256: manifestSha256(manifest) });
    expect([...receipt.completed].sort()).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    const logText = readFileSync(join(ROOT, receipt.readbackProvenance.log), "utf8");
    expect(createHash("sha256").update(logText).digest("hex")).toBe(receipt.readbackProvenance.logSha256);
    const log = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean });
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
    expect(log).toHaveLength(7347);
    expect(new Set(log.map((row) => row.key)).size).toBe(7347);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore, row.key).toBe(true);
    // 7,342 current objects plus the 5 crops of 9708-2025-m-22-q1, uploaded before the owner held it: left in R2, unserved.
    const superseded = log.filter((row) => !byKey.has(row.key));
    expect(superseded.map((row) => row.key).sort()).toEqual([...(receipt.readbackProvenance as { supersededKeys: string[] }).supersededKeys].sort());
    expect(superseded).toHaveLength(5);
    expect(superseded.every((row) => /\/9708-2025-m-22\/q1-/.test(row.key))).toBe(true);
    for (const row of log.filter((entry) => byKey.has(entry.key))) expect(byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta.assetManifestSha256).toBe(manifestSha256(manifest));
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/a-level-economics-9708.receipt.json"), "utf8")).digest("hex"));
  });

  it("marks every essay with its choice group, from the paper's own rubric, and nothing else", () => {
    const essays = runtime.questions.filter((question) => question.format === "essay");
    expect(essays).toHaveLength(379);
    expect(runtime.questions.filter((question) => question.choiceGroup)).toEqual(essays);
    const groups: Record<string, number> = {};
    for (const question of essays) {
      const key = `P${question.paper} ${question.year <= 2022 ? "2020-22" : "2023+"} ${question.choiceGroup} ${question.choiceRequired} ${question.marks}`;
      groups[key] = (groups[key] ?? 0) + 1;
      expect(question.choiceGroup, question.id).toBe(`section_${question.section!.toLowerCase()}_answer_${question.choiceRequired === 2 ? "two" : "one"}`);
    }
    expect(groups).toEqual({
      "P2 2020-22 section_b_answer_one 1 20": 63,
      "P4 2020-22 section_b_answer_two 2 25": 108,
      "P2 2023+ section_b_answer_one 1 20": 56,
      "P2 2023+ section_c_answer_one 1 20": 56,
      "P4 2023+ section_b_answer_one 1 20": 48,
      "P4 2023+ section_c_answer_one 1 20": 48,
    });
    // Section A data response is compulsory: Q1, 20 marks, no group.
    for (const question of runtime.questions.filter((row) => row.format === "data_response")) expect(question, question.id).toMatchObject({ number: 1, section: "A", marks: 20 });
  });

  it("keeps the levels tables at the end of every 2023+ essay mark scheme, and nowhere else", () => {
    let crops = 0;
    for (const question of runtime.questions) {
      const levels = question.markschemeImages.filter((image) => image.includes("-levels-"));
      crops += levels.length;
      const needs = question.format === "essay" && question.year >= 2023;
      expect(levels.length > 0, question.id).toBe(needs);
      if (needs) expect(question.markschemeImages.slice(-levels.length), question.id).toEqual(levels);
    }
    expect(crops).toBe(420);
  });

  it("has no withdrawn parts and no shared-stimulus crops, so no scoreable-marks entries", () => {
    expect(runtime.questions.filter((question) => question.removedParts || question.sharedStimulusImages)).toEqual([]);
    expect(Object.keys(removedPartMarks.entries)).not.toContain(slug);
  });

  it("serves every multiple-choice letter from the official key, read two ways, and none for written rows", () => {
    const rows = runtimeJson.questions as unknown as Array<Record<string, unknown>>;
    const letters = buildMcqAnswerMap(slug, rows);
    expect(letters.size).toBe(2752);
    for (const question of runtime.questions) {
      expect(isMcqRow(slug, question as unknown as Record<string, unknown>), question.id).toBe(question.format === "multiple_choice");
      if (question.format !== "multiple_choice") { expect(question.answer).toBeUndefined(); continue; }
      expect(question.answerProvenance, question.id).toMatchObject({ status: "official", questionId: question.id });
      expect(question.answerProvenance!.keyReads.markSchemeText, question.id).toBe(question.answerProvenance!.keyReads.renderedView);
      expect(letters.get(question.id)?.answers, question.id).toEqual([question.answer]);
      if (question.id !== "9708-2020-w-12-q25") expect(question.answer, question.id).toBe(question.answerProvenance!.keyReads.markSchemeText);
    }
  });

  it("serves C for 9708-2020-w-12-q25 from Cambridge's examiner report; the mark scheme misprints B", () => {
    const question = runtime.questions.find((row) => row.id === "9708-2020-w-12-q25")!;
    expect(question.answer).toBe("C");
    expect(question.answerProvenance).toMatchObject({ status: "official", servedFrom: "examiner_report_key_table", keyReads: { markSchemeText: "B", renderedView: "B", examinerReport: "C" } });
    // The answer chip explains why the mark-scheme crop shows B (reviewed letters file).
    const letter = buildMcqAnswerMap(slug, runtimeJson.questions as unknown as Array<Record<string, unknown>>).get(question.id);
    expect(letter).toEqual({ answers: ["C"], note: expect.stringMatching(/mark scheme prints B.*examiner report key table gives C/) });
  });

  it("lists topics 1-11 in syllabus order and the 4 used earlier-syllabus topics at the end, with unique labels", () => {
    expect(taxonomy.topics.map((topic) => topic.label)).toEqual([...ECONOMICS_9708_TOPICS, ...ECONOMICS_9708_EARLIER_TOPICS]);
    expect(new Set(taxonomy.topics.map((topic) => topic.label)).size).toBe(15);
    expect(ECONOMICS_9708_TOPICS.slice(6).every((topic) => topic.endsWith("(A Level)"))).toBe(true);
    expect(ECONOMICS_9708_EARLIER_TOPICS.every((topic) => topic.endsWith("(earlier syllabus)"))).toBe(true);
    expect(taxonomy.topics.every((topic) => topic.questions > 0)).toBe(true);
    const all = getTopicOptions(questions);
    expect(all.slice(0, 11)).toEqual(ECONOMICS_9708_TOPICS);
    expect(all.slice(11)).toEqual(ECONOMICS_9708_EARLIER_TOPICS);
    expect(all).not.toContain("Other");
    for (const question of runtime.questions) {
      if ([question.primaryTopic, ...question.secondaryTopics].some((topic) => topic.endsWith("(earlier syllabus)"))) expect(question.year, question.id).toBeLessThanOrEqual(2022);
    }
    // Every subtopic label names one syllabus section ("Exchange rates" is 6.4; 11.2 says "(A Level)").
    const sections = Object.values(ECONOMICS_9708_SUBTOPICS).flat();
    expect(new Set(sections).size).toBe(sections.length);
  });

  it("gives each paper its own tab, AS before A Level, opening on AS multiple choice; AS papers carry no A Level primary from 2023", () => {
    expect([1, 2, 3, 4].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["as-multiple-choice", "as-written", "a-level-multiple-choice", "a-level-written"]);
    expect(defaultRouteSelection(slug)).toBe("as-multiple-choice");
    expect(routeConfigFor(slug)?.options.map((option) => option.label)).toEqual(["AS multiple choice", "AS written", "A Level multiple choice", "A Level written"]);
    expect(routeConfigFor(slug)).toMatchObject({ allLabel: "All papers", remember: true, scopesTopics: true, hidesPaperFilter: true });
    const aLevelTopics = new Set(ECONOMICS_9708_TOPICS.slice(6));
    expect(runtime.questions.filter((question) => question.paper <= 2 && question.year >= 2023 && aLevelTopics.has(question.primaryTopic)).map((question) => question.id)).toEqual([]);
  });

  it("makes exactly the 918 questions from 2020 and 2021 free and labels the 176 May/June 2020 ones not sat", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    expect(questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(918);
    expect(runtime.questions.filter((question) => question.examStatus === "released_not_sat")).toHaveLength(176);
    for (const question of runtime.questions) expect(isNotSatSeries(slug, question.year, question.session), question.id).toBe(question.examStatus === "released_not_sat");
  });

  it("resolves the 250 alias variants to their canonical questions; the held question's alias is left out", () => {
    const map = (aliases.banks as Record<string, Record<string, string>>)[slug];
    expect(Object.keys(map)).toHaveLength(250);
    expect(map["9708-2025-s-43-q1"]).toBeUndefined();
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(map)) {
      expect(ids.has(alias)).toBe(false);
      expect(ids.has(canonical)).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("allows a calculator on every paper and shows no reference sheet: the syllabus gives no formulae", () => {
    for (const paper of [1, 2, 3, 4]) for (const year of [2020, 2026]) expect(calculatorAllowed(slug, { paper, year })).toBe(true);
    expect(CALCULATOR_FILTER_BANKS).not.toContain(slug);
    expect(hasPeriodicTable(slug)).toBe(false);
    expect(formulaListFor(slug)).toBeUndefined();
    expect(formulaListFor(slug, 2020)).toBeUndefined();
    expect(formulaListsForYears(slug, [2021, 2024])).toEqual([]);
  });
});

describe("A Level Economics 9708 subtopic picker", () => {
  it("keeps the section map equal to the bank taxonomy", () => {
    const fromTaxonomy = Object.fromEntries(taxonomy.topics.filter((topic) => !topic.earlierSyllabus).map((topic) => [topic.label, topic.subtopics.map((subtopic) => subtopic.label)]));
    expect(ECONOMICS_9708_SUBTOPICS).toEqual(fromTaxonomy);
  });

  for (const [label, rows] of [["normalized", questions], ["hydrated from bank-index metadata", hydrated]] as const) {
    it(`shows each topic's own sections on every paper tab (${label})`, () => {
      for (const paper of [1, 2, 3, 4]) {
        const tab = rows.filter((question) => question.paper === paper);
        for (const topic of getTopicOptions(tab)) {
          const groups = getSubtopicGroups(tab, [topic], []);
          if (topic.endsWith("(earlier syllabus)")) { expect(groups.relevant, `${paper} ${topic}`).toEqual([]); continue; }
          for (const subtopic of groups.relevant) expect(ECONOMICS_9708_SUBTOPICS[topic], `${paper} ${topic}`).toContain(subtopic);
          expect(groups.relevant.length, `${paper} ${topic}`).toBeGreaterThan(0);
          // Every section of this topic that a question in this tab carries is listed.
          const own = new Set(tab.flatMap((question) => question.subtopics).filter((subtopic) => ECONOMICS_9708_SUBTOPICS[topic].includes(subtopic)));
          for (const subtopic of own) expect(groups.relevant, `${paper} ${topic}`).toContain(subtopic);
        }
      }
      // With no topic chosen, every section present is listed in syllabus order.
      const order = Object.values(ECONOMICS_9708_SUBTOPICS).flat();
      const all = getSubtopicGroups(rows, [], []).all;
      expect(all).toEqual(order.filter((subtopic) => all.includes(subtopic)));
      // AS "Exchange rates" and A Level "Exchange rates (A Level)" never mix.
      const topicsOf = (subtopic: string) => filterQuestions(rows, { subtopics: [subtopic] }).map((question) => [question.primaryTopic, ...question.secondaryTopics]);
      for (const topics of topicsOf("Exchange rates")) expect(topics).toContain("International economic issues");
      for (const topics of topicsOf("Exchange rates (A Level)")) expect(topics).toContain("International economic issues (A Level)");
    });
  }
});

describe("A Level Economics 9708 secondary sections (the #499 review fix)", () => {
  const sectionTopic = new Map(Object.entries(ECONOMICS_9708_SUBTOPICS).flatMap(([topic, sections]) => sections.map((section) => [section, topic] as const)));

  it("gives every current secondary topic at least one reviewed section, and only sections of the question's own topics", () => {
    let pairs = 0;
    for (const question of runtime.questions) {
      const topics = new Set([question.primaryTopic, ...question.secondaryTopics]);
      for (const section of question.secondarySubtopics) expect(topics.has(sectionTopic.get(section)!), `${question.id} ${section}`).toBe(true);
      expect(new Set(question.subtopics).size, question.id).toBe(question.subtopics.length);
      // The primary subtopic first, then the reviewed further sections.
      const primaryCount = question.primaryTopic.endsWith("(earlier syllabus)") ? 0 : 1;
      expect(question.subtopics.slice(primaryCount), question.id).toEqual(question.secondarySubtopics);
      for (const topic of question.secondaryTopics) {
        if (topic.endsWith("(earlier syllabus)")) continue;
        pairs += 1;
        expect(question.secondarySubtopics.some((section) => sectionTopic.get(section) === topic), `${question.id} ${topic}`).toBe(true);
      }
    }
    // 327 reviewed pairs, less the one of held 9708-2025-m-22-q1.
    expect(pairs).toBe(326);
    expect(runtime.questions.filter((question) => question.secondarySubtopics.length)).toHaveLength(377);
    expect((runtimeJson.runtimeArtifact as unknown as { sourceSha256: Record<string, string> }).sourceSha256.secondarySubtopics).toBe("1579d6381519eb95f9b181404afaac9a1a464aac02776775eb8c195b0e4b52c0");
  });

  for (const [label, rows] of [["normalized", questions], ["hydrated from bank-index metadata", hydrated]] as const) {
    it(`finds 9708-2020-m-22-q1 under the sections its parts are marked on (${label})`, () => {
      const p2 = rows.filter((question) => question.paper === 2);
      const ids = (filters: Parameters<typeof filterQuestions>[1]) => filterQuestions(p2, filters).map((question) => question.id);
      // (a)(ii) tariffs and (d) trade war -> Protectionism; (b)(ii) Marshall-Lerner -> A Level exchange rates.
      expect(ids({ topics: ["International economic issues"], subtopics: ["Protectionism"] })).toContain("9708-2020-m-22-q1");
      expect(ids({ subtopics: ["Exchange rates (A Level)"] })).toContain("9708-2020-m-22-q1");
      expect(ids({ subtopics: ["Current account of the balance of payments"] })).toContain("9708-2020-m-22-q1");
      // An unassessed section does not find it, and AS "Exchange rates" stays apart.
      expect(ids({ subtopics: ["Exchange rates"] })).not.toContain("9708-2020-m-22-q1");
      expect(ids({ subtopics: ["Globalisation"] })).not.toContain("9708-2020-m-22-q1");
    });
  }
});

describe("A Level Economics 9708 held 9708-2025-m-22-q1 (owner review of #500: QP p. 3 removes Fig. 1.2, which Q1(c) needs)", () => {
  const emitted = () => {
    const file = PUBLIC_BANK_INDEX_FILES[slug as keyof typeof PUBLIC_BANK_INDEX_FILES];
    return (JSON.parse(readFileSync(join(ROOT, "public", "bank-index", file), "utf8")) as PublicBankIndex).questions;
  };

  it("is absent from the runtime, the private index, the emitted bank index and the hydrated rows", () => {
    expect(runtime.questions.some((question) => question.id === APP_HELD)).toBe(false);
    expect(privateIndex.questions.some((question) => question.id === APP_HELD)).toBe(false);
    expect(emitted().some((question) => question.id === APP_HELD)).toBe(false);
    expect(hydrated.some((question) => question.id === APP_HELD)).toBe(false);
    expect(currentQuestionId(slug, APP_HELD)).toBe(APP_HELD);
    // The rest of the paper (its four essays) is still served.
    expect(runtime.questions.filter((question) => question.paperId === "9708-2025-m-22").map((question) => question.number)).toEqual([2, 3, 4, 5]);
  });

  it("is never picked by the worksheet builder, even for an exact 20-mark AS written request on 2025", () => {
    const pool = emitted().filter((question) => question.paper === 2 && question.year === 2025);
    expect(pool.length).toBeGreaterThan(0);
    for (let seed = 1; seed <= 200; seed += 1) {
      const built = generatePaper(pool, { mode: "marks", targets: [{ paper: 2, amount: 20 }], seed, yearFrom: 2025, yearTo: 2025, bank: slug, courseRoute: "as-written" });
      expect(built.questions.map((question) => question.id), String(seed)).not.toContain(APP_HELD);
    }
  });
});

describe("A Level Economics 9708 AD/AS sections (owner review of #500)", () => {
  it("finds 9708-2021-w-21-q1 and 9708-2022-s-22-q1 under Aggregate Demand and Aggregate Supply analysis in the emitted index", () => {
    const file = PUBLIC_BANK_INDEX_FILES[slug as keyof typeof PUBLIC_BANK_INDEX_FILES];
    const emitted = (JSON.parse(readFileSync(join(ROOT, "public", "bank-index", file), "utf8")) as PublicBankIndex).questions.map((meta) => publicMetadataToQuestion(meta, slug));
    const asWritten = emitted.filter((question) => question.paper === 2);
    const ids = (filters: Parameters<typeof filterQuestions>[1]) => filterQuestions(asWritten, filters).map((question) => question.id);
    for (const id of ["9708-2021-w-21-q1", "9708-2022-s-22-q1"]) {
      // MS 2021 Q1(d) p. 6 and 2022 Q1(c) p. 7: AD/AS analysis for 6 marks each.
      expect(ids({ topics: ["The macroeconomy"] }), id).toContain(id);
      expect(ids({ topics: ["The macroeconomy"], subtopics: ["Aggregate Demand and Aggregate Supply analysis"] }), id).toContain(id);
      expect(ids({ subtopics: ["Aggregate Demand and Aggregate Supply analysis"] }), id).toContain(id);
    }
    // Primaries are kept.
    const primary = (id: string) => runtime.questions.find((question) => question.id === id)!.primaryTopic;
    expect(primary("9708-2021-w-21-q1")).toBe("The macroeconomy");
    expect(primary("9708-2022-s-22-q1")).toBe("Government macroeconomic intervention");
  });
});

describe("A Level Economics 9708 storage plan", () => {
  it("plans exactly the runtime's 7,342 crops under a new prefix (the uploaded 7,347 less the held question's 5)", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets).toHaveLength(7342);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith(`${PREFIX}/`) && asset.contentType === "image/webp")).toBe(true);
    // No crop of a held or excluded question is planned.
    for (const id of [...runtime.heldQuestionIds, ...EXCLUDED]) {
      const paperId = id.replace(/-q\d+$/, "");
      const number = id.match(/-q(\d+)$/)![1];
      expect(manifest.assets.some((asset) => asset.objectKey.includes(`/${paperId}/q${number}-`)), id).toBe(false);
    }
    // The dry run checked the plan as uploaded (before the hold).
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 7347, uniqueKeys: 7347, mismatches: 0, localSha256ReHashed: 7347, sha256MatchesSegmentationRecord: 7347 });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(3207);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });

  it("records the generator's pinned source in the runtime", () => {
    const meta = runtimeJson.runtimeArtifact as unknown as { sourceCommit: string; sourceRepository: string };
    expect(meta).toMatchObject({ sourceRepository: "cambridge-a-level-economics-9708-topic-practice", sourceCommit: "88d95f8" });
    const generator = join(ROOT, "scripts/generate-a-level-economics-9708-runtime.mjs");
    expect(existsSync(generator)).toBe(true);
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/a-level-economics-9708-taxonomy.json"))).digest("hex")).toBe((runtimeJson as unknown as { taxonomy: { sha256: string } }).taxonomy.sha256);
  });
});
