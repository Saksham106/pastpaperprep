import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/a-level-chemistry-9701.json";
import taxonomyJson from "@/data/a-level-chemistry-9701-taxonomy.json";
import privateIndex from "@/data/private-index/a-level-chemistry-9701.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/a-level-chemistry-9701.manifest.json";
import dryRun from "../../data/storage/a-level-chemistry-9701.dry-run.json";
import receipt from "../../data/storage/a-level-chemistry-9701.receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { A_LEVEL_CHEMISTRY_9701, CHEMISTRY_9701_EARLIER_TOPICS, CHEMISTRY_9701_TOPICS } from "@/lib/a-level-9701";
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
import { publishedBankSources } from "../../scripts/generate-bank-index.mjs";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import removedPartMarksFile from "@/data/reviewed-science-removed-part-marks.json";
import { toPublicQuestionMetadata } from "@/lib/question-index";
import { generatePaper } from "@/lib/paper-builder";
import { pdfCoverSummary } from "@/lib/pdf-labels";

const ROOT = process.cwd();
const slug = A_LEVEL_CHEMISTRY_9701;
const product = "bank_a_level_chemistry_9701";
const CANDIDATE = "1c9b6408fce87d5ccdbdf15e3f141ca70b58b70b1093b54bf22e130a64a7c9e4";
const PREFIX = "a-level-chemistry-9701/releases/full2220-v1-1c9b6408fce8";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
type RuntimeQuestion = { id: string; paperId: string; number: number; paper: number; year: number; session: string; examStatus: string; format: string; component: string; marks: number; maxMarks: number; aliasIds: string[]; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; removedParts?: string[]; sharedStimulusImages?: string[]; answer?: string; answerProvenance?: { status: string; questionId: string; keyReads: { markSchemeText: string; renderedView: string } }; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; assetVerification: string; heldQuestionIds: string[]; paperFacts: Record<string, { durationMinutes: number; durationMinutesByEra?: Record<string, number>; totalMarks: number }>; questions: RuntimeQuestion[]; runtimeArtifact: { originalCandidateRuntimeSha256: string; runtimeSha256: string } };
const taxonomy = taxonomyJson as { topics: Array<{ id: string; label: string; earlierSyllabus: boolean; questions: number }> };
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

describe("A Level Chemistry 9701 catalog entry", () => {
  it("is a launched, gated, paid Cambridge A Level bank with no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Chemistry", title: "Chemistry 9701", syllabusCode: "9701", questionCount: 2220, paperCount: 123, years: "2020-2026", productId: product, release: "gated", delivery: "hosted" });
    expect("pendingStorage" in entry).toBe(false);
    // Subject-named pair bundles are IB-only: A Level Chemistry never inherits bundle_ib_chemistry.
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
  });

  it("rides the shared release lane, finalized against a verified readback, and is served (switched on 2026-11-19)", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(RELEASE_BANKS[slug]).toEqual({ prefix: PREFIX, sourceRootEnv: "PASTPAPERPREP_A_LEVEL_CHEMISTRY_SOURCE_ROOT", candidateSeal: "blanked-v1", originalCandidateRuntimeSha256: CANDIDATE });
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(getIGCSERuntimeArtifact(slug, PRODUCTION).questions).toHaveLength(2220);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(true);
    expect(getCatalogBanksForDisplay({ NODE_ENV: "production" }).some((entry) => entry.slug === slug)).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((entry) => entry.slug === slug)).toBe(true);
    expect(getBank(slug, PRODUCTION)?.qualification).toBe("Cambridge A Level");
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(true);
    // No longer staged: never read through the pending-storage preview path.
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(false);
    expect(isPendingStoragePreview(slug, { ...PRODUCTION, PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" })).toBe(false);
  });

  it("is no longer held: production publishes its static index and manifest entry, like 9709", () => {
    expect(HELD_BANKS).not.toContain(slug);
    expect(publishedBankSources({ NODE_ENV: "production" }).some(({ bank }) => bank === slug)).toBe(true);
    expect(PUBLIC_BANK_INDEX_FILES[slug as keyof typeof PUBLIC_BANK_INDEX_FILES]).toMatch(/^a-level-chemistry-9701\.v1-[a-f0-9]{12}\.json$/);
  });
});

