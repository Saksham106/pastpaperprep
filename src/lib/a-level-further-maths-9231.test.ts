import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/a-level-further-maths-9231.json";
import taxonomyJson from "@/data/a-level-further-maths-9231-taxonomy.json";
import privateIndex from "@/data/private-index/a-level-further-maths-9231.json";
import aliases from "@/data/question-id-aliases.json";
import reprintAliases from "@/data/reprint-question-aliases.json";
import manifestJson from "../../data/storage/a-level-further-maths-9231.manifest.json";
import dryRun from "../../data/storage/a-level-further-maths-9231.dry-run.json";
import receipt from "../../data/storage/a-level-further-maths-9231.receipt.json";
import freeCopyReceipt from "../../docs/a-level-further-maths-9231-free-copy/receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { A_LEVEL_FURTHER_MATHS_9231, FURTHER_MATHS_9231_PAPERS, FURTHER_MATHS_9231_SECTION_ORDER, FURTHER_MATHS_9231_SUBTOPICS } from "@/lib/a-level-9231";
import { MF19_URL } from "@/lib/a-level-9709";
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
import { publicMetadataToQuestion, type PublicQuestionMetadata } from "@/lib/question-index";
import { defaultRouteSelection, deriveCourseRoute, routeConfigFor } from "@/lib/course-route";
import { isNotSatSeries } from "@/lib/series-notes";
import { formulaListFor, formulaListsForYears } from "@/lib/formula-lists";
import { hasPeriodicTable } from "@/lib/periodic-table";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { calculatorAllowed, calculatorBadgeText, CALCULATOR_FILTER_BANKS } from "@/lib/calculator-policy.mjs";
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
import { buildBankAssetManifest } from "@/lib/asset-manifest-build";
import { listFreePublicAssets } from "@/lib/free-public-assets";
import removedPartMarks from "@/data/reviewed-science-removed-part-marks.json";

const ROOT = process.cwd();
const slug = A_LEVEL_FURTHER_MATHS_9231;
const product = "bank_a_level_further_maths_9231";
const CANDIDATE = "89c4fe2cbc19ba4c9ddf6d2d76635ffc30f1c5f4cd8c1c6e8c3ac485cc4db7de";
const PREFIX = "a-level-further-maths-9231/releases/full813-v1-89c4fe2cbc19";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
type RuntimeQuestion = {
  id: string; paperId: string; number: number; paper: number; year: number; era: string; session: string; examStatus: string; format: string; component: string;
  marks: number; maxMarks: number; aliasIds: string[]; primaryTopic: string; primaryTopicId: string; secondaryTopics: string[]; subtopics: string[]; secondarySubtopics: string[];
  classificationProvenance: { primaryCode: string; primarySubtopic: string; secondaryCodes: string[] };
  removedParts?: string[]; sharedStimulusImages?: string[]; accessibleText: string; answer?: string; choiceGroup?: string;
  questionImages: string[]; markschemeImages: string[]; sourceQuestionUrl: string; sourceMarkSchemeUrl: string;
};
const runtime = runtimeJson as unknown as {
  questionCount: number; paperCount: number; years: string; assetVerification: string; publicationStatus: string; heldQuestionIds: string[]; excludedQuestionIds: string[];
  paperFacts: Record<string, { name: string; durationMinutes: number; totalMarks: number }>;
  fullMarksAwardedNotes: Array<{ paperId: string; questionIds: string[]; parts: string[]; decision: string }>;
  questions: RuntimeQuestion[]; runtimeArtifact: { originalCandidateRuntimeSha256: string; runtimeSha256: string };
};
type Section = { id: string; code: string; label: string; level: string; questions: number; subtopics: Array<{ code: string; label: string; syllabusTitle: string }> };
const taxonomy = taxonomyJson as { papers: Array<{ paper: number; title: string; sections: Section[] }> };
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
const SUBJECT_ORDER = ["Mathematics", "Further Mathematics", "Chemistry", "Physics", "Biology", "Economics", "Computer Science"];

