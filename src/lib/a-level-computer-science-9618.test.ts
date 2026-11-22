import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtimeJson from "@/data/production/a-level-computer-science-9618.json";
import taxonomyJson from "@/data/a-level-computer-science-9618-taxonomy.json";
import privateIndex from "@/data/private-index/a-level-computer-science-9618.json";
import aliases from "@/data/question-id-aliases.json";
import manifestJson from "../../data/storage/a-level-computer-science-9618.manifest.json";
import dryRun from "../../data/storage/a-level-computer-science-9618.dry-run.json";
import receipt from "../../data/storage/a-level-computer-science-9618.receipt.json";
import freeCopyReceipt from "../../docs/a-level-computer-science-9618-free-copy/receipt.json";
import { assertContentSealedCandidate, blankedCandidateSha256, manifestSha256, RELEASE_BANKS, runtimeSha256 as releaseRuntimeSha256 } from "../../scripts/igcse-release.mjs";
import { A_LEVEL_COMPUTER_SCIENCE_9618, COMPUTER_SCIENCE_9618_PAPERS, COMPUTER_SCIENCE_9618_SUBTOPICS, COMPUTER_SCIENCE_9618_TOPICS } from "@/lib/a-level-9618";
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
const slug = A_LEVEL_COMPUTER_SCIENCE_9618;
const product = "bank_a_level_computer_science_9618";
const CANDIDATE = "a456b8f0af531650a0d6b02fce3f1e5f1c1e13062572ab575d92e0eceba2e4b6";
const PREFIX = "a-level-computer-science-9618/releases/full750-v1-a456b8f0af53";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
type RuntimeQuestion = {
  id: string; paperId: string; number: number; paper: number; year: number; era: string; session: string; examStatus: string; format: string; component: string;
  marks: number; maxMarks: number; aliasIds: string[]; primaryTopic: string; secondaryTopics: string[]; subtopics: string[]; secondarySubtopics: string[];
  classificationProvenance: { primaryCode: string; secondaryCodes: string[] };
  removedParts?: string[]; sharedStimulusImages?: string[]; accessibleText: string; answer?: string; choiceGroup?: string;
  questionImages: string[]; markschemeImages: string[];
};
const runtime = runtimeJson as unknown as {
  questionCount: number; paperCount: number; years: string; assetVerification: string; publicationStatus: string; heldQuestionIds: string[]; excludedQuestionIds: string[];
  paperFacts: Record<string, { name: string; durationMinutes: number; totalMarks: number }>;
  fullMarksAwardedNotes: Array<{ paperId: string; questionId: string; parts: string[]; decision: string }>;
  questions: RuntimeQuestion[]; runtimeArtifact: { originalCandidateRuntimeSha256: string; runtimeSha256: string };
};
const taxonomy = taxonomyJson as { topics: Array<{ id: string; code: string; label: string; level: string; earlierSyllabus: boolean; questions: number; subtopics: Array<{ label: string }> }> };
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

describe("A Level Computer Science 9618 catalog entry", () => {
  it("is a live, gated, paid Cambridge A Level bank with no pair bundle, listed after Economics", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Computer Science", title: "Computer Science 9618", syllabusCode: "9618", questionCount: 750, paperCount: 85, years: "2021-2026", productId: product, release: "gated", delivery: "hosted" });
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
    expect(BOARD_SUBJECT_ORDER["a-level"]).toEqual(["Mathematics", "Further Mathematics", "Chemistry", "Physics", "Biology", "Economics", "Computer Science"]);
  });

  it("rides the shared release lane, finalized against a verified readback and live", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(true);
    expect(RELEASE_BANKS[slug]).toEqual({ prefix: PREFIX, sourceRootEnv: "PASTPAPERPREP_A_LEVEL_COMPUTER_SCIENCE_SOURCE_ROOT", candidateSeal: "blanked-v1", originalCandidateRuntimeSha256: CANDIDATE });
    expect(PRIVATE_RUNTIME_OBJECT_PREFIXES[slug]).toBe(`${PREFIX}/`);
    expect(inferredPdfDpiForBank(slug)).toBe(108);
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(getIGCSERuntimeArtifact(slug, PRODUCTION).questions).toHaveLength(750);
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
    expect(PUBLIC_BANK_INDEX_FILES[slug as keyof typeof PUBLIC_BANK_INDEX_FILES]).toMatch(/^a-level-computer-science-9618\.v1-[a-f0-9]{12}\.json$/);
  });

  it("has a course guide from the 2026 syllabus: three 75-mark papers, Paper 4 (practical) not in the bank", () => {
    const guide = assessmentGuideFor(getCatalogBank(slug)!);
    expect(guide.version).toBe("2026 syllabus");
    expect(guide.papers.map((paper) => [paper.name, paper.duration, paper.marks, paper.weighting])).toEqual([
      ["Paper 1", "1 hr 30 min", "75", "50% of AS, 25% of A Level"],
      ["Paper 2", "2 hr", "75", "50% of AS, 25% of A Level"],
      ["Paper 3", "1 hr 30 min", "75", "25% of A Level"],
    ]);
    expect(guide.caveat).toMatch(/Paper 4 \(practical/);
  });
});