describe("A Level Chemistry 9701 billing", () => {
  it("sells as a single bank at the shared single-bank price and joins Build Your Plan", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toMatchObject({ priceId: "price_single_monthly" });
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, { NODE_ENV: "production" })).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleAnnualPriceId, stripeConfig, "annual")).toBe(true);
    expect(getCustomBundlePlan("monthly", [slug, "a-level-maths-9709"], stripeConfig, PRODUCTION)).toMatchObject({ productId: "bundle_custom", quantity: 2 });
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by a pair bundle", () => {
    for (const ok of [entitlement(product), entitlement("bundle_all"), entitlement("lifetime_all_access"), entitlement("bundle_custom", [slug, "igcse"])]) expect(hasBankAccess(slug, ok)).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_chemistry", "bank_a_level_physics_9702", "bank_igcse_chemistry_0620", "bank_ib_chemistry_hl"]) expect(hasBankAccess(slug, entitlement(other))).toBe(false);
  });

  it("registers the product in an unapplied migration copied from Physics 9702's billing definitions, with no Stripe id", () => {
    const name = "20261118000000_a_level_chemistry_9701_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    expect(new Set(migrations.map((file) => file.slice(0, 14))).size).toBe(migrations.length);
    expect(migrations.at(-1)).toBe(name);
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration.match(/'bank_a_level_chemistry_9701'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-chemistry-9701'/g)?.length).toBe(3);
    // Every earlier bank is carried forward in each list it redefines.
    for (const id of ["bank_a_level_physics_9702", "bank_a_level_maths_9709", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(6);
    for (const id of ["a-level-physics-9702", "a-level-maths-9709"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
  });

  it("has a named exemption from the full-explanation article claim", () => {
    expect(PARTIAL_EXPLANATION_BANKS[slug]).toMatch(/2026-11-17/);
  });
});

describe("A Level Chemistry 9701 runtime", () => {
  it("ships 2,220 questions from 123 canonical papers: 1,720 multiple choice, 201 Paper 2, 299 Paper 4", () => {
    expect(runtime.questionCount).toBe(2220);
    expect(runtime.paperCount).toBe(123);
    expect(new Set(runtime.questions.map((question) => question.paperId)).size).toBe(123);
    const count = (paper: number) => runtime.questions.filter((question) => question.paper === paper).length;
    expect([count(1), count(2), count(4)]).toEqual([1720, 201, 299]);
    expect(runtime.questions.every((question) => (question.paper === 1) === (question.format === "multiple_choice"))).toBe(true);
    expect(runtime.questions.every((question) => question.maxMarks === { 1: 40, 2: 60, 4: 100 }[question.paper])).toBe(true);
  });

  it("keeps the held question out: 9701-2025-s-42-q5 (the official mark scheme has no 5(c) row)", () => {
    expect(runtime.heldQuestionIds).toEqual(["9701-2025-s-42-q5"]);
    expect(runtime.questions.some((question) => question.id === "9701-2025-s-42-q5")).toBe(false);
    expect(runtime.questions.filter((question) => question.paperId === "9701-2025-s-42").map((question) => question.number)).not.toContain(5);
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
    expect(new Set(log.map((row) => row.key)).size).toBe(5751);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta.assetManifestSha256).toBe(manifestSha256(manifest));
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/a-level-chemistry-9701.receipt.json"), "utf8")).digest("hex"));
  });

  it("records Paper 1 as 60 minutes in 2020-2021 and 75 from 2022", () => {
    expect(runtime.paperFacts["1"]).toMatchObject({ durationMinutes: 75, durationMinutesByEra: { 2019: 60, 2022: 75 }, totalMarks: 40 });
    expect(runtime.paperFacts["2"]).toMatchObject({ durationMinutes: 75, totalMarks: 60 });
    expect(runtime.paperFacts["4"]).toMatchObject({ durationMinutes: 120, totalMarks: 100 });
  });

  it("shows the shared Section B key box above each 2020-2021 Paper 1 item 31-40, and nowhere else", () => {
    const sectionB = runtime.questions.filter((question) => question.paper === 1 && question.year <= 2021 && question.number >= 31);
    expect(sectionB).toHaveLength(120);
    for (const question of sectionB) {
      expect(question.sharedStimulusImages, question.id).toEqual([question.questionImages[0]]);
      expect(question.questionImages.length, question.id).toBeGreaterThanOrEqual(2);
    }
    expect(runtime.questions.filter((question) => question.sharedStimulusImages)).toHaveLength(120);
  });

  it("keeps the w25 Paper 21/22 Q1 rows with Cambridge's withdrawn part listed", () => {
    const withdrawn = runtime.questions.filter((question) => question.removedParts);
    expect(withdrawn.map((question) => [question.id, question.removedParts])).toEqual([["9701-2025-w-21-q1", ["1(c)(iii)"]], ["9701-2025-w-22-q1", ["1(c)(iii)"]]]);
  });

  it("serves the marks students can score for those rows (18 and 8), in the index, the exact-marks builder and the PDF cover", () => {
    // The sealed rows keep the printed totals; the generator-derived overlay carries the mark-scheme value.
    const overlay = (removedPartMarksFile.entries as unknown as Record<string, Record<string, { printedTotal: number; assessableMarks: number; markSchemePages: number[] }>>)[slug];
    expect(Object.fromEntries(Object.entries(overlay).map(([id, entry]) => [id, [entry.printedTotal, entry.assessableMarks, entry.markSchemePages]]))).toEqual({ "9701-2025-w-21-q1": [20, 18, [7, 8]], "9701-2025-w-22-q1": [10, 8, [7]] });
    for (const [id, printed, assessable] of [["9701-2025-w-21-q1", 20, 18], ["9701-2025-w-22-q1", 10, 8]] as const) {
      expect(runtime.questions.find((question) => question.id === id)?.marks).toBe(printed);
      const question = questions.find((candidate) => candidate.id === id)!;
      expect(question.marks).toBe(assessable);
      const metadata = toPublicQuestionMetadata(question);
      expect(metadata.marks).toBe(assessable);
      const pool = [{ ...metadata, subtopics: [...metadata.subtopics] }];
      expect(generatePaper(pool, { mode: "marks", targets: [{ paper: 2, amount: assessable }], seed: 1, bank: slug })).toMatchObject({ totalMarks: assessable, questions: [{ id }] });
      expect(() => generatePaper(pool, { mode: "marks", targets: [{ paper: 2, amount: printed }], seed: 1, bank: slug })).toThrow(/exactly/);
      const summary = pdfCoverSummary([{ ...question, bankSlug: slug }], slug, "both");
      expect(summary.totalMarks).toBe(assessable);
      expect(summary.meta).toContain(`${assessable} marks`);
    }
  });

  it("serves every multiple-choice letter from the official key, read two ways, and none for structured rows", () => {
    const rows = runtimeJson.questions as unknown as Array<Record<string, unknown>>;
    const letters = buildMcqAnswerMap(slug, rows);
    expect(letters.size).toBe(1720);
    for (const question of runtime.questions) {
      expect(isMcqRow(slug, question as unknown as Record<string, unknown>), question.id).toBe(question.format === "multiple_choice");
      if (question.format !== "multiple_choice") { expect(question.answer).toBeUndefined(); continue; }
      expect(question.answerProvenance).toMatchObject({ status: "official", questionId: question.id, keyReads: { markSchemeText: question.answer, renderedView: question.answer } });
      expect(letters.get(question.id)).toEqual({ answers: [question.answer], note: null });
    }
  });

  it("lists topics 1-37 in syllabus order with unique labels and the 9 used earlier-syllabus topics at the end", () => {
    expect(taxonomy.topics.map((topic) => topic.label)).toEqual([...CHEMISTRY_9701_TOPICS, ...CHEMISTRY_9701_EARLIER_TOPICS]);
    expect(new Set(taxonomy.topics.map((topic) => topic.label)).size).toBe(46);
    expect(CHEMISTRY_9701_EARLIER_TOPICS.every((topic) => topic.endsWith("(earlier syllabus)"))).toBe(true);
    // Topic 31 (Halogen compounds, A Level) is only ever a secondary label; every listed topic has questions.
    expect(taxonomy.topics.every((topic) => topic.questions > 0)).toBe(true);
    const all = getTopicOptions(questions);
    expect(all.slice(0, 37)).toEqual(CHEMISTRY_9701_TOPICS);
    expect(all.slice(37)).toEqual(CHEMISTRY_9701_EARLIER_TOPICS);
    expect(all).not.toContain("Other");
    for (const question of runtime.questions) {
      if ([question.primaryTopic, ...question.secondaryTopics].some((topic) => topic.endsWith("(earlier syllabus)"))) expect(question.year, question.id).toBeLessThanOrEqual(2021);
      if (!question.primaryTopic.endsWith("(earlier syllabus)")) expect(question.subtopics, question.id).toHaveLength(1);
    }
  });

  it("gives each in-scope paper its own tab, opening on multiple choice; AS papers carry no A Level primary from 2022", () => {
    expect([1, 2, 4].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["multiple-choice", "as-structured", "a-level-structured"]);
    expect(defaultRouteSelection(slug)).toBe("multiple-choice");
    expect(routeConfigFor(slug)?.options.map((option) => option.label)).toEqual(["Multiple choice", "AS structured", "A Level structured"]);
    expect(routeConfigFor(slug)).toMatchObject({ allLabel: "All papers", remember: true, scopesTopics: true, hidesPaperFilter: true });
    const aLevelTopics = new Set(CHEMISTRY_9701_TOPICS.slice(22));
    expect(runtime.questions.filter((question) => question.paper !== 4 && question.year >= 2022 && aLevelTopics.has(question.primaryTopic)).map((question) => question.id)).toEqual([]);
  });

  it("makes exactly the 619 questions from 2020 and 2021 free and labels the 154 May/June 2020 ones not sat", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    expect(questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(619);
    expect(runtime.questions.filter((question) => question.examStatus === "released_not_sat")).toHaveLength(154);
    for (const question of runtime.questions) expect(isNotSatSeries(slug, question.year, question.session), question.id).toBe(question.examStatus === "released_not_sat");
  });

  it("resolves the 381 alias variants to their canonical questions", () => {
    const map = (aliases.banks as Record<string, Record<string, string>>)[slug];
    expect(Object.keys(map)).toHaveLength(381);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(map)) {
      expect(ids.has(alias)).toBe(false);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("allows a calculator on every paper and links the syllabus Data section of each era instead of the IGCSE Periodic Table", () => {
    for (const paper of [1, 2, 4]) for (const year of [2020, 2026]) expect(calculatorAllowed(slug, { paper, year })).toBe(true);
    expect(CALCULATOR_FILTER_BANKS).not.toContain(slug);
    // The Periodic Table button shows IGCSE masses (Li 7); 9701 prints one decimal place (Li 6.9).
    expect(hasPeriodicTable(slug)).toBe(false);
    expect(formulaListFor(slug)?.url).toBe("https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf#page=80");
    expect(formulaListFor(slug, 2024)).toEqual(formulaListFor(slug));
    expect(formulaListFor(slug, 2020)).toMatchObject({ label: "Data Booklet (2020–21)", url: expect.stringContaining("9701_y21_sy.pdf#page=78") });
    expect(formulaListsForYears(slug, [2020, 2021]).map((list) => list.label)).toEqual(["Data Booklet (2020–21)"]);
    expect(formulaListsForYears(slug, [2023]).map((list) => list.label)).toEqual(["Data section"]);
    expect(formulaListsForYears(slug, [2021, 2024]).map((list) => list.label)).toEqual(["Data section (2022+)", "Data Booklet (2020–21)"]);
  });
});

describe("A Level Chemistry 9701 storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 5,751 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets).toHaveLength(5751);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith(`${PREFIX}/`) && asset.contentType === "image/webp")).toBe(true);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 5751, uniqueKeys: 5751, mismatches: 0, localSha256ReHashed: 5751, sha256MatchesSegmentationRecord: 5751, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(2220);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