describe("A Level Further Mathematics 9231 catalog entry", () => {
  it("is a hidden, gated, paid Cambridge A Level bank with no pair bundle, listed right after Mathematics", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Further Mathematics", title: "Further Mathematics 9231", syllabusCode: "9231", questionCount: 813, paperCount: 116, years: "2020-2026", productId: product, release: "gated", delivery: "hosted", pendingStorage: true });
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
    expect(BOARD_SUBJECT_ORDER["a-level"]).toEqual(SUBJECT_ORDER);
  });

  it("rides the shared release lane, finalized against a verified readback but still hidden", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(RELEASE_BANKS[slug]).toEqual({ prefix: PREFIX, sourceRootEnv: "PASTPAPERPREP_A_LEVEL_FURTHER_MATHS_SOURCE_ROOT", candidateSeal: "blanked-v1", originalCandidateRuntimeSha256: CANDIDATE });
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    // Crops are rendered at 1.5 px/pt (516 pt wide = 774 px), like 9709.
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(getIGCSERuntimeArtifact(slug, PRODUCTION).questions).toHaveLength(813);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getBank(slug, PRODUCTION)).toBeUndefined();
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(false);
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(true);
    expect(isPendingStoragePreview(slug, { ...PRODUCTION, PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" })).toBe(false);
  });

  it("is held: no production public/bank-index source or manifest entry while pendingStorage is on", () => {
    expect(HELD_BANKS).toContain(slug);
    expect(publishedBankSources({ NODE_ENV: "production" }).some(({ bank }) => bank === slug)).toBe(false);
    expect(Object.keys(PUBLIC_BANK_INDEX_FILES)).not.toContain(slug);
  });

  it("has a course guide from the 2026-2027 syllabus: Paper 1 compulsory, Paper 2 A Level only", () => {
    const guide = assessmentGuideFor(getCatalogBank(slug)!);
    expect(guide.papers.map((paper) => [paper.name, paper.format, paper.duration, paper.marks, paper.weighting])).toEqual([
      ["Paper 1", "Further Pure Mathematics 1", "2 hr", "75", "60% of AS, 30% of A Level"],
      ["Paper 2", "Further Pure Mathematics 2", "2 hr", "75", "30% of A Level"],
      ["Paper 3", "Further Mechanics", "1 hr 30 min", "50", "40% of AS, 20% of A Level"],
      ["Paper 4", "Further Probability & Statistics", "1 hr 30 min", "50", "40% of AS, 20% of A Level"],
    ]);
    expect(guide.summary).toMatch(/AS Level is Paper 1 with Paper 3 or Paper 4\. A Level is all four papers/);
    expect(guide.caveat).toMatch(/never sat/);
  });
});

