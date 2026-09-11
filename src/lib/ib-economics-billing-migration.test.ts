import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20260911020000_ib_economics_billing_allowlist.sql");

describe("IB Economics billing allowlist migration", () => {
  it("extends custom-bundle validation with the exact Economics bank slugs", () => {
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("create or replace function public.is_valid_custom_bank_ids(p_selected_bank_ids text[])");
    expect(migration).toContain("'ib-economics-hl'");
    expect(migration).toContain("'ib-economics-sl'");
    expect(migration).not.toContain("'ib_hl'");
    expect(migration).not.toContain("'ib_sl'");
  });

  it("preserves every existing bank slug and does not create a new price or deactivate a product", () => {
    const migration = readFileSync(migrationPath, "utf8");
    for (const bankSlug of [
      "igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl",
      "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl",
      "ib-biology-hl", "ib-biology-sl", "ib-economics-hl", "ib-economics-sl",
    ]) expect(migration).toContain(`'${bankSlug}'`);
    expect(migration).not.toMatch(/price_[A-Za-z0-9]{4,}/);
    expect(migration).not.toMatch(/active\s*=\s*false/);
    expect(migration).not.toContain("insert into public.products");
  });

  it("rebinds only the selected-bank constraints and reloads PostgREST", () => {
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("entitlements_custom_bank_shape");
    expect(migration).toContain("stripe_subscriptions_custom_shape");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
