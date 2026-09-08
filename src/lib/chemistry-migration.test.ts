import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260907000000_add_ib_chemistry_banks.sql"),
  "utf8",
);

const productIds = [
  "bank_ib_chemistry_hl",
  "bank_ib_chemistry_sl",
  "bundle_ib_chemistry",
];

describe("IB Chemistry billing migration", () => {
  it("adds Chemistry products and both bank constraints", () => {
    expect(migration).toContain("alter table public.products drop constraint if exists products_known_id");
    expect(migration).toContain("alter table public.saved_questions drop constraint if exists saved_questions_bank");
    expect(migration).toContain("alter table public.attempts drop constraint if exists attempts_bank");
    for (const productId of productIds) expect(migration).toContain(productId);
    expect(migration).toContain("ib-chemistry-hl");
    expect(migration).toContain("ib-chemistry-sl");
  });

  it("keeps checkout and webhook allowlists server-only and Chemistry-aware", () => {
    expect(migration).toContain("function public.confirm_billing_checkout");
    expect(migration).toContain("function public.apply_stripe_subscription_event");
    expect(migration).toContain("auth.role()");
    expect(migration).toContain("server-only function");
    expect(migration).toContain("grant execute on function public.confirm_billing_checkout(uuid, uuid) to service_role");
    expect(migration).toContain("grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("documents preview upload as a required pre-deploy gate", () => {
    const script = readFileSync(join(process.cwd(), "scripts/reconcile-supabase-assets.ts"), "utf8");
    expect(script).toContain("--sync-missing-previews");
    expect(script).toContain("uploadToSignedUrl");
    expect(script).toContain("missingPreviewAfterSync");
  });
});