describe("A Level Further Mathematics 9231 billing", () => {
  it("sells as a single bank at the shared single-bank price and joins Build Your Plan once displayed", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PREVIEW)).toMatchObject({ priceId: "price_single_monthly" });
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleAnnualPriceId, stripeConfig, "annual")).toBe(true);
    expect(getCustomBundlePlan("monthly", [slug, "a-level-maths-9709"], stripeConfig, PREVIEW)).toMatchObject({ productId: "bundle_custom", quantity: 2 });
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by the Mathematics 9709 bank", () => {
    for (const ok of [entitlement(product), entitlement("bundle_all"), entitlement("lifetime_all_access"), entitlement("bundle_custom", [slug, "igcse"])]) expect(hasBankAccess(slug, ok)).toBe(true);
    for (const other of ["bank_a_level_maths_9709", "bundle_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_a_level_computer_science_9618"]) expect(hasBankAccess(slug, entitlement(other))).toBe(false);
    expect(hasBankAccess("a-level-maths-9709", entitlement(product))).toBe(false);
  });

  it("registers the product in an unapplied migration after 9618's, carrying every earlier bank forward, with no Stripe id", () => {
    const name = "20261122000000_a_level_further_maths_9231_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    expect(new Set(migrations.map((file) => file.slice(0, 14))).size).toBe(migrations.length);
    expect(migrations.indexOf(name)).toBeGreaterThan(migrations.indexOf("20261121000000_a_level_computer_science_9618_release.sql"));
    // A later bank release may redefine these objects only by carrying 9231 forward in every list.
    for (const later of migrations.filter((file) => file > name)) {
      const body = readFileSync(join(ROOT, "supabase/migrations", later), "utf8");
      if (!/products_known_id|function public\.confirm_billing_checkout/.test(body)) continue;
      expect(body.match(/'bank_a_level_further_maths_9231'/g)?.length, `${later} drops bank_a_level_further_maths_9231`).toBe(6);
      expect(body.match(/'a-level-further-maths-9231'/g)?.length, `${later} drops a-level-further-maths-9231`).toBe(3);
    }
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration.match(/'bank_a_level_further_maths_9231'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-further-maths-9231'/g)?.length).toBe(3);
    // Every earlier bank, 9618 included, is carried forward in each list it redefines.
    for (const id of ["bank_a_level_computer_science_9618", "bank_a_level_economics_9708", "bank_a_level_biology_9700", "bank_a_level_chemistry_9701", "bank_a_level_physics_9702", "bank_a_level_maths_9709", "bank_igcse_computer_science_0478", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(6);
    for (const id of ["a-level-computer-science-9618", "a-level-economics-9708", "a-level-biology-9700", "a-level-chemistry-9701", "a-level-physics-9702", "a-level-maths-9709"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    // Apart from the new product and slug, it is the 9618 migration's body verbatim.
    const body = (sql: string) => sql.slice(sql.indexOf("alter table public.products drop constraint"));
    const computerScience = readFileSync(join(ROOT, "supabase/migrations/20261121000000_a_level_computer_science_9618_release.sql"), "utf8");
    expect(body(migration).replaceAll(",'bank_a_level_further_maths_9231'", "").replaceAll(",'a-level-further-maths-9231'", "").replaceAll("('bank_a_level_further_maths_9231', 'A Level Further Mathematics 9231', true)", "('bank_a_level_computer_science_9618', 'A Level Computer Science 9618', true)").replaceAll("(values ('bank_a_level_further_maths_9231'))", "(values ('bank_a_level_computer_science_9618'))")).toBe(body(computerScience));
  });

  it("has a named exemption from the full-explanation article claim", () => {
    expect(PARTIAL_EXPLANATION_BANKS[slug]).toMatch(/2026-11-17/);
  });
});

describe("A Level Further Mathematics 9231 runtime", () => {
  it("ships 813 structured questions from 116 canonical papers: P1 203, P2 233, P3 202, P4 175", () => {
    expect(runtime.questionCount).toBe(813);
    expect(runtime.paperCount).toBe(116);
    expect(new Set(runtime.questions.map((question) => question.paperId)).size).toBe(116);
    const count = (paper: number) => runtime.questions.filter((question) => question.paper === paper).length;
    expect([count(1), count(2), count(3), count(4)]).toEqual([203, 233, 202, 175]);
    expect(runtime.questions.every((question) => question.format === "structured" && question.answer === undefined && question.choiceGroup === undefined)).toBe(true);
    expect(runtime.years).toBe("2020-2026");
    // June and November only: Cambridge sets no March series for 9231.
    expect(new Set(runtime.questions.map((question) => question.session))).toEqual(new Set(["June", "November"]));
    // Blind-pass linear maths transcripts as accessible text, as in 9709.
    expect(runtime.questions.every((question) => question.accessibleText.length > 20)).toBe(true);
  });

  it("serves the syllabus totals and timings, and every paper's questions add up to its printed total", () => {
    expect(runtime.paperFacts).toEqual({
      1: { name: "Further Pure Mathematics 1", durationMinutes: 120, totalMarks: 75 },
      2: { name: "Further Pure Mathematics 2", durationMinutes: 120, totalMarks: 75 },
      3: { name: "Further Mechanics", durationMinutes: 90, totalMarks: 50 },
      4: { name: "Further Probability & Statistics", durationMinutes: 90, totalMarks: 50 },
    });
    for (const question of runtime.questions) expect(question.maxMarks, question.id).toBe(runtime.paperFacts[question.paper].totalMarks);
    const totals = new Map<string, { paper: number; marks: number }>();
    for (const question of runtime.questions) totals.set(question.paperId, { paper: question.paper, marks: (totals.get(question.paperId)?.marks ?? 0) + question.marks });
    for (const [paperId, total] of totals) expect(total.marks, paperId).toBe(runtime.paperFacts[total.paper].totalMarks);
    expect(runtime.questions.reduce((sum, question) => sum + question.marks, 0)).toBe(7250);
    expect(FURTHER_MATHS_9231_PAPERS.map((paper) => [paper.paper, paper.name, paper.marks])).toEqual(Object.entries(runtime.paperFacts).map(([paper, facts]) => [Number(paper), facts.name, facts.totalMarks]));
  });

  it("holds and excludes nothing, and serves the three Oct/Nov 2023 'all candidates were awarded full marks' notes at printed marks", () => {
    expect(runtime.heldQuestionIds).toEqual([]);
    expect(runtime.excludedQuestionIds).toEqual([]);
    expect(runtime.fullMarksAwardedNotes).toEqual([
      { paperId: "9231-2023-w-22", questionIds: ["9231-2023-w-22-q6"], parts: ["6"], decision: "served_at_printed_marks" },
      { paperId: "9231-2023-w-32", questionIds: ["9231-2023-w-32-q1", "9231-2023-w-32-q2"], parts: ["1", "2"], decision: "served_at_printed_marks" },
      { paperId: "9231-2023-w-42", questionIds: ["9231-2023-w-42-q5"], parts: ["5(b)"], decision: "served_at_printed_marks" },
    ]);
    const marks = (id: string) => runtime.questions.find((question) => question.id === id)?.marks;
    expect(["9231-2023-w-22-q6", "9231-2023-w-32-q1", "9231-2023-w-32-q2", "9231-2023-w-42-q5"].map(marks)).toEqual([10, 4, 6, 16]);
    // The one MS with a blank part-total cell (5(c)): the QP's printed brackets are served.
    expect(marks("9231-2022-w-41-q5")).toBe(10);
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
    expect(log).toHaveLength(2728);
    expect(new Set(log.map((row) => row.key)).size).toBe(2728);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta.assetManifestSha256).toBe(manifestSha256(manifest));
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/a-level-further-maths-9231.receipt.json"), "utf8")).digest("hex"));
  });

  it("has exactly its 2020-2021 crops in the free bucket: the 719 files listFreePublicAssets returns once served", () => {
    // The asset manifest production builds once the bank is switched on (private asset mode).
    const served = normalizeBankQuestions(slug, runtimeJson.questions as unknown as Array<Record<string, unknown>>, { economicsAssetMode: "private", applyReviewedBlankPages: true });
    const free = listFreePublicAssets(slug, new Map(Object.entries(buildBankAssetManifest(served))) as never);
    expect(new Set(free.map((asset) => asset.questionId)).size).toBe(225);
    const rows = (file: string) => readFileSync(join(ROOT, "docs/a-level-further-maths-9231-free-copy", file), "utf8");
    expect(createHash("sha256").update(rows("copy-log.jsonl")).digest("hex")).toBe(freeCopyReceipt.copyLogSha256);
    expect(createHash("sha256").update(rows("verify-log.jsonl")).digest("hex")).toBe(freeCopyReceipt.verifyLogSha256);
    const verified = rows("verify-log.jsonl").split("\n").filter(Boolean).map((line) => JSON.parse(line) as { path: string; ok: boolean; sha256: string; bytes: number });
    expect(verified.map((row) => row.path).sort()).toEqual(free.map((asset) => asset.path).sort());
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
    for (const row of verified) expect(row.ok && byKey.get(row.path)?.sha256 === row.sha256 && byKey.get(row.path)?.size === row.bytes, row.path).toBe(true);
    expect(freeCopyReceipt).toMatchObject({ verified: 719, total: 719, failed: 0 });
  });

  it("has no withdrawn parts, no shared-stimulus crops and no multiple-choice rows", () => {
    expect(runtime.questions.filter((question) => question.removedParts || question.sharedStimulusImages)).toEqual([]);
    expect(Object.keys(removedPartMarks.entries)).not.toContain(slug);
    const rows = runtimeJson.questions as unknown as Array<Record<string, unknown>>;
    expect(buildMcqAnswerMap(slug, rows).size).toBe(0);
    expect(rows.some((row) => isMcqRow(slug, row))).toBe(false);
  });

  it("uses the 24 official sections, each question only from its own paper, as 9709 does", () => {
    const sections = taxonomy.papers.flatMap((paper) => paper.sections);
    expect(taxonomy.papers.map((paper) => [paper.paper, paper.sections.map((section) => section.code)])).toEqual([
      [1, ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"]], [2, ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]],
      [3, ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"]], [4, ["4.1", "4.2", "4.3", "4.4", "4.5"]],
    ]);
    expect(sections.every((section) => section.questions > 0)).toBe(true);
    expect(taxonomy.papers.map((paper) => paper.sections.map((section) => section.label))).toEqual(FURTHER_MATHS_9231_PAPERS.map((paper) => paper.sections));
    for (const question of runtime.questions) {
      for (const code of [question.classificationProvenance.primaryCode, ...question.classificationProvenance.secondaryCodes]) expect(code.startsWith(`${question.paper}.`), `${question.id} ${code}`).toBe(true);
      expect(question.classificationProvenance.primarySubtopic.startsWith(`${question.classificationProvenance.primaryCode}.`), question.id).toBe(true);
    }
    // 1.4 and 2.2 are both "Matrices" (the only shared title); a question's primaryTopicId still names its own section.
    expect(sections.filter((section) => section.label === "Matrices").map((section) => section.code)).toEqual(["1.4", "2.2"]);
    expect(new Set(sections.map((section) => section.label)).size).toBe(23);
    expect(new Set(runtime.questions.filter((question) => question.primaryTopic === "Matrices").map((question) => `${question.paper} ${question.primaryTopicId}`))).toEqual(new Set(["1 9231:2020:1.4", "2 9231:2020:2.2"]));
    expect(getTopicOptions(questions)).toEqual(FURTHER_MATHS_9231_SECTION_ORDER);
    for (const paper of FURTHER_MATHS_9231_PAPERS) expect(getTopicOptions(questions.filter((question) => question.paper === paper.paper)), `${paper.paper}`).toEqual(paper.sections);
  });

  it("gives each paper its own tab, opening on Further Pure 1", () => {
    expect([1, 2, 3, 4].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["further-pure-1", "further-pure-2", "further-mechanics", "further-probability-statistics"]);
    expect(defaultRouteSelection(slug)).toBe("further-pure-1");
    expect(routeConfigFor(slug)?.options.map((option) => option.label)).toEqual(["Further Pure 1", "Further Pure 2", "Further Mechanics", "Further Probability & Statistics"]);
    expect(routeConfigFor(slug)).toMatchObject({ allLabel: "All papers", allDetail: "Papers 1–4", remember: true, scopesTopics: true, hidesPaperFilter: true });
  });

  it("makes exactly the 225 questions from 2020 and 2021 free, and labels May/June 2020 'Not sat'", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    const free = questions.filter((question) => isPreviewQuestion(slug, question.id));
    expect(free).toHaveLength(225);
    expect(free.every((question) => question.year === 2020 || question.year === 2021)).toBe(true);
    const notSat = runtime.questions.filter((question) => question.examStatus === "released_not_sat");
    expect(notSat).toHaveLength(56);
    for (const question of runtime.questions) {
      const expected = question.year === 2020 && question.session === "June";
      expect(question.examStatus, question.id).toBe(expected ? "released_not_sat" : "sat");
      expect(isNotSatSeries(slug, question.year, question.session), question.id).toBe(expected);
    }
  });

  it("resolves the 365 alias variants one to one onto their canonical questions", () => {
    const map = (aliases.banks as Record<string, Record<string, string>>)[slug];
    expect(Object.keys(map)).toHaveLength(365);
    expect(new Set(Object.values(map)).size).toBe(365);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(map)) {
      expect(ids.has(alias)).toBe(false);
      expect(ids.has(canonical)).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
      expect(runtime.questions.find((question) => question.id === canonical)?.aliasIds).toContain(alias);
      // May/June: variant 2 reprints 1; Oct/Nov: variant 3 reprints 1.
      expect(alias.replace(/^(9231-\d{4})-s-(\d)2-/, "$1-s-$21-").replace(/^(9231-\d{4})-w-(\d)3-/, "$1-w-$21-"), alias).toBe(canonical);
    }
    expect(Object.keys((reprintAliases.banks as Record<string, unknown>)[slug] as object)).toHaveLength(52);
  });

  it("allows a scientific calculator on every paper and links the MF19 formula list", () => {
    for (const paper of [1, 2, 3, 4]) for (const year of [2020, 2026]) expect(calculatorAllowed(slug, { paper, year })).toBe(true);
    expect(calculatorBadgeText(calculatorAllowed(slug, { paper: 1, year: 2024 }))).toBe("CALCULATOR");
    expect(CALCULATOR_FILTER_BANKS).not.toContain(slug);
    expect(hasPeriodicTable(slug)).toBe(false);
    expect(formulaListFor(slug)).toEqual({ code: "MF19", label: "Formula list (MF19)", url: MF19_URL });
    expect(formulaListFor(slug, 2020)).toEqual(formulaListFor("a-level-maths-9709"));
    expect(formulaListsForYears(slug, [2020, 2026])).toEqual([formulaListFor(slug)]);
  });

  it("keeps May/June 2026 on Cambridge's own files (Exam Easy originals) and every other source on the pinned host", () => {
    for (const question of runtime.questions) {
      const host = question.year === 2026 ? "https://d.exam-easy.com/pdf/" : "https://bestexamhelp.com/exam/cambridge-international-a-level/mathematics-further-9231/";
      expect(question.sourceQuestionUrl.startsWith(host) && question.sourceMarkSchemeUrl.startsWith(host), question.id).toBe(true);
    }
  });
});

describe("A Level Further Mathematics 9231 subtopic picker", () => {
  it("keeps the outcome map equal to the bank taxonomy (Matrices: Paper 1's outcomes, then Paper 2's)", () => {
    const fromTaxonomy: Record<string, string[]> = {};
    for (const section of taxonomy.papers.flatMap((paper) => paper.sections)) (fromTaxonomy[section.label] ??= []).push(...section.subtopics.map((subtopic) => subtopic.label));
    expect(FURTHER_MATHS_9231_SUBTOPICS).toEqual(fromTaxonomy);
    const outcomes = Object.values(FURTHER_MATHS_9231_SUBTOPICS).flat();
    expect(outcomes).toHaveLength(84);
    expect(new Set(outcomes).size).toBe(84);
    // 3.6.1 is recall of e and Newton's law; impacts that use e are 3.6.2 (source classification receipt).
    expect(FURTHER_MATHS_9231_SUBTOPICS.Momentum).toEqual(["Restitution: definitions", "Direct and oblique impacts"]);
  });

  for (const [label, rows] of [["normalized", questions], ["hydrated from bank-index metadata", hydrated]] as const) {
    it(`shows each topic's own outcomes on every paper tab (${label})`, () => {
      for (const paper of [1, 2, 3, 4]) {
        const tab = rows.filter((question) => question.paper === paper);
        const topics = getTopicOptions(tab);
        expect(topics.length, `${paper}`).toBeGreaterThan(0);
        const own = new Set(taxonomy.papers.find((entry) => entry.paper === paper)!.sections.flatMap((section) => section.subtopics.map((subtopic) => subtopic.label)));
        for (const topic of topics) {
          const groups = getSubtopicGroups(tab, [topic], []);
          expect(groups.relevant.length, `${paper} ${topic}`).toBeGreaterThan(0);
          // A paper tab never offers another paper's outcomes, even under the shared "Matrices".
          for (const subtopic of groups.relevant) {
            expect(FURTHER_MATHS_9231_SUBTOPICS[topic], `${paper} ${topic}`).toContain(subtopic);
            expect(own.has(subtopic), `${paper} ${topic} ${subtopic}`).toBe(true);
          }
          const primary = new Set(tab.filter((question) => question.primaryTopic === topic).flatMap((question) => question.subtopics).filter((subtopic) => FURTHER_MATHS_9231_SUBTOPICS[topic].includes(subtopic)));
          for (const subtopic of primary) expect(groups.relevant, `${paper} ${topic}`).toContain(subtopic);
        }
      }
      // With no topic chosen, every outcome present is listed in syllabus order.
      const order = Object.values(FURTHER_MATHS_9231_SUBTOPICS).flat();
      const all = getSubtopicGroups(rows, [], []).all;
      expect(all).toEqual(order.filter((subtopic) => all.includes(subtopic)));
      // 77 of 84: seven foundational outcomes never earn marks of their own in any question, so the picker omits them.
      expect(all).toHaveLength(77);
      expect(order.filter((subtopic) => !all.includes(subtopic))).toEqual(["Simultaneous equations as matrix equations", "Proving de Moivre's theorem", "Complementary function and particular integral", "Projectile model and its limits", "Centre of mass by symmetry", "Circular motion acceleration", "Basis of sign and Wilcoxon tests"]);
      // "All papers" Matrices spans both papers; its outcomes keep them apart.
      expect(new Set(filterQuestions(rows, { topics: ["Matrices"] }).map((question) => question.paper))).toEqual(new Set([1, 2]));
      expect(new Set(filterQuestions(rows, { subtopics: ["Cayley-Hamilton theorem"] }).map((question) => question.paper))).toEqual(new Set([2]));
      expect(new Set(filterQuestions(rows, { subtopics: ["Matrix transformations"] }).map((question) => question.paper))).toEqual(new Set([1]));
    });
  }
});

describe("A Level Further Mathematics 9231 storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 2,728 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(2728);
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets).toHaveLength(2728);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith(`${PREFIX}/`) && asset.contentType === "image/webp")).toBe(true);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 2728, uniqueKeys: 2728, mismatches: 0, localSha256ReHashed: 2728, sha256MatchesSegmentationRecord: 2728, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(813);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });

  it("records the generator's pinned source in the runtime", () => {
    const meta = runtimeJson.runtimeArtifact as unknown as { sourceCommit: string; sourceRepository: string };
    expect(meta).toMatchObject({ sourceRepository: "cambridge-a-level-further-mathematics-9231-topic-practice", sourceCommit: "f750b6f" });
    expect(existsSync(join(ROOT, "scripts/generate-a-level-further-maths-9231-runtime.mjs"))).toBe(true);
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/a-level-further-maths-9231-taxonomy.json"))).digest("hex")).toBe((runtimeJson as unknown as { taxonomy: { sha256: string } }).taxonomy.sha256);
  });
});
