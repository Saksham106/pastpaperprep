import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-coordinated-sciences-0654.json";
import privateIndex from "@/data/private-index/igcse-coordinated-sciences-0654.json";
import taxonomy from "@/data/igcse-coordinated-sciences-0654-taxonomy.json";
import { BANK_CATALOG } from "@/lib/catalog";
import { getAvailableBanks, getBank, isIGCSEReleaseBank } from "@/lib/banks";
import { hasBankAccess, isPreviewQuestion } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, getStripeConfig, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const ROOT = process.cwd();
const BANK = "igcse-coordinated-sciences-0654";
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

type RuntimeQuestion = {
  id: string;
  subject: string;
  subjects: string[];
  primaryTopic: string | null;
  primaryTopicId: string | null;
  subtopics: string[];
  skills: string[];
  crossSubject: boolean;
  marks: number | null;
  classificationReviewStatus: string;
  questionImages: string[];
  markschemeImages: string[];
  officialMarkscheme: { images: string[] };
};
type Runtime = {
  version: string;
  years: string;
  paperCount: number;
  questionCount: number;
  marks_ready: boolean;
  rightsStatus: string;
  questions: RuntimeQuestion[];
  runtimeArtifact: Record<string, unknown>;
};

const production = runtime as unknown as Runtime;
const taxonomyDocument = taxonomy as unknown as {
  topics: Array<{ id: string; order: number; title: string; subject: string }>;
  subtopics: Array<{ id: string; title: string; ownerTopicId: string }>;
};
const topicById = new Map(taxonomyDocument.topics.map((topic) => [topic.id, topic]));

const ENVIRONMENT = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
};

const RELEASE_FLAGS_OFF = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" };

