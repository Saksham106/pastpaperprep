import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import runtime from "@/data/production/igcse-computer-science-0478.json";
import privateIndex from "@/data/private-index/igcse-computer-science-0478.json";
import taxonomy from "@/data/igcse-computer-science-0478-taxonomy.json";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay } from "@/lib/catalog";
import { getAvailableBanks, isIGCSEReleaseBank } from "@/lib/banks";
import { bankEntryHref, hasBankAccess, hasFreeTier } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { normalizeBankQuestions } from "@/lib/questions";

const ROOT = process.cwd();
const BANK = "igcse-computer-science-0478";
const PRODUCT = "bank_igcse_computer_science_0478";
const CANDIDATE = "3f65f4fa9c94c0b35b6579b4ad0d2306ac20093234a4edd95e79c79b0618de6c";
const WITHDRAWN = ["0478-2023-s-22-q5", "0478-2025-s-22-q10"];
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

type RuntimeQuestion = {
  id: string; paper: number; year: number; session: string; marks: number; maxMarks: number;
  primaryTopic: string; secondaryTopics: string[]; subtopics: string[];
  questionImages: string[]; markschemeImages: string[]; publicationStatus: string; classificationReviewStatus: string;
};
type Runtime = {
  years: string; paperCount: number; questionCount: number; assetVerification: string;
  taxonomy: { sha256: string }; questions: RuntimeQuestion[]; runtimeArtifact: Record<string, unknown>;
};
const production = runtime as unknown as Runtime;
const tree = taxonomy as unknown as { topics: Array<{ code: string; label: string; paper: number; sections: Array<{ code: string; label: string; official: boolean }> }> };
const RELEASE_ON = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const RELEASE_OFF = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" };
/** Undo exactly what `generate-igcse-release.mjs --finalize` writes; the result must be the pinned candidate. */
function reconstructCandidate(finalized: Runtime): Runtime {
  const candidate = JSON.parse(JSON.stringify(finalized)) as Runtime & { releaseStatus: string; publicationStatus: string };
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
  meta.runtimeSha256 = sha(candidate);
  return candidate;
}
const entitlement = (product_id: string) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]);