describe("A Level Computer Science 9618 billing", () => {
  it("sells as a single bank at the shared single-bank price and joins Build Your Plan once displayed", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PREVIEW)).toMatchObject({ priceId: "price_single_monthly" });
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toMatchObject({ priceId: "price_single_monthly" });
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, { NODE_ENV: "production" })).toThrow("Bank is not available for checkout");
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleAnnualPriceId, stripeConfig, "annual")).toBe(true);
    expect(getCustomBundlePlan("monthly", [slug, "a-level-maths-9709"], stripeConfig, PREVIEW)).toMatchObject({ productId: "bundle_custom", quantity: 2 });
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by another Computer Science bank", () => {
    for (const ok of [entitlement(product), entitlement("bundle_all"), entitlement("lifetime_all_access"), entitlement("bundle_custom", [slug, "igcse"])]) expect(hasBankAccess(slug, ok)).toBe(true);
    for (const other of ["bundle_igcse", "bank_igcse_computer_science_0478", "bank_ib_computer_science_hl", "bank_ib_computer_science_sl", "bank_a_level_economics_9708"]) expect(hasBankAccess(slug, entitlement(other))).toBe(false);
  });

  it("registers the product in an unapplied migration copied from Economics 9708's billing definitions, with no Stripe id", () => {
    const name = "20261121000000_a_level_computer_science_9618_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    expect(new Set(migrations.map((file) => file.slice(0, 14))).size).toBe(migrations.length);
    // A later bank release may redefine these objects only by carrying 9618 forward in every list.
    for (const later of migrations.filter((file) => file > name)) {
      const body = readFileSync(join(ROOT, "supabase/migrations", later), "utf8");
      if (!/products_known_id|function public\.confirm_billing_checkout/.test(body)) continue;
      expect(body.match(/'bank_a_level_computer_science_9618'/g)?.length, `${later} drops bank_a_level_computer_science_9618`).toBe(6);
      expect(body.match(/'a-level-computer-science-9618'/g)?.length, `${later} drops a-level-computer-science-9618`).toBe(3);
    }
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration.match(/'bank_a_level_computer_science_9618'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-computer-science-9618'/g)?.length).toBe(3);
    // Every earlier bank is carried forward in each list it redefines.
    for (const id of ["bank_a_level_economics_9708", "bank_a_level_biology_9700", "bank_a_level_chemistry_9701", "bank_a_level_physics_9702", "bank_a_level_maths_9709", "bank_igcse_computer_science_0478", "bank_ib_computer_science_sl"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(6);
    for (const id of ["a-level-economics-9708", "a-level-biology-9700", "a-level-chemistry-9701", "a-level-physics-9702", "a-level-maths-9709"]) expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    // Apart from the new product and slug, it is the 9708 migration's body verbatim.
    const body = (sql: string) => sql.slice(sql.indexOf("alter table public.products drop constraint"));
    const economics = readFileSync(join(ROOT, "supabase/migrations/20261120000000_a_level_economics_9708_release.sql"), "utf8");
    expect(body(migration).replaceAll(",'bank_a_level_computer_science_9618'", "").replaceAll(",'a-level-computer-science-9618'", "").replaceAll("('bank_a_level_computer_science_9618', 'A Level Computer Science 9618', true)", "('bank_a_level_economics_9708', 'A Level Economics 9708', true)").replaceAll("(values ('bank_a_level_computer_science_9618'))", "(values ('bank_a_level_economics_9708'))")).toBe(body(economics));
  });

  it("has a named exemption from the full-explanation article claim", () => {
    expect(PARTIAL_EXPLANATION_BANKS[slug]).toMatch(/2026-11-17/);
  });
});

describe("A Level Computer Science 9618 runtime", () => {
  it("ships 750 structured questions from 85 canonical papers: P1 254, P2 238, P3 258", () => {
    expect(runtime.questionCount).toBe(750);
    expect(runtime.paperCount).toBe(85);
    expect(new Set(runtime.questions.map((question) => question.paperId)).size).toBe(85);
    const count = (paper: number) => runtime.questions.filter((question) => question.paper === paper).length;
    expect([count(1), count(2), count(3)]).toEqual([254, 238, 258]);
    expect(runtime.questions.every((question) => question.format === "structured" && question.answer === undefined && question.choiceGroup === undefined)).toBe(true);
    expect(runtime.years).toBe("2021-2026");
    // June and November only: Cambridge sets no March series for 9618.
    expect(new Set(runtime.questions.map((question) => question.session))).toEqual(new Set(["June", "November"]));
  });

  it("serves the syllabus totals and timings: every paper is 75 marks", () => {
    expect(runtime.paperFacts).toEqual({
      1: { name: "Theory Fundamentals", durationMinutes: 90, totalMarks: 75 },
      2: { name: "Fundamental Problem-solving and Programming Skills", durationMinutes: 120, totalMarks: 75 },
      3: { name: "Advanced Theory", durationMinutes: 90, totalMarks: 75 },
    });
    for (const question of runtime.questions) expect(question.maxMarks, question.id).toBe(75);
    // Each canonical paper's questions add up to its printed 75.
    const totals = new Map<string, number>();
    for (const question of runtime.questions) totals.set(question.paperId, (totals.get(question.paperId) ?? 0) + question.marks);
    for (const [paperId, total] of totals) expect(total, paperId).toBe(75);
    expect(COMPUTER_SCIENCE_9618_PAPERS.map((paper) => [paper.paper, paper.name, paper.marks])).toEqual(Object.entries(runtime.paperFacts).map(([paper, facts]) => [Number(paper), facts.name, facts.totalMarks]));
  });

  it("holds and excludes nothing, and serves both 'all candidates were awarded full marks' questions at their printed marks", () => {
    expect(runtime.heldQuestionIds).toEqual([]);
    expect(runtime.excludedQuestionIds).toEqual([]);
    expect(runtime.fullMarksAwardedNotes).toEqual([
      { paperId: "9618-2025-s-22", questionId: "9618-2025-s-22-q1", parts: ["1(a)(ii)", "1(b)(ii)"], decision: "served_at_printed_marks" },
      { paperId: "9618-2026-s-32", questionId: "9618-2026-s-32-q10", parts: ["10(a)"], decision: "served_at_printed_marks" },
    ]);
    const marks = (id: string) => runtime.questions.find((question) => question.id === id)?.marks;
    expect([marks("9618-2025-s-22-q1"), marks("9618-2026-s-32-q10")]).toEqual([14, 9]);
    // The one MS with a blank Marks cell: the QP's printed brackets are served.
    expect(marks("9618-2025-s-12-q7")).toBe(8);
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
    expect(log).toHaveLength(2397);
    expect(new Set(log.map((row) => row.key)).size).toBe(2397);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
    const meta = runtimeJson.runtimeArtifact as unknown as Record<string, string>;
    expect(meta.assetManifestSha256).toBe(manifestSha256(manifest));
    expect(meta.storageReceiptSha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "data/storage/a-level-computer-science-9618.receipt.json"), "utf8")).digest("hex"));
  });

  it("has exactly its 2021-2022 crops in the free bucket: the 706 files listFreePublicAssets returns once served", () => {
    // The asset manifest production builds once the bank is switched on (private asset mode).
    const served = normalizeBankQuestions(slug, runtimeJson.questions as unknown as Array<Record<string, unknown>>, { economicsAssetMode: "private", applyReviewedBlankPages: true });
    const free = listFreePublicAssets(slug, new Map(Object.entries(buildBankAssetManifest(served))) as never);
    expect(new Set(free.map((asset) => asset.questionId)).size).toBe(218);
    const rows = (file: string) => readFileSync(join(ROOT, "docs/a-level-computer-science-9618-free-copy", file), "utf8");
    expect(createHash("sha256").update(rows("copy-log.jsonl")).digest("hex")).toBe(freeCopyReceipt.copyLogSha256);
    expect(createHash("sha256").update(rows("verify-log.jsonl")).digest("hex")).toBe(freeCopyReceipt.verifyLogSha256);
    const verified = rows("verify-log.jsonl").split("\n").filter(Boolean).map((line) => JSON.parse(line) as { path: string; ok: boolean; sha256: string; bytes: number });
    expect(verified.map((row) => row.path).sort()).toEqual(free.map((asset) => asset.path).sort());
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
    for (const row of verified) expect(row.ok && byKey.get(row.path)?.sha256 === row.sha256 && byKey.get(row.path)?.size === row.bytes, row.path).toBe(true);
    expect(freeCopyReceipt).toMatchObject({ verified: 706, total: 706, failed: 0 });
  });

  it("has no withdrawn parts, no shared-stimulus crops and no multiple-choice rows", () => {
    expect(runtime.questions.filter((question) => question.removedParts || question.sharedStimulusImages)).toEqual([]);
    expect(Object.keys(removedPartMarks.entries)).not.toContain(slug);
    const rows = runtimeJson.questions as unknown as Array<Record<string, unknown>>;
    expect(buildMcqAnswerMap(slug, rows).size).toBe(0);
    expect(rows.some((row) => isMcqRow(slug, row))).toBe(false);
  });

  it("lists sections 1-20 in syllabus order with unique labels; each paper uses only its own sections", () => {
    expect(taxonomy.topics.map((topic) => topic.label)).toEqual(COMPUTER_SCIENCE_9618_TOPICS);
    expect(new Set(taxonomy.topics.map((topic) => topic.label)).size).toBe(20);
    expect(taxonomy.topics.map((topic) => topic.level)).toEqual([...Array(12).fill("AS"), ...Array(8).fill("A Level")]);
    expect(taxonomy.topics.every((topic) => topic.questions > 0 && !topic.earlierSyllabus)).toBe(true);
    expect(COMPUTER_SCIENCE_9618_TOPICS[15]).toBe("System Software (A Level)");
    expect(getTopicOptions(questions)).toEqual(COMPUTER_SCIENCE_9618_TOPICS);
    const ranges: Record<number, [number, number]> = { 1: [1, 8], 2: [9, 12], 3: [13, 20] };
    for (const question of runtime.questions) {
      const [low, high] = ranges[question.paper];
      for (const code of [question.classificationProvenance.primaryCode, ...question.classificationProvenance.secondaryCodes]) expect(Number(code) >= low && Number(code) <= high, `${question.id} ${code}`).toBe(true);
    }
    // Every subtopic label names one syllabus subsection ("Algorithms" is 9.2; 19.1 says "(A Level)").
    const sections = Object.values(COMPUTER_SCIENCE_9618_SUBTOPICS).flat();
    expect(new Set(sections).size).toBe(44);
    expect(sections).toContain("Algorithms (A Level)");
  });

  it("gives each paper its own tab, AS before A Level, opening on AS theory", () => {
    expect([1, 2, 3].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["as-theory", "as-problem-solving", "a-level-theory"]);
    expect(defaultRouteSelection(slug)).toBe("as-theory");
    expect(routeConfigFor(slug)?.options.map((option) => option.label)).toEqual(["AS theory", "AS problem-solving", "A Level theory"]);
    expect(routeConfigFor(slug)).toMatchObject({ allLabel: "All papers", allDetail: "Papers 1–3", remember: true, scopesTopics: true, hidesPaperFilter: true });
  });

  it("makes exactly the 218 questions from 2021 and 2022 free; every paper was sat", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    const free = questions.filter((question) => isPreviewQuestion(slug, question.id));
    expect(free).toHaveLength(218);
    expect(free.every((question) => question.year === 2021 || question.year === 2022)).toBe(true);
    for (const question of runtime.questions) {
      expect(question.examStatus, question.id).toBe("sat");
      expect(isNotSatSeries(slug, question.year, question.session), question.id).toBe(false);
    }
  });

  it("resolves the 124 alias variants to their canonical questions", () => {
    const map = (aliases.banks as Record<string, Record<string, string>>)[slug];
    expect(Object.keys(map)).toHaveLength(124);
    const ids = new Set(runtime.questions.map((question) => question.id));
    for (const [alias, canonical] of Object.entries(map)) {
      expect(ids.has(alias)).toBe(false);
      expect(ids.has(canonical)).toBe(true);
      expect(currentQuestionId(slug, alias)).toBe(canonical);
      expect(runtime.questions.find((question) => question.id === canonical)?.aliasIds).toContain(alias);
    }
  });

  it("allows no calculator on any paper and shows no reference sheet", () => {
    for (const paper of [1, 2, 3]) for (const year of [2021, 2026]) expect(calculatorAllowed(slug, { paper, year })).toBe(false);
    expect(calculatorBadgeText(calculatorAllowed(slug, { paper: 1, year: 2024 }))).toBe("NO CALCULATOR");
    expect(CALCULATOR_FILTER_BANKS).not.toContain(slug);
    expect(hasPeriodicTable(slug)).toBe(false);
    expect(formulaListFor(slug)).toBeUndefined();
    expect(formulaListsForYears(slug, [2021, 2024])).toEqual([]);
  });
});

