import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826194645_add_bank_based_pricing.sql"),
  "utf8",
);

describe("bank-based pricing migration", () => {
  it("retains the webhook-owned atomic customer claim", () => {
    expect(migration).toContain("insert into public.stripe_customers");
    expect(migration).toContain("mapped_customer_id");
    expect(migration).toContain("Stripe customer mapping mismatch");
  });

  it("serializes customer claims and product transitions for each user", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("hashtextextended(p_user_id::text, 0)");
  });

  it("keeps the webhook RPC server-only", () => {
    expect(migration).toContain("auth.role()");
    expect(migration).toContain("server-only function");
  });

  it("replaces both product constraints deterministically on every replay", () => {
    expect(migration).toContain("alter table public.products drop constraint if exists products_known_id");
    expect(migration).toContain("alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product");
    const checks = [...migration.matchAll(/add constraint (?:products_known_id|stripe_subscriptions_product) check \([\s\S]*?\n\)\);/g)]
      .map((match) => match[0]);
    expect(checks).toHaveLength(2);
    for (const productId of [
      "bank_igcse",
      "bank_igcse_additional",
      "bank_ib_hl",
      "bank_ib_sl",
      "bank_ib_ai_hl",
      "bank_ib_ai_sl",
      "bundle_igcse",
      "bundle_ib_aa",
      "bundle_ib_ai",
      "bundle_all",
    ]) {
      expect(checks.every((check) => check.includes(productId))).toBe(true);
    }
  });

  it("restores a service-role-only customer lookup RPC used by Checkout and Portal", () => {
    expect(migration).toContain("function public.get_stripe_customer_id");
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toContain("grant execute on function public.get_stripe_customer_id(uuid) to service_role");
    expect(migration).toContain("revoke all on function public.get_stripe_customer_id(uuid) from public, anon, authenticated");
  });

  it("reloads the PostgREST schema after replacing billing RPCs", () => {
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("serializes independent Checkout intents with service-role-only reservations", () => {
    expect(migration).toContain("create table if not exists public.billing_checkout_reservations");
    expect(migration).toContain("function public.reserve_billing_checkout");
    expect(migration).toContain("function public.release_billing_checkout");
    expect(migration).toContain("on conflict (user_id) do update");
    expect(migration).toContain("billing_checkout_reservations.expires_at <= now()");
    expect(migration).toContain("grant execute on function public.reserve_billing_checkout(uuid, uuid) to service_role");
    expect(migration).toContain("grant execute on function public.release_billing_checkout(uuid, uuid) to service_role");
    expect(migration).toContain("function public.confirm_billing_checkout");
    expect(migration).toContain("grant execute on function public.confirm_billing_checkout(uuid, uuid) to service_role");
  });

  it("coordinates final Checkout eligibility with manual entitlement writes", () => {
    expect(migration).toContain("pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0))");
    expect(migration).toContain("from public.entitlements e");
    expect(migration).toContain("e.status in ('active', 'trialing')");
    expect(migration).toContain("function public.block_manual_entitlement_during_checkout");
    expect(migration).toContain("create trigger block_manual_entitlement_during_checkout");
    expect(migration).toContain("active checkout reservation");
  });

  it("atomically claims the canonical customer and repairs product transitions", () => {
    expect(migration).toContain("function public.claim_stripe_customer");
    expect(migration).toContain("grant execute on function public.claim_stripe_customer(uuid, text) to service_role");
    expect(migration).toContain("previous_product_id");
    expect(migration).toContain("refresh_stripe_entitlement");
    expect(migration).toContain("function public.invalidate_stripe_subscription_event");
    expect(migration).toContain("grant execute on function public.invalidate_stripe_subscription_event(text, bigint, text) to service_role");
    expect(migration).toContain("existing_entitlement_source = 'manual'");
  });
});