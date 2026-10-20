-- One-time referral bonus: an inviter who opens Google's "preferred source" link gets
-- one signup towards their first five-signup milestone. Google gives no confirmation,
-- so this records the click, not the preference. It is worth at most one signup ever.
alter table public.customer_referral_links add column preferred_source_bonus_at timestamptz;

-- Subject comes from the JWT; only an existing link row (created by ensure_customer_referral_link,
-- which already excludes partners and unverified accounts) can claim, and only once.
create or replace function public.claim_customer_referral_preferred_source_bonus()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;
  update public.customer_referral_links set preferred_source_bonus_at = now()
    where user_id = v_user_id and preferred_source_bonus_at is null;
  return exists (select 1 from public.customer_referral_links
    where user_id = v_user_id and preferred_source_bonus_at is not null);
end;
$$;
revoke all on function public.claim_customer_referral_preferred_source_bonus() from public, anon, service_role;
grant execute on function public.claim_customer_referral_preferred_source_bonus() to authenticated;

-- The milestone guard counts the bonus as one signup.
create or replace function public.validate_customer_referral_award()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_verified bigint;
  v_last integer;
begin
  if TG_OP = 'UPDATE' then raise exception 'referral award records are immutable'; end if;
  if new.kind <> 'five_signups' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.referrer_user_id::text, 1));
  select count(*) into v_verified from public.customer_referral_attributions
    where referrer_user_id = new.referrer_user_id;
  select v_verified + count(*) into v_verified from public.customer_referral_links
    where user_id = new.referrer_user_id and preferred_source_bonus_at is not null;
  select coalesce(max(milestone_index), 0) into v_last from public.customer_referral_awards
    where referrer_user_id = new.referrer_user_id and kind = 'five_signups';
  if new.milestone_index <> v_last + 1 or v_verified < new.milestone_index * 5 then
    raise exception 'unearned or out-of-order signup milestone';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_customer_referral_award() from public, anon, authenticated, service_role;