describe("IGCSE Computer Science 0478 release candidate", () => {
  it("is a gated, paid IGCSE catalog bank with its exact identity", () => {
    expect(BANK_CATALOG.filter((bank) => bank.slug === BANK)).toHaveLength(1);
    expect(getCatalogBank(BANK)).toMatchObject({
      qualification: "Cambridge IGCSE", subject: "Computer Science", title: "Computer Science 0478", syllabusCode: "0478",
      questionCount: 847, paperCount: 105, years: "2019-2026", access: "paid-bank", productId: PRODUCT,
      bundleProductId: "bundle_igcse", release: "gated", delivery: "hosted",
    });
    expect(isIGCSEReleaseBank(BANK)).toBe(true);
  });

  it("is launched: shown with the shared IGCSE release gates on, hidden with them off", () => {
    expect("pendingStorage" in getCatalogBank(BANK)!).toBe(false);
    expect(getCatalogBanksForDisplay(RELEASE_ON).some((bank) => bank.slug === BANK)).toBe(true);
    expect(getAvailableBanks(RELEASE_ON).some((bank) => bank.slug === BANK)).toBe(true);
    expect(getAvailableBanks(RELEASE_OFF).some((bank) => bank.slug === BANK)).toBe(false);
  });

  it("has no free tier, so its entry link is the plain bank page", () => {
    expect(hasFreeTier(BANK)).toBe(false);
    expect(bankEntryHref(BANK)).toBe(`/banks/${BANK}`);
  });

  it("opens its static bank page on the full locked bank, never an empty free-only view", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    const { loadBankExplorer } = await import("@/lib/bank-explorer");
    const explorer = await loadBankExplorer(BANK);
    expect(explorer?.initialState.freeOnly).toBe(false);
    expect(explorer?.initialQuestions.length).toBeGreaterThan(0);
    vi.unstubAllEnvs();
  });

  it("ships 847 questions across 105 papers, 2019-2026, without the withdrawn or pre-release questions", () => {
    expect(production.questions).toHaveLength(847);
    expect(production.questionCount).toBe(847);
    expect(production.paperCount).toBe(105);
    expect(new Set(production.questions.map((question) => question.id.replace(/-q\d+$/, ""))).size).toBe(105);
    expect(production.years).toBe("2019-2026");
    expect(new Set(production.questions.map((question) => question.id)).size).toBe(847);
    expect(production.questions.filter((question) => question.year >= 2023).length).toBe(469);
    const prerelease = production.runtimeArtifact.excludedPrerelease as string[];
    expect(prerelease).toHaveLength(27);
    for (const id of prerelease) {
      expect(id).toMatch(/^0478-(2019|202[012])-[msw]-2\d-q1$/);
      expect(production.questions.some((question) => question.id === id)).toBe(false);
    }
    for (const id of WITHDRAWN) expect(production.questions.some((question) => question.id === id)).toBe(false);
    expect(production.runtimeArtifact.excludedWithdrawn).toEqual(WITHDRAWN);
    for (const question of production.questions) {
      expect(question.marks).toBeGreaterThan(0);
      // The 2015-2022 Paper 2 was out of 50; every other paper is out of 75.
      expect(question.maxMarks).toBe(question.year <= 2022 && question.paper === 2 ? 50 : 75);
      expect(["March", "June", "November"]).toContain(question.session);
      expect(question.questionImages.length).toBeGreaterThan(0);
      expect(question.markschemeImages.length).toBeGreaterThan(0);
      for (const image of [...question.questionImages, ...question.markschemeImages]) expect(image).toMatch(/^(questions|markschemes)\/0478-\d{4}-[msw]-\d{2}\/q\d+-\d+-\d+\.webp$/);
    }
  });

  it("labels every question inside its own paper's topics, and every filter has questions", () => {
    const topicPaper = new Map(tree.topics.map((topic) => [topic.label, topic.paper]));
    const sectionTopic = new Map(tree.topics.flatMap((topic) => topic.sections.map((section) => [section.label, topic.label] as const)));
    // The 2015-2022 Paper 1 also assessed Boolean logic, which the current syllabus puts in Paper 2.
    const paperOf = (question: RuntimeQuestion, topic: string) =>
      question.year <= 2022 && question.paper === 1 && topic === "Boolean logic" ? 1 : topicPaper.get(topic);
    for (const question of production.questions) {
      expect(paperOf(question, question.primaryTopic), question.id).toBe(question.paper);
      for (const topic of question.secondaryTopics) expect(paperOf(question, topic), question.id).toBe(question.paper);
      expect(question.subtopics.length).toBeGreaterThan(0);
      for (const subtopic of question.subtopics) expect(sectionTopic.has(subtopic), `${question.id} ${subtopic}`).toBe(true);
      expect(sectionTopic.get(question.subtopics[0])).toBe(question.primaryTopic);
    }
    const used = new Set(production.questions.flatMap((question) => question.subtopics));
    expect(used.size).toBe(31);
    expect(sectionTopic.size).toBe(31);
  });

  it("keeps the official topic order and shows the approved filters beneath topic 7", () => {
    const questions = normalizeBankQuestions(BANK, production.questions as never);
    expect(getTopicOptions(questions)).toEqual(tree.topics.map((topic) => topic.label));
    expect(getTopicOptions(questions)[0]).toBe("Data representation");
    const algorithms = tree.topics.find((topic) => topic.code === "7")!;
    expect(algorithms.sections.map((section) => section.code)).toEqual(["7.a", "7.b", "7.c", "7.d", "7.e", "7.f", "7.g"]);
    expect(algorithms.sections.every((section) => !section.official)).toBe(true);
    expect(getControlledSubtopics(BANK, algorithms.label)).toContain("Trace tables");
    expect(getControlledSubtopics(BANK, "Databases")).toEqual(["Databases"]);
    const groups = getSubtopicGroups(questions, ["Hardware"], []);
    expect(groups.all).toHaveLength(31);
    expect(groups.relevant).toEqual(["Computer architecture", "Input and output devices", "Data storage", "Network hardware"]);
  });

  it("is exactly the finalized form of the pinned, content-sealed candidate", async () => {
    const { assertContentSealedCandidate, blankedCandidateSha256 } = await import("../../scripts/igcse-release.mjs");
    const candidate = reconstructCandidate(production);
    expect(blankedCandidateSha256(candidate)).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(BANK, candidate)).not.toThrow();
    expect(production.runtimeArtifact.finalizedContentSha256).toBe(sha(production.questions));
  });

  it("seals the runtime to its taxonomy and the release-script pin", () => {
    const meta = production.runtimeArtifact;
    expect(meta.sourceCandidateSha256).toBe(CANDIDATE);
    expect(meta.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    const copy = JSON.parse(JSON.stringify(production)) as Runtime;
    copy.runtimeArtifact.runtimeSha256 = null;
    expect(meta.runtimeSha256).toBe(sha(copy));
    expect(meta.runtimeTaxonomySha256).toBe(sha(taxonomy));
    expect(meta.releaseTaxonomySha256).toBe(sha(readFileSync(join(ROOT, "src/data/igcse-computer-science-0478-taxonomy.json"), "utf8")));
    expect(production.taxonomy.sha256).toBe(meta.releaseTaxonomySha256);
    expect(meta.contentSha256).toBe(sha(reconstructCandidate(production).questions));
    expect(readFileSync(join(ROOT, "scripts/igcse-release.mjs"), "utf8")).toContain(`originalCandidateRuntimeSha256: '${CANDIDATE}'`);
  });

  it("rejects an edited candidate even when its self-seal is recomputed and the stored pin kept", async () => {
    const { assertContentSealedCandidate, runtimeSha256 } = await import("../../scripts/igcse-release.mjs");
    const { assertOriginalCandidateRuntime } = await import("../../scripts/generate-igcse-release.mjs");
    const candidate = reconstructCandidate(production);
    expect(() => assertOriginalCandidateRuntime(BANK, candidate)).not.toThrow();
    expect(() => assertOriginalCandidateRuntime(BANK, production)).toThrow("must be checked as its release candidate");
    const forged = JSON.parse(JSON.stringify(candidate)) as Runtime & { questions: Array<Record<string, unknown>> };
    forged.questions[0].id = "0478-2023-m-12-q999";
    forged.questions[0].marks = 999;
    forged.runtimeArtifact.runtimeSha256 = null;
    forged.runtimeArtifact.runtimeSha256 = runtimeSha256(forged);
    expect(forged.runtimeArtifact.originalCandidateRuntimeSha256).toBe(CANDIDATE);
    expect(() => assertContentSealedCandidate(BANK, forged)).toThrow("candidate content does not reproduce its pinned seal");
    expect(() => assertOriginalCandidateRuntime(BANK, forged)).toThrow("candidate content does not reproduce its pinned seal");
    const relabelled = JSON.parse(JSON.stringify(candidate)) as Runtime;
    relabelled.questions[0].subtopics = [...relabelled.questions[0].subtopics, "Encryption"];
    relabelled.runtimeArtifact.runtimeSha256 = null;
    relabelled.runtimeArtifact.runtimeSha256 = runtimeSha256(relabelled);
    expect(() => assertOriginalCandidateRuntime(BANK, relabelled)).toThrow("candidate content does not reproduce its pinned seal");
  });

  it("keeps dropped 2015-2022 content findable under Earlier syllabus topics, last in the topic list", () => {
    const earlier = tree.topics.at(-1)!;
    expect(earlier).toMatchObject({ code: "E", label: "Earlier syllabus topics" });
    expect(earlier.sections.map((section) => section.label)).toEqual(["Ethics (earlier syllabus)"]);
    const ethics = production.questions.filter((question) => question.subtopics.includes("Ethics (earlier syllabus)"));
    expect(ethics.length).toBeGreaterThan(0);
    expect(ethics.every((question) => question.year <= 2022 && question.paper === 1)).toBe(true);
    expect(production.questions.filter((question) => question.year >= 2023).every((question) => question.primaryTopic !== earlier.label && !question.secondaryTopics.includes(earlier.label))).toBe(true);
  });

  it("carries the 5.3 Cyber security secondary on the three reviewed SSL questions", () => {
    for (const id of ["0478-2023-w-13-q4", "0478-2024-w-12-q7", "0478-2026-s-11-q6"]) {
      const question = production.questions.find((candidate) => candidate.id === id)!;
      expect(question.primaryTopic, id).toBe("The internet and its uses");
      expect(question.subtopics, id).toContain("Cyber security");
    }
    expect(production.questions.find((question) => question.id === "0478-2026-s-11-q6")!.subtopics).toEqual(["The internet and the world wide web", "Encryption", "Cyber security"]);
  });

  it("is finalized against a complete verified readback of exactly the manifest's crops", () => {
    expect(production.assetVerification).toBe("verified_readback");
    expect(production.questions.every((question) => question.publicationStatus === "production" && question.classificationReviewStatus === "classified")).toBe(true);
    const manifestText = readFileSync(join(ROOT, "data/storage/igcse-computer-science-0478.manifest.json"), "utf8");
    const receiptText = readFileSync(join(ROOT, "data/storage/igcse-computer-science-0478.receipt.json"), "utf8");
    const manifest = JSON.parse(manifestText) as { objectPrefix: string; assets: Array<{ objectKey: string; sha256: string; size: number }> };
    const receipt = JSON.parse(receiptText) as { storageState: string; assetManifestSha256: string; completed: string[]; failed: unknown[] };
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.failed).toEqual([]);
    expect(receipt.assetManifestSha256).toBe(sha(manifest));
    expect(production.runtimeArtifact.assetManifestSha256).toBe(sha(manifest));
    expect(production.runtimeArtifact.storageReceiptSha256).toBe(sha(receiptText));
    expect([...receipt.completed].sort()).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    const refs = new Set(production.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.assets).toHaveLength(refs.size);
    expect(manifest.assets.every((asset) => refs.has(asset.objectKey.slice(manifest.objectPrefix.length)))).toBe(true);
    expect(getPrivateBankObjectPrefix(BANK)).toBe(manifest.objectPrefix);
    const log = readFileSync(join(ROOT, "docs/igcse-computer-science-0478-r2-upload-log.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string });
    const byKey = new Map(log.map((row) => [row.key, row]));
    expect(byKey.size).toBe(manifest.assets.length);
    for (const asset of manifest.assets) expect(byKey.get(asset.objectKey)).toMatchObject({ sha256: asset.sha256, bytes: asset.size, status: "verified" });
  });

  it("passes the runtime release gate's seal checks once the IGCSE gates are on", async () => {
    const { getIGCSERuntimeArtifact } = await import("@/lib/igcse-runtime");
    expect(getIGCSERuntimeArtifact(BANK, RELEASE_ON).questions).toHaveLength(847);
  });

  it("is sold alone at the generic single-bank price and through All Access and the IGCSE bundle", () => {
    expect(hasBankAccess(BANK, entitlement(PRODUCT))).toBe(true);
    expect(hasBankAccess(BANK, entitlement("bundle_all"))).toBe(true);
    expect(hasBankAccess(BANK, entitlement("bundle_igcse"))).toBe(true);
    expect(hasBankAccess(BANK, entitlement("bank_igcse_physics_0625"))).toBe(false);
    const config = validateStripeConfig({
      NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly", STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
      STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly", STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
      STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly", STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
      STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly", STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
      STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly", STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
    });
    expect(getBillingPlan(PRODUCT, "monthly", config, undefined, RELEASE_ON).priceId).toBe(config.singleMonthlyPriceId);
    expect(getBillingPlan(PRODUCT, "annual", config, undefined, RELEASE_ON).priceId).toBe(config.singleAnnualPriceId);
    // Not for sale when the release gates are off, even by direct API call.
    expect(() => getBillingPlan(PRODUCT, "monthly", config, undefined, RELEASE_OFF)).toThrow("Bank is not available for checkout");
    // Lifecycle validation still recognises the generic single-bank price for this product.
    expect(isStripePriceAllowedForProduct(PRODUCT, config.singleAnnualPriceId, config, "annual")).toBe(true);
    expect(getBillingPlan("bank_igcse_coordinated_sciences_0654", "monthly", config, undefined, RELEASE_ON).priceId).toBe(config.singleMonthlyPriceId);
  });

  it("registers the product in a migration copied from the latest billing definitions, with no Stripe id", () => {
    const migration = readFileSync(join(ROOT, "supabase/migrations/20261019000000_igcse_computer_science_0478_release.sql"), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    for (const object of ["products_known_id", "is_valid_custom_bank_ids", "saved_questions_bank", "attempts_bank", "stripe_subscriptions_product", "stripe_price_catalog_product_id_check", "confirm_addon_billing_checkout", "confirm_billing_checkout", "apply_stripe_subscription_event"]) {
      expect(migration).toContain(object);
    }
    // The latest products check (lifetime migration) must survive.
    expect(migration).toContain("'lifetime_all_access'");
    expect(migration.match(/'bank_igcse_computer_science_0478'/g)?.length).toBe(8);
    expect(migration.match(/'igcse-computer-science-0478'/g)?.length).toBe(3);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
  });

  it("exposes a metadata-only private index with no text, answers or asset paths", () => {
    expect(privateIndex.bank).toBe(BANK);
    expect(privateIndex.questions).toHaveLength(847);
    const serialized = JSON.stringify(privateIndex);
    for (const key of ["summary", "accessibleText", "answer", "questionImages", "markschemeImages", "sourceQuestionUrl", "classificationProvenance"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });
});
