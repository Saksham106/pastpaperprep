-- Consumer invite pilot. Apply before enabling /invite or /account/referrals.
-- Separate from tutor commission and payout tables; progress rows are service-role-only.
-- The link-creation RPC derives the account from an authenticated JWT.
create table public.customer_referral_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^c_[a-f0-9]{24}$'),
  created_at timestamptz not null default now()
);

create table public.customer_referral_attributions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  source_code text not null references public.customer_referral_links(code),
  attributed_at timestamptz not null,
  verified_at timestamptz not null default now(),
  unique (user_id, referrer_user_id),
  check (user_id <> referrer_user_id)
);
create index customer_referral_attributions_referrer_idx on public.customer_referral_attributions (referrer_user_id);

-- Operator records a reward only AFTER the exact Stripe credit/grant is verified.
-- No background job or customer API can create an award.
create table public.customer_referral_awards (
  id bigint generated always as identity primary key,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('five_signups', 'first_purchase')),
  milestone_index integer,
  referred_user_id uuid,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  stripe_credit_reference text not null unique,
  awarded_at timestamptz not null default now(),
  foreign key (referred_user_id, referrer_user_id) references public.customer_referral_attributions(user_id, referrer_user_id) on delete cascade,
  check ((kind = 'five_signups' and milestone_index > 0 and referred_user_id is null)
      or (kind = 'first_purchase' and milestone_index is null and referred_user_id is not null))
);
create unique index customer_referral_signup_award_once
  on public.customer_referral_awards (referrer_user_id, milestone_index) where kind = 'five_signups';
create unique index customer_referral_purchase_award_once
  on public.customer_referral_awards (referred_user_id) where kind = 'first_purchase';

-- A recorded signup credit cannot outrun real account confirmations or skip a milestone.
-- Purchase credits still require manual Stripe invoice/payment verification.
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
  select coalesce(max(milestone_index), 0) into v_last from public.customer_referral_awards
    where referrer_user_id = new.referrer_user_id and kind = 'five_signups';
  if new.milestone_index <> v_last + 1 or v_verified < new.milestone_index * 5 then
    raise exception 'unearned or out-of-order signup milestone';
  end if;
  return new;
end;
$$;
create trigger customer_referral_award_guard before insert or update
  on public.customer_referral_awards for each row execute function public.validate_customer_referral_award();
revoke all on function public.validate_customer_referral_award() from public, anon, authenticated, service_role;

alter table public.customer_referral_links enable row level security;
alter table public.customer_referral_attributions enable row level security;
alter table public.customer_referral_awards enable row level security;
revoke all on public.customer_referral_links, public.customer_referral_attributions, public.customer_referral_awards from public, anon, authenticated;
grant select on public.customer_referral_links, public.customer_referral_attributions, public.customer_referral_awards to service_role;
-- No authenticated-client policies on the tables: the scoped link RPC is the only client write/read.

create or replace function public.ensure_customer_referral_link(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null or p_code !~ '^c_[a-f0-9]{24}$' then return null; end if;
  -- Commercial partners retain their separate tutor link and commission terms.
  if not exists (
    select 1 from auth.users u where u.id = v_user_id and u.email_confirmed_at is not null
      and not exists (select 1 from public.referral_partners p where p.active = true and p.owner_email = lower(u.email))
  ) then return null; end if;
  insert into public.customer_referral_links(user_id, code) values (v_user_id, p_code)
    on conflict do nothing;
  select code into v_code from public.customer_referral_links where user_id = v_user_id;
  return v_code;
end;
$$;

create or replace function public.bind_new_customer_referral(
  p_user_id uuid, p_code text, p_attributed_at timestamptz
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_inserted uuid;
begin
  if p_user_id is null or p_code !~ '^c_[a-f0-9]{24}$' or p_attributed_at is null
    or p_attributed_at > now() or p_attributed_at < now() - interval '30 days' then return false; end if;
  -- Coordinate with the existing tutor binder: exactly one program may own a new account.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  insert into public.customer_referral_attributions(user_id, referrer_user_id, source_code, attributed_at)
  select u.id, l.user_id, l.code, p_attributed_at
  from auth.users u
  join public.customer_referral_links l on l.code = p_code
  join auth.users inviter on inviter.id = l.user_id
  where u.id = p_user_id and u.email_confirmed_at is not null
    and inviter.email_confirmed_at is not null and l.user_id <> u.id
    and u.created_at >= p_attributed_at
    and lower(u.email) <> lower(inviter.email)
    and not exists (select 1 from public.referral_partners p where p.active = true and p.owner_email = lower(inviter.email))
    and not exists (select 1 from public.referral_attributions a where a.user_id = u.id)
    and not exists (select 1 from public.stripe_subscriptions s where s.user_id = u.id)
  on conflict do nothing
  returning user_id into v_inserted;
  return v_inserted is not null;
end;
$$;

-- Preserve the active partner commission path, adding only the cross-program exclusion
-- and the same account lock so parallel auth callbacks cannot bind both programs.
create or replace function public.bind_new_referral_attribution(
  p_user_id uuid, p_partner_code text, p_attributed_at timestamptz
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_inserted uuid;
begin
  if p_user_id is null or p_attributed_at is null
    or p_attributed_at > now() or p_attributed_at < now() - interval '30 days' then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  insert into public.referral_attributions(user_id, partner_code, attributed_at, source)
  select u.id, p.code, p_attributed_at, 'cookie'
  from auth.users u
  join public.referral_partners p on p.code = p_partner_code and p.active = true
  where u.id = p_user_id and u.created_at >= p_attributed_at
    and u.email is not null and lower(u.email) <> lower(p.owner_email)
    and not exists (select 1 from public.stripe_subscriptions ss where ss.user_id = u.id)
    and not exists (select 1 from public.customer_referral_attributions c where c.user_id = u.id)
  on conflict do nothing
  returning user_id into v_inserted;
  return v_inserted is not null;
end;
$$;

revoke all on function public.ensure_customer_referral_link(text) from public, anon, service_role;
revoke all on function public.bind_new_customer_referral(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.bind_new_referral_attribution(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ensure_customer_referral_link(text) to authenticated;
grant execute on function public.bind_new_customer_referral(uuid,text,timestamptz) to service_role;
grant execute on function public.bind_new_referral_attribution(uuid,text,timestamptz) to service_role;
