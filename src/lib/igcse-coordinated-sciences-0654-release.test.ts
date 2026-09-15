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
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy-router";

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

const candidate = runtime as unknown as Runtime;
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

describe("IGCSE Co-ordinated Sciences 0654 production candidate", () => {
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
    expect(bank.questionCount).toBe(4030);
    expect(bank.paperCount).toBe(204);
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

  it("ships 4,030 rows across 204 papers with the one board-discounted exclusion and no missing marks", () => {
    expect(candidate.questions).toHaveLength(4030);
    expect(candidate.questionCount).toBe(4030);
    expect(candidate.paperCount).toBe(204);
    expect(candidate.years).toBe("2021-2025");
    expect(candidate.marks_ready).toBe(true);
    expect(candidate.questions.every((question) => typeof question.marks === "number" && question.marks > 0)).toBe(true);
    expect(candidate.questions.some((question) => question.id === "0654-2023-summer-22-q17")).toBe(false);
  });

  it("preserves exactly the four unresolved taxonomy rows, fail-closed, instead of force-labelling them", () => {
    const unresolved = candidate.questions.filter((question) => question.classificationReviewStatus === "unresolved_taxonomy_gap");
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
    expect(candidate.questions.filter((question) => question.classificationReviewStatus !== "unresolved_taxonomy_gap")).toHaveLength(4026);
  });

  it("routes every labelled row through the pinned taxonomy and leads multi-subject rows with the primary subject", () => {
    const multiSubject = candidate.questions.filter((question) => question.subjects.length > 1);
    expect(multiSubject).toHaveLength(20);
    for (const question of candidate.questions) {
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

  it("references 13,322 of the 13,325 audited source assets, dropping only the excluded question's three", () => {
    const references = candidate.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]);
    expect(references).toHaveLength(13322);
    expect(new Set(references).size).toBe(13322);
    expect(references.every((reference) => reference.endsWith(".webp"))).toBe(true);
    expect(references.every((reference) => reference.startsWith("questions/") || reference.startsWith("markschemes/"))).toBe(true);
    expect(candidate.questions.every((question) => question.questionImages.length > 0 && question.markschemeImages.length > 0)).toBe(true);
  });

  it("seals the runtime to the exact frozen assembly, taxonomy, and candidate", () => {
    const artifact = candidate.runtimeArtifact as Record<string, string | null>;
    expect(candidate.version).toBe("igcse-coordinated-sciences-0654-full4030-v1");
    expect(artifact.releaseTaxonomySha256).toBe(createHash("sha256").update(readFileSync(join(ROOT, "src/data/igcse-coordinated-sciences-0654-taxonomy.json"))).digest("hex"));
    expect(artifact.releaseTaxonomySha256).toBe("0f4790a44465163b5d8f6b1e09120df11e256f473f9e4b929fc6bf467aafdc6e");
    expect(artifact.runtimeTaxonomySha256).toBe(sha(taxonomy));
    const copy = JSON.parse(JSON.stringify(candidate)) as Runtime;
    (copy.runtimeArtifact as Record<string, unknown>).runtimeSha256 = null;
    expect(artifact.runtimeSha256).toBe(createHash("sha256").update(JSON.stringify(copy)).digest("hex"));
    expect(artifact.originalCandidateRuntimeSha256).toBe("5843c2c07c5d2357f18b3dd0de3910dede8443c36b3feff11827ee5441dd3c95");
    expect(artifact.assetVerification).toBe("pending_upload");
    expect(candidate.rightsStatus).toBe("user_attested_rights_authorized");
  });

  it("maps to an immutable bank-prefixed private object namespace and a hosted product", () => {
    expect(getPrivateBankObjectPrefix(BANK)).toBe(`${BANK}/`);
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
    expect(privateIndex.questions).toHaveLength(4030);
    const serialized = JSON.stringify(privateIndex);
    for (const key of ["summary", "accessibleText", "solution", "answer", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths", "sourceQuestionUrl", "classificationProvenance"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  it("adapts the flat emitted taxonomy to the app's filter consumers without inventing labels", () => {
    const labels = getControlledSubtopics(BANK, "Motion, forces and energy");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => !/^\d+(\.\d+)*$/.test(label))).toBe(true);
    const ordered = getTopicOptions(candidate.questions.map((question) => ({ ...question, bankSlug: BANK })) as never);
    const expectedOrder = [...taxonomyDocument.topics].sort((left, right) => left.order - right.order).map((topic) => topic.title);
    const available = new Set(candidate.questions.flatMap((question) => [question.primaryTopic, ...(question as unknown as { secondaryTopics: string[] }).secondaryTopics].filter(Boolean)));
    expect(ordered.filter((topic) => available.has(topic))).toEqual(expectedOrder.filter((topic) => available.has(topic)));
  });

  it("never advertises the excluded board-discounted question as a preview", () => {
    expect(isPreviewQuestion(BANK, "0654-2023-summer-22-q17")).toBe(false);
  });
});
