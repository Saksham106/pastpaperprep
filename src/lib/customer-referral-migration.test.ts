import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260926000005_customer_referral_pilot.sql"), "utf8");

describe("customer referral pilot migration", () => {
  it("keeps customer links and attributions apart from tutor commissions", () => {
    expect(sql).toMatch(/create table public\.customer_referral_links/i);
    expect(sql).toMatch(/create table public\.customer_referral_attributions/i);
    expect(sql).toMatch(/user_id uuid primary key references auth\.users\(id\)/i);
    expect(sql).toMatch(/referrer_user_id uuid not null references auth\.users\(id\)/i);
    expect(sql).not.toMatch(/insert into public\.referral_commissions/i);
  });

  it("binds only a new verified non-self account and excludes existing tutor attribution", () => {
    expect(sql).toMatch(/function public\.bind_new_customer_referral\(/i);
    expect(sql).toMatch(/u\.email_confirmed_at is not null/i);
    expect(sql).toMatch(/u\.created_at >= p_attributed_at/i);
    expect(sql).toMatch(/l\.user_id <> u\.id/i);
    expect(sql).toMatch(/from public\.referral_attributions/i);
    expect(sql).toMatch(/from public\.referral_partners p where p\.active = true and p\.owner_email = lower\(inviter\.email\)/i);
    expect(sql).toMatch(/from public\.stripe_subscriptions/i);
    expect(sql).toMatch(/on conflict do nothing/i);
  });

  it("stores each manually verified grant once with an external credit reference", () => {
    expect(sql).toMatch(/create table public\.customer_referral_awards/i);
    expect(sql).toMatch(/stripe_credit_reference text not null unique/i);
    expect(sql).toMatch(/unique index customer_referral_signup_award_once/i);
    expect(sql).toMatch(/unique index customer_referral_purchase_award_once/i);
  });

  it("will not attach a purchase award to someone else's referred user", () => {
    expect(sql).toMatch(/unique \(user_id, referrer_user_id\)/i);
    expect(sql).toMatch(/foreign key \(referred_user_id, referrer_user_id\) references public\.customer_referral_attributions\(user_id, referrer_user_id\)/i);
  });

  it("requires real five-signup progress before a sequential manual award", () => {
    expect(sql).toMatch(/function public\.validate_customer_referral_award\(/i);
    expect(sql).toMatch(/count\(\*\)[\s\S]*customer_referral_attributions/i);
    expect(sql).toMatch(/new\.milestone_index \* 5/i);
    expect(sql).toMatch(/max\(milestone_index\)/i);
    expect(sql).toMatch(/create trigger customer_referral_award_guard/i);
  });

  it("does not block auth account deletion after a credit was recorded", () => {
    expect(sql).toMatch(/referrer_user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/foreign key \(referred_user_id, referrer_user_id\) references public\.customer_referral_attributions\(user_id, referrer_user_id\) on delete cascade/i);
  });

  it("lets only an authenticated account issue its own link; keeps all progress data service-owned", () => {
    expect(sql).toMatch(/function public\.ensure_customer_referral_link\(p_code text\)/i);
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/grant execute on function public\.ensure_customer_referral_link\(text\) to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.ensure_customer_referral_link\(text\) from public, anon, service_role/i);
    expect(sql).toMatch(/alter table public\.customer_referral_links enable row level security/i);
    expect(sql).toMatch(/alter table public\.customer_referral_attributions enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.customer_referral_links, public\.customer_referral_attributions, public\.customer_referral_awards from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.bind_new_customer_referral\([\s\S]+?to service_role/i);
    expect(sql).not.toMatch(/create policy[\s\S]+?to authenticated/i);
  });
});