describe("IGCSE Co-ordinated Sciences 0654 production release", () => {
  it("is the nineteenth canonical catalog bank, wired with its exact identity", () => {
    expect(BANK_CATALOG).toHaveLength(19);
    const entry = BANK_CATALOG.filter((bank) => bank.slug === BANK);
    expect(entry).toHaveLength(1);
    const [bank] = entry;
    expect(bank.qualification).toBe("Cambridge IGCSE");
    expect(bank.subject).toBe("Co-ordinated Sciences");
    expect(bank.syllabusCode).toBe("0654");
    expect(bank.productId).toBe("bank_igcse_coordinated_sciences_0654");
    expect(bank.bundleProductId).toBe("bundle_igcse");
    expect(bank.release).toBe("gated");
    expect(bank.delivery).toBe("hosted");
    expect(bank.access).toBe("paid-bank");
    expect(bank.questionCount).toBe(4721);
    expect(bank.paperCount).toBe(238);
    expect(bank.route).toBe(`/banks/${BANK}`);
    expect(isIGCSEReleaseBank(BANK)).toBe(true);
  });

  it("stays hidden unless both shared IGCSE release gates are verified", () => {
    expect(getBank(BANK, RELEASE_FLAGS_OFF)).toBeUndefined();
    expect(getBank(BANK, { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "false" })).toBeUndefined();
    expect(getBank(BANK, { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" })).toBeUndefined();
    const available = getAvailableBanks(ENVIRONMENT).map((bank) => bank.slug);
    expect(available).toContain(BANK);
    expect(available).toContain("igcse-physics-0625");
  });

  it("ships 4,721 rows across 238 papers with the one board-discounted exclusion and no missing marks", () => {
    expect(production.questions).toHaveLength(4721);
    expect(production.questionCount).toBe(4721);
    expect(production.paperCount).toBe(238);
    expect(production.years).toBe("2020-2025");
    expect(production.marks_ready).toBe(true);
    expect(production.questions.every((question) => typeof question.marks === "number" && question.marks > 0)).toBe(true);
    expect(production.questions.some((question) => question.id === "0654-2023-summer-22-q17")).toBe(false);
  });

  it("preserves exactly the four unresolved taxonomy rows, fail-closed, instead of force-labelling them", () => {
    const unresolved = production.questions.filter((question) => question.classificationReviewStatus === "unresolved_taxonomy_gap");
    expect(unresolved.map((question) => question.id).sort()).toEqual([
      "0654-2021-march-12-q17",
      "0654-2021-winter-13-q7",
      "0654-2021-winter-23-q7",
      "0654-2023-winter-12-q7",
    ]);
    for (const question of unresolved) {
      expect(question.primaryTopic).toBeNull();
      expect(question.primaryTopicId).toBeNull();
      expect(question.subtopics).toEqual([]);
    }
    expect(production.questions.filter((question) => question.classificationReviewStatus !== "unresolved_taxonomy_gap")).toHaveLength(4717);
    expect(production.questions.filter((question) => question.classificationReviewStatus === "classified")).toHaveLength(4717);
  });

  it("routes every labelled row through the pinned taxonomy and leads multi-subject rows with the primary subject", () => {
    const multiSubject = production.questions.filter((question) => question.crossSubject);
    expect(multiSubject).toHaveLength(26);
    for (const question of production.questions) {
      expect(question.subject).toBe(`${question.subjects[0][0].toUpperCase()}${question.subjects[0].slice(1)} 0654`);
      if (question.primaryTopicId) {
        const topic = topicById.get(question.primaryTopicId);
        expect(topic).toBeDefined();
        expect(question.primaryTopic).toBe(topic!.title);
        if (topic!.subject !== "all") expect(question.subjects[0]).toBe(topic!.subject);
      }
      // Real internal-code shapes: a dotted parent.child id, a hyphenated slug, or a hashed
      // detail id. A single lowercase dictionary word is the emitted taxonomy's own title
      // for a one-word practical skill (the presenter title-cases it), not an internal code.
      for (const label of [...question.subtopics, ...question.skills]) {
        expect(label).not.toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
        expect(label).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
        expect(label).not.toMatch(/[0-9a-f]{8}/);
      }
    }
  });

  it("references all 15,620 audited source assets in the verified release manifest", () => {
    const references = production.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]);
    expect(references).toHaveLength(15620);
    expect(new Set(references).size).toBe(15620);
    expect(references.every((reference) => reference.endsWith(".webp"))).toBe(true);
    expect(references.every((reference) => reference.startsWith("questions/") || reference.startsWith("markschemes/"))).toBe(true);
    expect(production.questions.every((question) => question.questionImages.length > 0 && question.markschemeImages.length > 0)).toBe(true);
    const storageManifest = JSON.parse(readFileSync(join(ROOT, "data/storage/igcse-coordinated-sciences-0654.manifest.json"), "utf8"));
    expect(storageManifest.storageState).toBe("pending_upload");
    expect(storageManifest.assets).toHaveLength(15620);
    expect(new Set(storageManifest.assets.map((asset: { objectKey: string }) => asset.objectKey)).size).toBe(15620);
    expect(storageManifest.assets.every((asset: { objectKey: string; sha256: string; size: number }) => asset.objectKey.startsWith(`${BANK}/`) && /^[a-f0-9]{64}$/.test(asset.sha256) && asset.size > 0)).toBe(true);
    const storageReceipt = JSON.parse(readFileSync(join(ROOT, "data/storage/igcse-coordinated-sciences-0654.receipt.json"), "utf8"));
    expect(storageReceipt.storageState).toBe("verified_readback");
    expect(storageReceipt.completed).toHaveLength(15620);
    expect(new Set(storageReceipt.completed).size).toBe(15620);
    expect(storageReceipt.failed).toEqual([]);
    expect(storageReceipt.assetManifestSha256).toBe(sha(storageManifest));
  });

  it("seals the finalized runtime to the exact frozen assembly, taxonomy, and original release candidate", () => {
    const artifact = production.runtimeArtifact as Record<string, string | null>;
    expect(production.version).toBe("igcse-coordinated-sciences-0654-full4721-v1");
    expect(artifact.releaseTaxonomySha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "src/data/igcse-coordinated-sciences-0654-taxonomy.json"))).digest("hex"));
    expect(artifact.releaseTaxonomySha256).toBe("0f4790a44465163b5d8f6b1e09120df11e256f473f9e4b929fc6bf467aafdc6e");
    expect(artifact.runtimeTaxonomySha256).toBe(sha(taxonomy));
    const copy = JSON.parse(JSON.stringify(production)) as Runtime;
    (copy.runtimeArtifact as Record<string, unknown>).runtimeSha256 = null;
    expect(artifact.runtimeSha256).toBe(createHash("sha256").update(JSON.stringify(copy)).digest("hex"));
    expect(artifact.originalCandidateRuntimeSha256).toBe("8b0f2a37110a7a56a647cfbf17ecd156eaca1c507fdc3e82711d4c356cacd82a");
    expect((production as unknown as Record<string, unknown>).releaseStatus).toBe("production");
    expect((production as unknown as Record<string, unknown>).publicationStatus).toBe("production");
    expect(artifact.assetVerification).toBe("verified_readback");
    expect(artifact.assetManifestSha256).toBe("a315134b5523e694465fbb4759d14c70f02fe732a6ba6ddbc9cdc1c27fa1005a");
    expect(artifact.storageReceiptSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(production.rightsStatus).toBe("user_attested_rights_authorized");
  });

  it("maps to a release-versioned immutable private object namespace and a hosted product", () => {
    expect(getPrivateBankObjectPrefix(BANK)).toBe(`${BANK}/releases/full4721-v1-6b161eb9e580/`);
    expect(normalizeEntitlements([{ product_id: "bank_igcse_coordinated_sciences_0654", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }])).toHaveLength(1);
    expect(hasBankAccess(BANK, normalizeEntitlements([{ product_id: "bank_igcse_coordinated_sciences_0654", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]))).toBe(true);
    expect(hasBankAccess(BANK, normalizeEntitlements([{ product_id: "bundle_igcse", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]))).toBe(true);
    expect(hasBankAccess(BANK, normalizeEntitlements([{ product_id: "bank_igcse_physics_0625", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]))).toBe(false);
  });

  it("bills through the approved generic single-bank prices without embedding a Stripe id", () => {
    const config = validateStripeConfig({
      NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly",
      STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
      STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly",
      STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
      STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly",
      STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
      STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly",
      STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
      STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly",
      STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
    });
    expect(getBillingPlan("bank_igcse_coordinated_sciences_0654", "monthly", config).priceId).toBe(config.singleMonthlyPriceId);
    expect(getBillingPlan("bank_igcse_coordinated_sciences_0654", "annual", config).priceId).toBe(config.singleAnnualPriceId);
    expect(isStripePriceAllowedForProduct("bank_igcse_coordinated_sciences_0654", config.singleAnnualPriceId, config, "annual")).toBe(true);
    expect(getStripeConfig).toBeTypeOf("function");
  });

  it("models the new bank as a gated migration modeled on the chemistry/physics release", () => {
    const migrationPath = join(ROOT, "supabase/migrations/20260915090000_igcse_coordinated_sciences_0654_release.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("bank_igcse_coordinated_sciences_0654");
    expect(migration).toContain("igcse-coordinated-sciences-0654");
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration).toContain("insert into public.stripe_price_catalog");
    expect(migration).toMatch(/drop function if exists public\.apply_stripe_subscription_event\(\s*text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text\[\], integer, text\s*\);/);
    expect(migration).toMatch(/grant execute on function public\.apply_stripe_subscription_event\(\s*text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text\[\], integer, text\s*\)/);
    for (const constraint of ["products_known_id", "is_valid_custom_bank_ids", "saved_questions_bank", "attempts_bank", "entitlements_custom_bank_shape", "stripe_subscriptions_product", "stripe_subscriptions_custom_shape", "stripe_price_catalog_product_id_check"]) {
      expect(migration).toContain(constraint);
    }
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("exposes a metadata-only private index with no answers, text, or asset paths", () => {
    expect(privateIndex.bank).toBe(BANK);
    expect(privateIndex.questions).toHaveLength(4721);
    const serialized = JSON.stringify(privateIndex);
    for (const key of ["summary", "accessibleText", "solution", "answer", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths", "sourceQuestionUrl", "classificationProvenance"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  it("adapts the flat emitted taxonomy to the app's filter consumers without inventing labels", () => {
    const labels = getControlledSubtopics(BANK, "Motion, forces and energy");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => !/^\d+(\.\d+)*$/.test(label))).toBe(true);
    const questions = production.questions.map((question) => ({ ...question, bankSlug: BANK })) as never;
    const groups = getSubtopicGroups(questions, ["Motion, forces and energy"], []);
    expect(groups.relevant).toEqual(expect.arrayContaining([...labels]));
    expect(groups.relevant.length).toBeGreaterThan(0);
    const ordered = getTopicOptions(questions);
    const expectedOrder = [...taxonomyDocument.topics].sort((left, right) => left.order - right.order).map((topic) => topic.title);
    const available = new Set(production.questions.flatMap((question) => [question.primaryTopic, ...(question as unknown as { secondaryTopics: string[] }).secondaryTopics].filter(Boolean)));
    expect(ordered.filter((topic) => available.has(topic))).toEqual(expectedOrder.filter((topic) => available.has(topic)));
  });

  it("never advertises the excluded board-discounted question as a preview", () => {
    expect(isPreviewQuestion(BANK, "0654-2023-summer-22-q17")).toBe(false);
  });
});
