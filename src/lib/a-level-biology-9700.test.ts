import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/a-level-biology-9700.json";
import taxonomyJson from "@/data/a-level-biology-9700-taxonomy.json";
import privateIndex from "@/data/private-index/a-level-biology-9700.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/a-level-biology-9700.manifest.json";
import dryRun from "../../data/storage/a-level-biology-9700.dry-run.json";
import receipt from "../../data/storage/a-level-biology-9700.receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { A_LEVEL_BIOLOGY_9700, BIOLOGY_9700_EARLIER_TOPICS, BIOLOGY_9700_SUBTOPICS, BIOLOGY_9700_TOPICS } from "@/lib/a-level-9700";
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
import removedPartMarks from "@/data/reviewed-science-removed-part-marks.json";

const ROOT = process.cwd();
const slug = A_LEVEL_BIOLOGY_9700;
const product = "bank_a_level_biology_9700";
const CANDIDATE = "71f39318165df84df5e6dac7c60c91ab67a8937632481be975e0cee230992a8d";
const PREFIX = "a-level-biology-9700/releases/full2680-v1-102ff947f0aa";
const EXCLUDED = ["9700-2021-w-13-q7", "9700-2023-w-11-q27", "9700-2023-w-11-q35"];
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
type RuntimeQuestion = { id: string; paperId: string; number: number; paper: number; year: number; session: string; examStatus: string; format: string; component: string; marks: number; maxMarks: number; aliasIds: string[]; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; secondarySubtopics: string[]; classificationProvenance: { primarySubtopic: string | null; furtherSubtopicCodes: string[]; secondaryCodes: string[] }; choiceGroup?: string; removedParts?: string[]; sharedStimulusImages?: string[]; accessibleText: string; answer?: string; answerProvenance?: { status: string; questionId: string; keyReads: { markSchemeText: string; renderedView: string } }; questionImages: string[]; markschemeImages: string[] };
const runtime = runtimeJson as unknown as { questionCount: number; paperCount: number; years: string; assetVerification: string; heldQuestionIds: string[]; excludedQuestionIds: string[]; paperFacts: Record<string, { durationMinutes: number; durationMinutesByEra?: Record<string, number>; totalMarks: number }>; questions: RuntimeQuestion[]; runtimeArtifact: { originalCandidateRuntimeSha256: string; runtimeSha256: string } };
const taxonomy = taxonomyJson as { topics: Array<{ id: string; label: string; earlierSyllabus: boolean; questions: number }> };
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

describe("A Level Biology 9700 catalog entry", () => {
  it("is a launched, gated, paid Cambridge A Level bank with no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Biology", title: "Biology 9700", syllabusCode: "9700", questionCount: 2680, paperCount: 141, years: "2020-2026", productId: product, release: "gated", delivery: "hosted" });
    expect("pendingStorage" in entry).toBe(false);
    // Subject-named pair bundles are IB-only: A Level Biology never inherits bundle_ib_biology.
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
    expect(BOARD_SUBJECT_ORDER["a-level"]).toEqual(["Mathematics", "Chemistry", "Physics", "Biology"]);
  });

  it("rides the shared release lane, finalized against a verified readback, and is served", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(RELEASE_BANKS[slug]).toEqual({ prefix: PREFIX, sourceRootEnv: "PASTPAPERPREP_A_LEVEL_BIOLOGY_SOURCE_ROOT", candidateSeal: "blanked-v1", originalCandidateRuntimeSha256: CANDIDATE });
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(getIGCSERuntimeArtifact(slug, PRODUCTION).questions).toHaveLength(2680);
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(true);
    expect(getCatalogBanksForDisplay({ NODE_ENV: "production" }).some((entry) => entry.slug === slug)).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((entry) => entry.slug === slug)).toBe(true);
    expect(getBank(slug, PRODUCTION)?.qualification).toBe("Cambridge A Level");
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(true);
    // No longer staged: never read through the pending-storage preview path.
    expect(isPendingStoragePreview(slug, PREVIEW)).toBe(false);
  });

  it("is no longer held: production publishes its static index and manifest entry, like 9701 and 9702", () => {
    expect(HELD_BANKS).not.toContain(slug);
    expect(publishedBankSources({ NODE_ENV: "production" }).some(({ bank }) => bank === slug)).toBe(true);
    expect(PUBLIC_BANK_INDEX_FILES[slug as keyof typeof PUBLIC_BANK_INDEX_FILES]).toMatch(/^a-level-biology-9700\.v1-[a-f0-9]{12}\.json$/);
  });
});

