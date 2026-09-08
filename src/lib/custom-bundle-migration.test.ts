import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260910000000_custom_bank_bundles.sql"),
  "utf8",
);
const priceCatalogMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260911000000_stripe_price_catalog.sql"),
  "utf8",
);
const priceCatalogRenderer = readFileSync(
  join(process.cwd(), "scripts/render-stripe-price-catalog.mjs"),
  "utf8",
);

describe("custom bank bundle migration", () => {
  it("persists exact selected canonical bank IDs on old-compatible records", () => {
    expect(migration).toContain("selected_bank_ids text[]");
    expect(migration).toMatch(/alter table public\.entitlements\s+add column if not exists selected_bank_ids text\[\]/);
    expect(migration).toMatch(/alter table public\.stripe_subscriptions\s+add column if not exists selected_bank_ids text\[\]/);
    expect(migration).toContain("bundle_custom");
    expect(migration).toContain("is_valid_custom_bank_ids");
  });

  it("fails closed on custom product shape, quantity, price, duplicates, and unknown banks", () => {
    expect(migration).toContain("quantity integer");
    expect(migration).toContain("price_id text");
    expect(migration).toContain("p_quantity");
    expect(migration).toContain("p_price_id");
    expect(migration).toContain("p_selected_bank_ids");
    expect(migration).toContain("selected.bank_id is null");
    expect(migration).toContain("p_quantity <> cardinality(p_selected_bank_ids)");
    expect(migration).toContain("Duplicate or unknown custom bank");
  });

  it("updates the service-role webhook RPC and entitlement refresh atomically", () => {
    expect(migration).toContain("drop function if exists public.apply_stripe_subscription_event(");
    expect(migration).toContain("create function public.apply_stripe_subscription_event(");
    expect(migration).toContain("p_selected_bank_ids text[]");
    expect(migration).toContain("refresh_stripe_entitlement(");
    expect(migration).toContain("create or replace function public.invalidate_stripe_subscription_event");
    expect(migration).toContain("subscription_selected_bank_ids");
    expect(migration).toContain("grant execute on function public.apply_stripe_subscription_event(");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("keeps the database boundary independently price- and interval-aware", () => {
    expect(priceCatalogMigration).toContain("stripe_price_catalog");
    expect(priceCatalogMigration).toContain("price_id text not null");
    expect(priceCatalogMigration).toContain("billing_interval text");
    expect(priceCatalogMigration).toContain("grandfathered boolean");
    expect(priceCatalogMigration).toContain("primary key (price_id, product_id, billing_interval)");
    expect(priceCatalogMigration).toContain("p_interval text");
    expect(priceCatalogMigration).toContain("p_price_id");
    expect(priceCatalogMigration).toContain("p_interval");
    expect(priceCatalogMigration).toContain("is_approved_stripe_price");
    expect(priceCatalogMigration).toContain("price identity does not match product");
    expect(priceCatalogMigration).toContain("price interval does not match product");
    expect(priceCatalogMigration).not.toMatch(/insert into public\.stripe_price_catalog[\s\S]*price_[a-z]+/i);
    expect(priceCatalogRenderer).toContain("process.env[environmentKey]");
    expect(priceCatalogRenderer).toContain("foundingMonthly");
    expect(priceCatalogRenderer).toContain("grandfathered");
    expect(priceCatalogRenderer).not.toContain("price_monthly");
  });
});
