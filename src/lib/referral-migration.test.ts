import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260924000000_tutor_referrals.sql"), "utf8");

describe("referral payout migration contract", () => {
  it("aggregates adjustments per commission before summing base commission", () => {
    expect(migration).toMatch(/left join lateral\s*\(\s*select\s+sum\(a\.amount_cents\)/i);
    expect(migration).toMatch(/least\(c\.commission_cents,\s*greatest\(0,\s*coalesce\(adjusted\.amount_cents/i);
    expect(migration).not.toMatch(/from referral_commissions c left join referral_adjustments a on a\.commission_id = c\.id/i);
  });

  it("records verified first payments atomically against account attribution and existing subscriptions", () => {
    expect(migration).toMatch(/function public\.record_first_referral_commission\(/i);
    expect(migration).toMatch(/from public\.referral_attributions/i);
    expect(migration).toMatch(/from public\.stripe_customers/i);
    expect(migration).toMatch(/from public\.stripe_subscriptions/i);
    expect(migration).toMatch(/on conflict do nothing/i);
    expect(migration).toMatch(/grant execute on function public\.record_first_referral_commission\([\s\S]+?to service_role/i);
  });

  it("tracks settled payout amounts and late adjustments rather than dropping already-paid commissions", () => {
    expect(migration).toMatch(/paid_commission_cents bigint/i);
    expect(migration).toMatch(/settled_adjustment_cents bigint/i);
    expect(migration).toMatch(/function public\.mark_referral_payout\(/i);
    expect(migration).toMatch(/create table .*public\.referral_payout_batches/i);
    expect(migration).toMatch(/unique \(partner_code, currency, payout_month\)/i);
    expect(migration).toMatch(/external_reference text not null/i);
    expect(migration).toMatch(/c\.commission_cents - c\.paid_commission_cents/i);
  });

  it("keeps seeded partners inactive until owner identity is configured and excludes self-referrals", () => {
    expect(migration).toMatch(/owner_email text/i);
    expect(migration).toMatch(/values \('pietro', 'Pietro', false\)/i);
    expect(migration).toMatch(/lower\(u\.email\) <> lower\(p\.owner_email\)/i);
  });

  it("keeps payout reporting service-role-only and holds commissions for 30 days", () => {
    expect(migration).toMatch(/c\.created_at \+ interval '30 days'/i);
    expect(migration).toMatch(/grant execute on function public\.referral_monthly_payout_report\(date\) to service_role/i);
  });
});
