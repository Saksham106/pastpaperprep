import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import biologyRuntime from "@/data/production/igcse-biology-0610.json";
import economicsRuntime from "@/data/production/igcse-economics-0455.json";
import biologyTaxonomy from "@/data/igcse-biology-0610-official-taxonomy.json";
import economicsTaxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import { getBank, getAvailableBanks } from "@/lib/banks";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";
import { getControlledSubtopics } from "@/lib/taxonomy-router";

describe("IGCSE Biology and Economics release candidate", () => {
  it("exposes gated production banks only when both release gates are verified", () => {
    expect(getBank("igcse-biology-0610", {
      PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "false",
      PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
    })).toBeUndefined();
    const banks = getAvailableBanks({
      PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
      PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
    });
    expect(banks.map((bank) => bank.slug)).toEqual(expect.arrayContaining([
      "igcse-biology-0610", "igcse-economics-0455",
    ]));
  });

  it("maps all private runtimes to immutable bank-prefixed R2 namespaces", () => {
    expect(getPrivateBankObjectPrefix("ib-economics-hl")).toBe("ib-economics-hl/");
    expect(getPrivateBankObjectPrefix("igcse-biology-0610")).toBe("igcse-biology-0610/");
    expect(getPrivateBankObjectPrefix("igcse-economics-0455")).toBe("igcse-economics-0455/");
  });

  it("seals each production runtime to its exact filter taxonomy", () => {
    type RuntimeSeal = { releaseTaxonomySha256: string; runtimeTaxonomySha256: string };
    const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const biologySeal = (biologyRuntime as { runtimeArtifact: RuntimeSeal }).runtimeArtifact;
    const economicsSeal = (economicsRuntime as { runtimeArtifact: RuntimeSeal }).runtimeArtifact;
    expect(biologySeal.releaseTaxonomySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(biologySeal.runtimeTaxonomySha256).toBe(sha(biologyTaxonomy));
    expect(economicsSeal.releaseTaxonomySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(economicsSeal.runtimeTaxonomySha256).toBe(sha(economicsTaxonomy));
  });

  it("copies the approved generic single-bank Stripe catalog rows without embedding price IDs", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260911030000_igcse_biology_economics_release.sql"), "utf8");
    expect(migration).toContain("where source.product_id = 'bank_igcse'");
    expect(migration).toContain("('bank_igcse_biology_0610'::text)");
    expect(migration).toContain("('bank_igcse_economics_0455'::text)");
    expect(migration).toMatch(
      /drop function if exists public\.apply_stripe_subscription_event\(\s*text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text\[\], integer, text\s*\);/,
    );
    expect(migration).not.toMatch(/'price_[A-Za-z0-9_]{6,}'/);
  });

  it("keeps Biology filter labels controlled and never numeric", () => {
    const labels = getControlledSubtopics("igcse-biology-0610", "Characteristics and classification of living organisms");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => !/^\d+(\.\d+)*$/.test(label))).toBe(true);
  });
});