describe("A Level Biology 9700 billing", () => {
  it("sells as a single bank at the shared single-bank price and joins Build Your Plan", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toMatchObject({ priceId: "price_single_monthly" });
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, { NODE_ENV: "production" })).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleAnnualPriceId, stripeConfig, "annual")).toBe(true);
    expect(getCustomBundlePlan("monthly", [slug, "a-level-chemistry-9701"], stripeConfig, PRODUCTION)).toMatchObject({ productId: "bundle_custom", quantity: 2 });
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by a pair bundle", () => {
    for (const ok of [entitlement(product), entitlement("bundle_all"), entitlement("lifetime_all_access"), entitlement("bundle_custom", [slug, "igcse"])]) expect(hasBankAccess(slug, ok)).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_biology", "bank_a_level_chemistry_9701", "bank_igcse_biology_0610", "bank_ib_biology_hl"]) expect(hasBankAccess(slug, entitlement(other))).toBe(false);
  });

  it("registers the product in an unapplied migration copied from Chemistry 9701's billing definitions, with no Stripe id", () => {
    const name = "20261119000000_a_level_biology_9700_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    expect(new Set(migrations.map((file) => file.slice(0, 14))).size).toBe(migrations.length);
    expect(migrations.at(-1)).toBe(name);
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration.match(/'bank_a_level_biology_9700'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-biology-9700'/g)?.length).toBe(3);
    // Every earlier bank is carried forward in each list it redefines.
    for (const id of ["bank_a_level_chemistry_9701", "bank_a_level_physics_9702", "bank_a_level_maths_9709", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(6);
    for (const id of ["a-level-chemistry-9701", "a-level-physics-9702", "a-level-maths-9709"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    // Apart from the new product and slug, it is the 9701 migration's body verbatim.
    const body = (sql: string) => sql.slice(sql.indexOf("alter table public.products drop constraint"));
    const chemistry = readFileSync(join(ROOT, "supabase/migrations/20261118000000_a_level_chemistry_9701_release.sql"), "utf8");
    expect(body(migration).replaceAll(",'bank_a_level_biology_9700'", "").replaceAll(",'a-level-biology-9700'", "").replaceAll("('bank_a_level_biology_9700', 'A Level Biology 9700', true)", "('bank_a_level_chemistry_9701', 'A Level Chemistry 9701', true)").replaceAll("(values ('bank_a_level_biology_9700'))", "(values ('bank_a_level_chemistry_9701'))")).toBe(body(chemistry));
  });

  it("has a named exemption from the full-explanation article claim", () => {
    expect(PARTIAL_EXPLANATION_BANKS[slug]).toMatch(/2026-11-17/);
  });
});

describe("A Level Biology 9700 runtime", () => {
  it("ships 2,680 questions from 141 canonical papers: 1,957 multiple choice, 294 Paper 2, 429 Paper 4", () => {
    expect(runtime.questionCount).toBe(2680);
    expect(runtime.paperCount).toBe(141);
    expect(new Set(runtime.questions.map((question) => question.paperId)).size).toBe(141);
    const count = (paper: number) => runtime.questions.filter((question) => question.paper === paper).length;
    expect([count(1), count(2), count(4)]).toEqual([1957, 294, 429]);
    expect(runtime.questions.every((question) => (question.paper === 1) === (question.format === "multiple_choice"))).toBe(true);
    expect(runtime.questions.every((question) => question.maxMarks === { 1: 40, 2: 60, 4: 100 }[question.paper])).toBe(true);
  });

  it("keeps the held question out: 9700-2025-s-44-q2 (Fig. 2.1 removed for copyright, and part (b) needs it)", () => {
    expect(runtime.heldQuestionIds).toEqual(["9700-2025-s-44-q2"]);
    expect(runtime.questions.some((question) => question.id === "9700-2025-s-44-q2")).toBe(false);
    expect(runtime.questions.filter((question) => question.paperId === "9700-2025-s-44").map((question) => question.number)).not.toContain(2);
  });

  it("excludes the 3 multiple-choice items Cambridge discounted, which have no key", () => {
    expect(runtime.excludedQuestionIds).toEqual(EXCLUDED);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const id of EXCLUDED) expect(ids.has(id), id).toBe(false);
    expect(runtime.questions.filter((question) => question.paperId === "9700-2023-w-11")).toHaveLength(38);
    expect(runtime.questions.filter((question) => question.paperId === "9700-2021-w-13")).toHaveLength(39);
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
    expect(new Set(log.map((row) => row.key)).size).toBe(6994);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta.assetManifestSha256).toBe(manifestSha256(manifest));
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/a-level-biology-9700.receipt.json"), "utf8")).digest("hex"));
  });

  it("records Paper 1 as 60 minutes in 2020-2021 and 75 from 2022", () => {
    expect(runtime.paperFacts["1"]).toMatchObject({ durationMinutes: 75, durationMinutesByEra: { 2019: 60, 2022: 75 }, totalMarks: 40 });
    expect(runtime.paperFacts["2"]).toMatchObject({ durationMinutes: 75, totalMarks: 60 });
    expect(runtime.paperFacts["4"]).toMatchObject({ durationMinutes: 120, totalMarks: 100 });
  });

  it("marks the 2020-2021 Paper 4 Section B essays (Q9 or Q10, one answered) as one choice group, and nothing else", () => {
    const choice = runtime.questions.filter((question) => question.choiceGroup);
    expect(choice).toHaveLength(24);
    for (const question of choice) {
      expect(question, question.id).toMatchObject({ choiceGroup: "section_b_answer_one", paper: 4, marks: 15 });
      expect(question.year, question.id).toBeLessThanOrEqual(2021);
      expect([9, 10], question.id).toContain(question.number);
    }
    // Each 2020-2021 Paper 4 has exactly one pair.
    const papers = [...new Set(choice.map((question) => question.paperId))];
    expect(papers).toHaveLength(12);
    for (const paperId of papers) expect(choice.filter((question) => question.paperId === paperId).map((question) => question.number).sort((a, b) => a - b), paperId).toEqual([9, 10]);
  });

  it("has no withdrawn parts and no shared-stimulus crops, so no scoreable-marks entries", () => {
    expect(runtime.questions.filter((question) => question.removedParts || question.sharedStimulusImages)).toEqual([]);
    expect(Object.keys(removedPartMarks.entries)).not.toContain(slug);
  });

  it("serves the transcripts with the source's 5 α/β corrections applied", () => {
    const byId = new Map(runtime.questions.map((question) => [question.id, question.accessibleText]));
    expect(byId.get("9700-2021-s-12-q7")).toContain("C α-glucose");
    expect(byId.get("9700-2025-w-13-q11")).toContain("α-1,4 glycosidic bonds | α-1,6 glycosidic bonds");
    for (const id of ["9700-2021-s-12-q11", "9700-2021-s-12-q7", "9700-2025-w-13-q10", "9700-2025-w-13-q11", "9700-2025-w-13-q9"]) {
      expect(byId.get(id), id).not.toMatch(/(^|[\s(])[ab]-(glucose|1,4|1,6|helix|helices|chains?|subunits?|globin|pleated|amylase|fructose|galactose)/);
    }
  });

  it("serves every multiple-choice letter from the official key, read two ways, and none for structured rows", () => {
    const rows = runtimeJson.questions as unknown as Array<Record<string, unknown>>;
    const letters = buildMcqAnswerMap(slug, rows);
    expect(letters.size).toBe(1957);
    for (const question of runtime.questions) {
      expect(isMcqRow(slug, question as unknown as Record<string, unknown>), question.id).toBe(question.format === "multiple_choice");
      if (question.format !== "multiple_choice") { expect(question.answer).toBeUndefined(); continue; }
      expect(question.answerProvenance).toMatchObject({ status: "official", questionId: question.id, keyReads: { markSchemeText: question.answer, renderedView: question.answer } });
      expect(letters.get(question.id)).toEqual({ answers: [question.answer], note: null });
    }
  });

  it("lists topics 1-19 in syllabus order and the 8 used earlier-syllabus topics at the end", () => {
    expect(taxonomy.topics.map((topic) => topic.label)).toEqual([...BIOLOGY_9700_TOPICS, ...BIOLOGY_9700_EARLIER_TOPICS]);
    expect(new Set(taxonomy.topics.map((topic) => topic.label)).size).toBe(27);
    expect(BIOLOGY_9700_EARLIER_TOPICS.every((topic) => topic.endsWith("(earlier syllabus)"))).toBe(true);
    expect(taxonomy.topics.every((topic) => topic.questions > 0)).toBe(true);
    const all = getTopicOptions(questions);
    expect(all.slice(0, 19)).toEqual(BIOLOGY_9700_TOPICS);
    expect(all.slice(19)).toEqual(BIOLOGY_9700_EARLIER_TOPICS);
    expect(all).not.toContain("Other");
    for (const question of runtime.questions) {
      if ([question.primaryTopic, ...question.secondaryTopics].some((topic) => topic.endsWith("(earlier syllabus)"))) expect(question.year, question.id).toBeLessThanOrEqual(2021);
      // The primary subtopic first, then the reviewed further sections (secondarySubtopics).
      const primaryCount = question.primaryTopic.endsWith("(earlier syllabus)") ? 0 : 1;
      expect(question.subtopics.slice(primaryCount), question.id).toEqual(question.secondarySubtopics);
    }
  });

  it("gives each in-scope paper its own tab, opening on multiple choice; AS papers carry no A Level primary from 2022", () => {
    expect([1, 2, 4].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["multiple-choice", "as-structured", "a-level-structured"]);
    expect(defaultRouteSelection(slug)).toBe("multiple-choice");
    expect(routeConfigFor(slug)?.options.map((option) => option.label)).toEqual(["Multiple choice", "AS structured", "A Level structured"]);
    expect(routeConfigFor(slug)).toMatchObject({ allLabel: "All papers", remember: true, scopesTopics: true, hidesPaperFilter: true });
    const aLevelTopics = new Set(BIOLOGY_9700_TOPICS.slice(11));
    expect(runtime.questions.filter((question) => question.paper !== 4 && question.year >= 2022 && aLevelTopics.has(question.primaryTopic)).map((question) => question.id)).toEqual([]);
  });

  it("makes exactly the 763 questions from 2020 and 2021 free and labels the 168 May/June 2020 ones not sat", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    expect(questions.filter((question) => isPreviewQuestion(slug, question.id))).toHaveLength(763);
    expect(runtime.questions.filter((question) => question.examStatus === "released_not_sat")).toHaveLength(168);
    for (const question of runtime.questions) expect(isNotSatSeries(slug, question.year, question.session), question.id).toBe(question.examStatus === "released_not_sat");
  });

  it("resolves the 60 alias variants to their canonical questions", () => {
    const map = (aliases.banks as Record<string, Record<string, string>>)[slug];
    expect(Object.keys(map)).toHaveLength(60);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(map)) {
      expect(ids.has(alias)).toBe(false);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
    }
  });

  it("allows a calculator on every paper and shows no reference sheet: 9700 prints each formula inside its question", () => {
    for (const paper of [1, 2, 4]) for (const year of [2020, 2026]) expect(calculatorAllowed(slug, { paper, year })).toBe(true);
    expect(CALCULATOR_FILTER_BANKS).not.toContain(slug);
    expect(hasPeriodicTable(slug)).toBe(false);
    expect(formulaListFor(slug)).toBeUndefined();
    expect(formulaListFor(slug, 2020)).toBeUndefined();
    expect(formulaListsForYears(slug, [2021, 2024])).toEqual([]);
  });
});