describe("A Level Computer Science 9618 subtopic picker", () => {
  it("keeps the section map equal to the bank taxonomy", () => {
    const fromTaxonomy = Object.fromEntries(taxonomy.topics.map((topic) => [topic.label, topic.subtopics.map((subtopic) => subtopic.label)]));
    expect(COMPUTER_SCIENCE_9618_SUBTOPICS).toEqual(fromTaxonomy);
  });

  for (const [label, rows] of [["normalized", questions], ["hydrated from bank-index metadata", hydrated]] as const) {
    it(`shows each topic's own subsections on every paper tab (${label})`, () => {
      for (const paper of [1, 2, 3]) {
        const tab = rows.filter((question) => question.paper === paper);
        const topics = getTopicOptions(tab);
        expect(topics.length, `${paper}`).toBeGreaterThan(0);
        for (const topic of topics) {
          const groups = getSubtopicGroups(tab, [topic], []);
          expect(groups.relevant.length, `${paper} ${topic}`).toBeGreaterThan(0);
          for (const subtopic of groups.relevant) expect(COMPUTER_SCIENCE_9618_SUBTOPICS[topic], `${paper} ${topic}`).toContain(subtopic);
          // Every subsection a question in this tab is labelled with under this primary topic is listed.
          const own = new Set(tab.filter((question) => question.primaryTopic === topic).flatMap((question) => question.subtopics).filter((subtopic) => COMPUTER_SCIENCE_9618_SUBTOPICS[topic].includes(subtopic)));
          for (const subtopic of own) expect(groups.relevant, `${paper} ${topic}`).toContain(subtopic);
        }
      }
      // With no topic chosen, every subsection present is listed in syllabus order.
      const order = Object.values(COMPUTER_SCIENCE_9618_SUBTOPICS).flat();
      const all = getSubtopicGroups(rows, [], []).all;
      expect(all).toEqual(order.filter((subtopic) => all.includes(subtopic)));
      expect(all).toHaveLength(44);
      // AS "Algorithms" and A Level "Algorithms (A Level)" never mix.
      const primaries = (subtopic: string) => new Set(filterQuestions(rows, { subtopics: [subtopic] }).map((question) => question.paper));
      expect(primaries("Algorithms")).toEqual(new Set([2]));
      expect(primaries("Algorithms (A Level)")).toEqual(new Set([3]));
    });
  }
});

