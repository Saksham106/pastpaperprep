import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fixture from "@/data/production/a-level-maths-9709.json";
import { A_LEVEL_MATHS_9709, MATHS_9709_PAPERS, MF19_URL } from "@/lib/a-level-9709";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, getCatalogBillingBanks } from "@/lib/catalog";
import { getBank, IGCSE_RELEASE_BANK_CATALOG, isIGCSEReleaseBank, isPrivateBankIndexEnabled } from "@/lib/banks";
import { BANK_PRODUCTS, bankEntryHref, hasBankAccess, hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getBillingPlan, isStripePriceAllowedForProduct, validateStripeConfig } from "@/lib/stripe-config";
import { getCustomBundlePlan } from "@/lib/custom-bundles";
import { PURCHASABLE_PRODUCTS } from "@/lib/pricing-intent";
import { normalizeBankQuestions } from "@/lib/questions";
import { getTopicOptions } from "@/lib/taxonomy-router";
import { deriveCourseRoute } from "@/lib/course-route";
import { isNotSatSeries } from "@/lib/series-notes";
import { formulaListFor } from "@/lib/formula-lists";
import { pdfCoverSummary, pdfSourceLabel } from "@/lib/pdf-labels";
import { qualificationOfBank, SUBJECT_SLUGS } from "@/lib/past-paper-catalog";
import { qualificationInfo, qualifiedBankTitle } from "@/lib/qualifications";

