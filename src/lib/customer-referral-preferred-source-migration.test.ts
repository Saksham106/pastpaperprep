import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261019010000_customer_referral_preferred_source_bonus.sql"), "utf8");

describe("preferred source referral bonus migration", () => {
  it("lets only the signed-in link owner claim once", () => {
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(sql).toMatch(/where user_id = v_user_id and preferred_source_bonus_at is null/);
    expect(sql).toMatch(/revoke all on function public\.claim_customer_referral_preferred_source_bonus\(\) from public, anon, service_role/);
    expect(sql).toMatch(/grant execute on function public\.claim_customer_referral_preferred_source_bonus\(\) to authenticated/);
  });

  it("counts the bonus as one signup in the milestone guard", () => {
    expect(sql).toMatch(/select v_verified \+ count\(\*\) into v_verified from public\.customer_referral_links/);
    expect(sql).toMatch(/v_verified < new\.milestone_index \* 5/);
  });
});