describe("A Level Computer Science 9618 storage plan", () => {
  it("plans a create-only upload of exactly the runtime's 2,397 crops under a new prefix", () => {
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(refs.size).toBe(2397);
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(manifest.objectPrefix).toBe(`${PREFIX}/`);
    expect(manifest.assets).toHaveLength(2397);
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(manifest.assets.every((asset) => asset.objectKey.startsWith(`${PREFIX}/`) && asset.contentType === "image/webp")).toBe(true);
    expect(dryRun).toMatchObject({ r2Writes: 0, objects: 2397, uniqueKeys: 2397, mismatches: 0, localSha256ReHashed: 2397, sha256MatchesSegmentationRecord: 2397, bytes: manifest.assets.reduce((sum, asset) => sum + asset.size, 0) });
  });

  it("exposes a metadata-only private index", () => {
    expect(privateIndex.questions).toHaveLength(750);
    const serialized = JSON.stringify(privateIndex);
    for (const field of ["accessibleText", "answer", "questionImages", "sourceQuestionUrl"]) expect(serialized).not.toContain(`"${field}"`);
  });

  it("records the generator's pinned source in the runtime", () => {
    const meta = runtimeJson.runtimeArtifact as unknown as { sourceCommit: string; sourceRepository: string };
    expect(meta).toMatchObject({ sourceRepository: "cambridge-a-level-computer-science-9618-topic-practice", sourceCommit: "df9a1d6" });
    expect(existsSync(join(ROOT, "scripts/generate-a-level-computer-science-9618-runtime.mjs"))).toBe(true);
    expect(createHash("sha256").update(readFileSync(join(ROOT, "src/data/a-level-computer-science-9618-taxonomy.json"))).digest("hex")).toBe((runtimeJson as unknown as { taxonomy: { sha256: string } }).taxonomy.sha256);
  });
});