const ROOT = process.cwd();
const slug = A_LEVEL_MATHS_9709;
const product = "bank_a_level_maths_9709";
const PRODUCTION = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const PREVIEW = { NODE_ENV: "development", PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" };
const entitlement = (product_id: string, selected_bank_ids?: string[]) => normalizeEntitlements([{ product_id, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, ...(selected_bank_ids ? { selected_bank_ids } : {}) }]);
const questions = normalizeBankQuestions(slug, fixture.questions as unknown as Array<Record<string, unknown>>);
const stripeConfig = validateStripeConfig({
  NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_founding_monthly", STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_founding_annual",
  STRIPE_CUSTOM_MONTHLY_PRICE_ID: "price_custom_monthly", STRIPE_CUSTOM_ANNUAL_PRICE_ID: "price_custom_annual",
  STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly", STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
  STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly", STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
  STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly", STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
});

describe("A Level Mathematics 9709 catalog entry", () => {
  it("is a hidden, gated, paid Cambridge A Level bank with no pair bundle", () => {
    expect(BANK_CATALOG.filter((entry) => entry.slug === slug)).toHaveLength(1);
    const entry = getCatalogBank(slug)!;
    expect(entry).toMatchObject({ qualification: "Cambridge A Level", subject: "Mathematics", title: "Mathematics 9709", syllabusCode: "9709", years: "2020-2026", access: "paid-bank", productId: product, release: "gated", delivery: "hosted", pendingStorage: true });
    expect(entry.bundleProductId).toBeUndefined();
    expect(BANK_PRODUCTS[slug]).toBe(product);
    expect(qualificationOfBank(slug)).toBe("a-level");
    expect(SUBJECT_SLUGS[slug]).toBe(slug);
    expect(qualifiedBankTitle(entry)).toBe("A Level Mathematics 9709");
    expect(qualificationInfo(entry.qualification).hubPath).toBe("/cambridge-a-level");
  });

  it("stays out of the IGCSE release machinery until its real runtime is staged", () => {
    expect(isIGCSEReleaseBank(slug)).toBe(false);
    expect(IGCSE_RELEASE_BANK_CATALOG.some((entry) => entry.slug === slug)).toBe(false);
    expect(isPrivateBankIndexEnabled(slug, PRODUCTION)).toBe(false);
  });

  it("is hidden and unsellable in production even with every release gate on", () => {
    expect(getCatalogBanksForDisplay(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getCatalogBillingBanks(PRODUCTION).some((entry) => entry.slug === slug)).toBe(false);
    expect(getBank(slug, PRODUCTION)).toBeUndefined();
    expect(() => getBillingPlan(product, "monthly", stripeConfig, undefined, PRODUCTION)).toThrow("Bank is not available for checkout");
    // The dev-only preview flag never applies outside `npm run dev`.
    expect(getCatalogBanksForDisplay({ ...PRODUCTION, PASTPAPERPREP_PREVIEW_PENDING_BANKS: "true" }).some((entry) => entry.slug === slug)).toBe(false);
  });

  it("can be previewed locally with the dev-only pending-bank flag", () => {
    expect(getCatalogBanksForDisplay(PREVIEW).some((entry) => entry.slug === slug)).toBe(true);
    expect(getBank(slug, PREVIEW)?.qualification).toBe("Cambridge A Level");
  });
});

describe("A Level Mathematics 9709 billing", () => {
  it("sells as a single bank at the generic single-bank price once displayed", () => {
    expect(PURCHASABLE_PRODUCTS).toContain(product);
    expect(getBillingPlan(product, "monthly", stripeConfig, undefined, PREVIEW)).toMatchObject({ priceId: "price_single_monthly" });
    expect(getBillingPlan(product, "annual", stripeConfig, undefined, PREVIEW)).toMatchObject({ priceId: "price_single_annual" });
    expect(isStripePriceAllowedForProduct(product, stripeConfig.singleMonthlyPriceId, stripeConfig, "monthly")).toBe(true);
    expect(isStripePriceAllowedForProduct(product, stripeConfig.pairMonthlyPriceId, stripeConfig, "monthly")).toBe(false);
  });

  it("can be picked in Build Your Plan once displayed", () => {
    expect(getCustomBundlePlan("monthly", [slug, "igcse"], stripeConfig, PREVIEW)).toMatchObject({ productId: "bundle_custom", quantity: 2, selectedBankIds: [slug, "igcse"].sort() });
    expect(() => getCustomBundlePlan("monthly", [slug, "igcse"], stripeConfig, PRODUCTION)).toThrow("Bank is not available for checkout");
  });

  it("is reached by its own product, All Access, Lifetime and a custom bundle, never by a pair bundle", () => {
    expect(hasBankAccess(slug, entitlement(product))).toBe(true);
    expect(hasBankAccess(slug, entitlement("bundle_all"))).toBe(true);
    expect(hasBankAccess(slug, entitlement("lifetime_all_access"))).toBe(true);
    expect(hasBankAccess(slug, entitlement("bundle_custom", [slug, "igcse"]))).toBe(true);
    for (const other of ["bundle_igcse", "bundle_ib_aa", "bank_igcse", "bundle_custom"]) expect(hasBankAccess(slug, entitlement(other, other === "bundle_custom" ? ["igcse"] : undefined))).toBe(false);
  });

  it("All Access and Lifetime cover every bank in the catalog, with no list to maintain", () => {
    for (const entry of BANK_CATALOG) {
      expect(hasBankAccess(entry.slug, entitlement("bundle_all")), entry.slug).toBe(true);
      expect(hasBankAccess(entry.slug, entitlement("lifetime_all_access")), entry.slug).toBe(true);
    }
  });

  it("registers the product in an unapplied migration copied from the latest billing definitions, with no Stripe id", () => {
    const name = "20261114000000_a_level_maths_9709_release.sql";
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
    const versions = migrations.map((file) => file.slice(0, 14));
    expect(new Set(versions).size).toBe(versions.length);
    expect(migrations.at(-1)).toBe(name);
    const migration = readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
    const source = readFileSync(join(ROOT, "supabase/migrations/20261020020000_ib_computer_science_release.sql"), "utf8");
    expect(migration.startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    for (const object of ["products_known_id", "is_valid_custom_bank_ids", "saved_questions_bank", "attempts_bank", "stripe_subscriptions_product", "stripe_price_catalog_product_id_check", "confirm_addon_billing_checkout", "confirm_billing_checkout", "apply_stripe_subscription_event"]) {
      expect(migration).toContain(object);
    }
    // Six product lists plus the products row and the catalog copy; three bank-slug lists.
    expect(migration.match(/'bank_a_level_maths_9709'/g)?.length).toBe(8);
    expect(migration.match(/'a-level-maths-9709'/g)?.length).toBe(3);
    // Everything the source registered survives the copy.
    for (const id of ["bank_igcse_computer_science_0478", "bank_ib_computer_science_hl", "bank_ib_computer_science_sl", "lifetime_all_access", "bundle_custom", "bundle_ib_economics"]) {
      expect(migration.match(new RegExp(`'${id}'`, "g"))?.length, id).toBeGreaterThanOrEqual(source.includes(`'${id}'`) ? 1 : 0);
    }
    expect(migration.match(/'bank_ib_computer_science_sl'/g)?.length).toBe(6);
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
  });
});

describe("A Level Mathematics 9709 fixture runtime and paper tabs", () => {
  it("holds fixture rows only, one per paper per sitting, every topic an official section of its paper", () => {
    expect(fixture.fixture).toBe(true);
    expect(questions).toHaveLength(18);
    for (const paper of MATHS_9709_PAPERS) {
      const rows = questions.filter((question) => question.paper === paper.paper);
      expect(rows, `Paper ${paper.paper}`).toHaveLength(3);
      for (const row of rows) {
        expect(paper.sections).toContain(row.primaryTopic);
        expect(row.syllabusRoute).toBe(paper.route);
        expect(row.questionImages).toEqual([]);
      }
    }
  });

  it("makes exactly the 2020 and 2021 papers free", () => {
    expect(hasFreeTier(slug)).toBe(true);
    expect(bankEntryHref(slug)).toBe(`/banks/${slug}?free=1`);
    for (const question of questions) expect(isPreviewQuestion(slug, question.id), question.id).toBe(question.year <= 2021);
  });

  it("maps each paper to its own tab and never to a shared route", () => {
    expect([1, 2, 3, 4, 5, 6].map((paper) => deriveCourseRoute(slug, paper))).toEqual(["pure-1", "pure-2", "pure-3", "mechanics", "ps-1", "ps-2"]);
    expect(deriveCourseRoute(slug, 7)).toBe("");
  });

  it("lists topics in syllabus order, and a paper's questions list only that paper's sections", () => {
    const pure3 = questions.filter((question) => question.paper === 3);
    expect(getTopicOptions(pure3)).toEqual(["Trigonometry", "Vectors", "Complex numbers"]);
    const all = getTopicOptions(questions);
    expect(all.indexOf("Quadratics")).toBeLessThan(all.indexOf("Algebra"));
    expect(all.indexOf("Complex numbers")).toBeLessThan(all.indexOf("Forces and equilibrium"));
    expect(all.at(-1)).toBe("Hypothesis tests");
  });

  it("labels the unsat May/June 2020 papers, and only those", () => {
    expect(isNotSatSeries(slug, 2020, "May/June")).toBe(true);
    expect(isNotSatSeries(slug, 2020, "October/November")).toBe(false);
    expect(isNotSatSeries(slug, 2021, "May/June")).toBe(false);
    expect(isNotSatSeries("igcse", 2020, "May/June")).toBe(false);
    const unsat = questions.find((question) => question.year === 2020)!;
    expect(pdfSourceLabel(unsat)).toBe(`2020 May/June (not sat) · Paper ${unsat.component} · Q${unsat.number}`);
    const sat = questions.find((question) => question.year === 2024)!;
    expect(pdfSourceLabel(sat)).not.toContain("not sat");
  });

  it("names the paper on a one-paper PDF cover", () => {
    const pure3 = questions.filter((question) => question.paper === 3);
    expect(pdfCoverSummary(pure3, slug, "questions").eyebrow).toBe("A LEVEL MATHEMATICS 9709 · PURE 3");
    expect(pdfCoverSummary(questions, slug, "questions").eyebrow).toBe("A LEVEL MATHEMATICS 9709");
  });

  it("links the MF19 formula list from Cambridge, for 9709 only", () => {
    expect(formulaListFor(slug)).toEqual({ code: "MF19", label: "Formula list (MF19)", url: MF19_URL });
    expect(MF19_URL).toMatch(/^https:\/\/www\.cambridgeinternational\.org\/Images\/\d+-list-of-formulae-and-statistical-tables\.pdf$/);
    expect(formulaListFor("igcse")).toBeUndefined();
  });
});
