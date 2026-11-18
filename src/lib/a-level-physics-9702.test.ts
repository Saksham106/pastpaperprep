import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/a-level-physics-9702.json";
import taxonomyJson from "@/data/a-level-physics-9702-taxonomy.json";
import privateIndex from "@/data/private-index/a-level-physics-9702.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/a-level-physics-9702.manifest.json";
import dryRun from "../../data/storage/a-level-physics-9702.dry-run.json";
import receipt from "../../data/storage/a-level-physics-9702.receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { A_LEVEL_PHYSICS_9702, PHYSICS_9702_EARLIER_TOPICS, PHYSICS_9702_TOPICS } from "@/lib/a-level-9702";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, getCatalogBillingBanks, isPendingStoragePreview } from "@/lib/catalog";
import { getBank, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { BANK_PRODUCTS, bankEntryHref, hasBankAccess, hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { getCustomBundlePlan } from "@/lib/custom-bundles";
import { PURCHASABLE_PRODUCTS } from "@/lib/pricing-intent";
import { normalizeBankQuestions } from "@/lib/questions";
import { getTopicOptions } from "@/lib/taxonomy-router";
import { defaultRouteSelection, deriveCourseRoute, routeConfigFor } from "@/lib/course-route";
import { isNotSatSeries } from "@/lib/series-notes";
import { formulaListFor } from "@/lib/formula-lists";
import { buildMcqAnswerMap, isMcqRow } from "@/lib/mcq-answer-letters";
import { calculatorAllowed, CALCULATOR_FILTER_BANKS } from "@/lib/calculator-policy.mjs";
import { getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { PRIVATE_RUNTIME_OBJECT_PREFIXES } from "@/lib/private-runtime-mapping";
import { inferredPdfDpiForBank } from "@/lib/pdf-export";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { qualificationOfBank, SUBJECT_SLUGS } from "@/lib/past-paper-catalog";
import { PARTIAL_EXPLANATION_BANKS } from "@/lib/articles-explanation-coverage.test";

const ROOT = process.cwd();
const slug = A_LEVEL_PHYSICS_9702;
const product = "bank_a_level_physics_9702";
const CANDIDATE = "625c919f2ca5373a21be622a07c2c420656d5df2eda3e3f5b13bd82120874099";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
type RuntimeQuestion = { id: string; paperId: string; paper: number; year: number; session: string; examStatus: string; format: string; component: string; marks: number; maxMarks: number; aliasIds: string[]; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; officialCodeRefs: string[]; era: string; answer?: string; answerProvenance?: { status: string; questionId: string; keyReads: { markSchemeText: string; renderedView: string } }; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; assetVerification: string; questions: RuntimeQuestion[]; runtimeArtifact: { originalCandidateRuntimeSha256: string; runtimeSha256: string } };
const taxonomy = taxonomyJson as { topics: Array<{ id: string; label: string; earlierSyllabus: boolean; questions: number; subtopics: Array<{ label: string }> }> };
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
const manifest = manifestJson as { storageState: string; objectPrefix: string; originalCandidateRuntimeSha256: string; assets: Array<{ objectKey: string; sha256: string; size: number; contentType: string }> };
const questions = normalizeBankQuestions(slug, runtimeJson.questions as unknown as Array<Record<string, unknown>>);
const stripeConfig = validateStripeConfig({
  NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly", STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
  STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly", STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
  STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly", STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
  STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly", STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
  STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly", STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
});

describe("A Level Physics 9702 catalog entry", () => {
  it("is a hidden, gated, paid Cambridge A Level bank with no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Physics", title: "Physics 9702", syllabusCode: "9702", questionCount: 2627, paperCount: 132, years: "2020-2026", productId: product, release: "gated", delivery: "hosted", pendingStorage: true });
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
  });

  it("rides the shared release lane, finalized against a verified readback but still hidden", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(RELEASE_BANKS[slug]).toEqual({ prefix: "a-level-physics-9702/releases/full2627-v1-625c919f2ca5", sourceRootEnv: "PASTPAPERPREP_A_LEVEL_PHYSICS_SOURCE_ROOT", candidateSeal: "blanked-v1", originalCandidateRuntimeSha256: CANDIDATE });
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${RELEASE_BANKS[slug].prefix}/`);
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(getIGCSERuntimeArtifact(slug, PRODUCTION).questions).toHaveLength(2627);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getBank(slug, PRODUCTION)).toBeUndefined();
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(false);
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(true);
    expect(isPendingStoragePreview(slug, { ...PRODUCTION, PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" })).toBe(false);
  });
});

describe("A Level Physics 9702 billing", () => {
  it("sells as a single bank at the shared single-bank price and joins Build Your Plan once displayed", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PREVIEW)).toMatchObject({ priceId: "price_single_monthly" });
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleAnnualPriceId, stripeConfig, "annual")).toBe(true);
    expect(getCustomBundlePlan("monthly", [slug, "a-level-maths-9709"], stripeConfig, PREVIEW)).toMatchObject({ productId: "bundle_custom", quantity: 2 });
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by a pair bundle", () => {
    for (const ok of [entitlement(product), entitlement("bundle_all"), entitlement("lifetime_all_access"), entitlement("bundle_custom", [slug, "igcse"])]) expect(hasBankAccess(slug, ok)).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_physics", "bank_a_level_maths_9709", "bank_igcse_physics_0625"]) expect(hasBankAccess(slug, entitlement(other))).toBe(false);
  });

  it("registers the product in an unapplied migration copied from the latest billing definitions, with no Stripe id", () => {
    const name = "20261117000000_a_level_physics_9702_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    expect(new Set(migrations.map((file) => file.slice(0, 14))).size).toBe(migrations.length);
    expect(migrations.at(-1)).toBe(name);
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration.match(/'bank_a_level_physics_9702'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-physics-9702'/g)?.length).toBe(3);
    for (const id of ["bank_a_level_maths_9709", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(6);
    expect(migration.match(/'a-level-maths-9709'/g)?.length).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
  });

  it("has a named exemption from the full-explanation article claim", () => {
    expect(PARTIAL_EXPLANATION_BANKS[slug]).toMatch(/2026-11-17/);
  });
});

describe("A Level Physics 9702 runtime", () => {
  it("ships 2,627 questions from 132 canonical papers: 1,920 multiple choice, 324 Paper 2, 383 Paper 4", () => {
    expect(runtime.questionCount).toBe(2627);
    expect(runtime.paperCount).toBe(132);
    expect(new Set(runtime.questions.map((question) => question.paperId)).size).toBe(132);
    const count = (paper: number) => runtime.questions.filter((question) => question.paper === paper).length;
    expect([count(1), count(2), count(4)]).toEqual([1920, 324, 383]);
    expect(runtime.questions.every((question) => (question.paper === 1) === (question.format === "multiple_choice"))).toBe(true);
    expect(runtime.questions.every((question) => question.maxMarks === { 1: 40, 2: 60, 4: 100 }[question.paper])).toBe(true);
  });

  it("is sealed to its pinned, content-derived candidate", () => {
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
    expect(new Set(log.map((row) => row.key)).size).toBe(6056);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta.assetManifestSha256).toBe(manifestSha256(manifest));
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/a-level-physics-9702.receipt.json"), "utf8")).digest("hex"));
  });

  it("serves every multiple-choice letter from the official key, read two ways, and none for structured rows", () => {
    const rows = runtimeJson.questions as unknown as Array<Record<string, unknown>>;
    const letters = buildMcqAnswerMap(slug, rows);
    expect(letters.size).toBe(1920);
    for (const question of runtime.questions) {
      expect(isMcqRow(slug, question as unknown as Record<string, unknown>), question.id).toBe(question.format === "multiple_choice");
      if (question.format !== "multiple_choice") { expect(question.answer).toBeUndefined(); continue; }
      expect(question.answerProvenance).toMatchObject({ status: "official", questionId: question.id, keyReads: { markSchemeText: question.answer, renderedView: question.answer } });
      expect(letters.get(question.id)).toEqual({ answers: [question.answer], note: null });
    }
  });

  it("lists topics 1-25 in syllabus order with the 9 named earlier-syllabus topics at the end, all used", () => {
    expect(taxonomy.topics.map((topic) => topic.label)).toEqual([...PHYSICS_9702_TOPICS, ...PHYSICS_9702_EARLIER_TOPICS]);
    expect(PHYSICS_9702_EARLIER_TOPICS.every((topic) => topic.endsWith("(earlier syllabus)"))).toBe(true);
    expect(taxonomy.topics.every((topic) => topic.questions > 0)).toBe(true);
    const all = getTopicOptions(questions);
    expect(all.slice(0, 25)).toEqual(PHYSICS_9702_TOPICS);
    expect(all.slice(25)).toEqual(PHYSICS_9702_EARLIER_TOPICS);
    expect(all).not.toContain("Other");
    // Earlier-syllabus topics only on 2020-2021 papers; a current topic always carries its subtopic.
    for (const question of runtime.questions) {
      if ([question.primaryTopic, ...question.secondaryTopics].some((topic) => topic.endsWith("(earlier syllabus)"))) expect(question.year, question.id).toBeLessThanOrEqual(2021);
      if (!question.primaryTopic.endsWith("(earlier syllabus)")) expect(question.subtopics, question.id).toHaveLength(1);
    }
  });

  it("gives each in-scope paper its own tab, opening on multiple choice, and scopes topics to the tab", () => {
    expect([1, 2, 4].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["multiple-choice", "as-structured", "a-level-structured"]);
    expect(defaultRouteSelection(slug)).toBe("multiple-choice");
    expect(routeConfigFor(slug)?.options.map((option) => option.label)).toEqual(["Multiple choice", "AS structured", "A Level structured"]);
    expect(routeConfigFor(slug)).toMatchObject({ allLabel: "All papers", remember: true, scopesTopics: true, hidesPaperFilter: true });
    const asTopics = getTopicOptions(questions.filter((question) => question.paper === 2));
    expect(asTopics.filter((topic) => PHYSICS_9702_TOPICS.indexOf(topic) >= 11 && questions.some((question) => question.paper === 2 && question.year >= 2022 && question.primaryTopic === topic))).toEqual([]);
  });

  it("makes exactly the 773 questions from 2020 and 2021 free and labels the 164 May/June 2020 ones not sat", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    expect(questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(773);
    expect(runtime.questions.filter((question) => question.examStatus === "released_not_sat")).toHaveLength(164);
    for (const question of runtime.questions) expect(isNotSatSeries(slug, question.year, question.session), question.id).toBe(question.examStatus === "released_not_sat");
  });

  it("resolves the 184 alias variants to their canonical questions", () => {
    const map = (aliases.banks as Record<string, Record<string, string>>)[slug];
    expect(Object.keys(map)).toHaveLength(184);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(map)) {
      expect(ids.has(alias)).toBe(false);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("allows a calculator on every paper and links the data and formulae sheet of each syllabus era", () => {
    for (const paper of [1, 2, 4]) for (const year of [2020, 2026]) expect(calculatorAllowed(slug, { paper, year })).toBe(true);
    expect(CALCULATOR_FILTER_BANKS).not.toContain(slug);
    expect(formulaListFor(slug)?.url).toBe("https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf#page=58");
    expect(formulaListFor(slug, 2023)).toEqual(formulaListFor(slug));
    expect(formulaListFor(slug, 2021)).toMatchObject({ label: "Data and formulae (2020–21)", url: expect.stringContaining("9702_y21_sy.pdf#page=68") });
  });
});

describe("A Level Physics 9702 storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 6,056 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.assets).toHaveLength(6056);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith("a-level-physics-9702/releases/full2627-v1-625c919f2ca5/") && asset.contentType === "image/webp")).toBe(true);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 6056, mismatches: 0, localSha256ReHashed: 6056, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(2627);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
