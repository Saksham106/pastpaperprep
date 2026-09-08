import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20260909000000_add_ib_biology_banks.sql");
const reconciliationPath = join(process.cwd(), "scripts/reconcile-supabase-assets.ts");
const productIds = ["bank_ib_biology_hl", "bank_ib_biology_sl", "bundle_ib_biology"];

describe("IB Biology billing migration", () => {
  it("adds Biology products and both bank constraints", () => {
    expect(existsSync(migrationPath), `${migrationPath} must exist`).toBe(true);
    if (!existsSync(migrationPath)) return;
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("alter table public.products drop constraint if exists products_known_id");
    expect(migration).toContain("alter table public.saved_questions drop constraint if exists saved_questions_bank");
    expect(migration).toContain("alter table public.attempts drop constraint if exists attempts_bank");
    for (const productId of productIds) expect(migration).toContain(productId);
    expect(migration).toContain("ib-biology-hl");
    expect(migration).toContain("ib-biology-sl");
    for (const productId of productIds) {
      expect(migration.match(new RegExp(productId, "g"))?.length).toBe(5);
    }
  });

  it("preserves service-role-only checkout and webhook RPC definitions", () => {
    if (!existsSync(migrationPath)) return;
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("create or replace function public.confirm_billing_checkout");
    expect(migration).toContain("create or replace function public.apply_stripe_subscription_event");
    expect(migration).toContain("auth.role()");
    expect(migration).toContain("server-only function");
    expect(migration).toContain("grant execute on function public.confirm_billing_checkout(uuid, uuid) to service_role");
    expect(migration).toContain("grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)");
    expect(migration).toContain("notify pgrst, 'reload schema'");
    const reconciliation = readFileSync(reconciliationPath, "utf8");
    expect(reconciliation).toContain("upsert: false");
    expect(reconciliation).toContain("No objects were deleted or overwritten.");
  });
});