describe("A Level Biology 9700 subtopic picker", () => {
  it("keeps the section map equal to the bank taxonomy", () => {
    const fromTaxonomy = Object.fromEntries((taxonomyJson as { topics: Array<{ label: string; earlierSyllabus: boolean; subtopics: Array<{ label: string }> }> }).topics.filter((topic) => !topic.earlierSyllabus).map((topic) => [topic.label, topic.subtopics.map((subtopic) => subtopic.label)]));
    expect(BIOLOGY_9700_SUBTOPICS).toEqual(fromTaxonomy);
  });

  for (const [label, rows] of [["normalized", questions], ["hydrated from bank-index metadata", hydrated]] as const) {
    it(`shows each current topic's own sections on every paper tab (${label})`, () => {
      for (const paper of [1, 2, 4]) {
        const tab = rows.filter((question) => question.paper === paper);
        for (const topic of getTopicOptions(tab)) {
          const groups = getSubtopicGroups(tab, [topic], []);
          if (topic.endsWith("(earlier syllabus)")) { expect(groups.relevant, `${paper} ${topic}`).toEqual([]); continue; }
          expect(groups.relevant.length, `${paper} ${topic}`).toBeGreaterThan(0);
          for (const subtopic of groups.relevant) expect(BIOLOGY_9700_SUBTOPICS[topic], `${paper} ${topic}`).toContain(subtopic);
        }
      }
      // AS structured -> Cell membranes and transport lists both of its sections, not behind "Show other subtopics".
      const p2 = rows.filter((question) => question.paper === 2);
      expect(getSubtopicGroups(p2, ["Cell membranes and transport"], []).relevant).toEqual(["Fluid mosaic membranes", "Movement into and out of cells"]);
      // With no topic chosen, every section present is listed in syllabus order.
      const order = Object.values(BIOLOGY_9700_SUBTOPICS).flat();
      const all = getSubtopicGroups(rows, [], []).all;
      expect(all).toEqual(order.filter((subtopic) => all.includes(subtopic)));
    });
  }
});

describe("A Level Biology 9700 secondary sections (owner review of #499)", () => {
  const sectionTopic = new Map(Object.entries(BIOLOGY_9700_SUBTOPICS).flatMap(([topic, sections]) => sections.map((section) => [section, topic] as const)));

  it("gives every current secondary topic at least one reviewed section, and only sections of the question's own topics", () => {
    let pairs = 0;
    for (const question of runtime.questions) {
      const topics = new Set([question.primaryTopic, ...question.secondaryTopics]);
      for (const section of question.secondarySubtopics) expect(topics.has(sectionTopic.get(section)!), `${question.id} ${section}`).toBe(true);
      expect(new Set(question.subtopics).size, question.id).toBe(question.subtopics.length);
      for (const topic of question.secondaryTopics) {
        if (topic.endsWith("(earlier syllabus)")) continue;
        pairs += 1;
        expect(question.secondarySubtopics.some((section) => sectionTopic.get(section) === topic), `${question.id} ${topic}`).toBe(true);
      }
    }
    expect(pairs).toBe(501);
    expect(runtime.questions.filter((question) => question.secondarySubtopics.length)).toHaveLength(500);
    expect((runtimeJson.runtimeArtifact as unknown as { sourceSha256: Record<string, string> }).sourceSha256.secondarySubtopics).toBe("2057e9bf6273a7f536befc296f7ca798de15cbfbf49906b786356aabb86f0cda");
  });

  for (const [label, rows] of [["normalized", questions], ["hydrated from bank-index metadata", hydrated]] as const) {
    it(`finds 9700-2025-s-22-q1 under Movement into and out of cells, which its (d)(ii) assesses for 4 marks (${label})`, () => {
      const p2 = rows.filter((question) => question.paper === 2);
      const ids = (filters: Parameters<typeof filterQuestions>[1]) => filterQuestions(p2, filters).map((question) => question.id);
      expect(ids({ topics: ["Cell membranes and transport"], subtopics: ["Movement into and out of cells"] })).toContain("9700-2025-s-22-q1");
      expect(ids({ subtopics: ["Movement into and out of cells"] })).toContain("9700-2025-s-22-q1");
      expect(ids({ subtopics: ["Transport mechanisms"] })).toContain("9700-2025-s-22-q1");
      // Its primary section still finds it, and an unassessed section of a secondary topic does not.
      expect(ids({ subtopics: ["Cells as the basic units of living organisms"] })).toContain("9700-2025-s-22-q1");
      expect(ids({ subtopics: ["Fluid mosaic membranes"] })).not.toContain("9700-2025-s-22-q1");
      // Main-topic-only still hides it under a topic it only partly covers.
      expect(ids({ topics: ["Cell membranes and transport"], subtopics: ["Movement into and out of cells"], mainTopicOnly: true })).not.toContain("9700-2025-s-22-q1");
    });
  }
});

describe("A Level Biology 9700 storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 6,994 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets).toHaveLength(6994);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith(`${PREFIX}/`) && asset.contentType === "image/webp")).toBe(true);
    // Neither the held question's crops nor the discounted items' are planned.
    for (const id of ["9700-2025-s-44", "9700-2021-w-13", "9700-2023-w-11"]) expect(manifest.assets.some((asset) => asset.objectKey.includes(`/${id}/q${{ "9700-2025-s-44": 2, "9700-2021-w-13": 7, "9700-2023-w-11": 27 }[id]}-`)), id).toBe(false);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 6994, uniqueKeys: 6994, mismatches: 0, localSha256ReHashed: 6994, sha256MatchesSegmentationRecord: 6994, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(2680);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });
});
