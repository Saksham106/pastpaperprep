-- Pepper credits: a weekly allowance by plan (resets Monday 00:00 UTC), one-time credit packs, and a charge ledger so
-- every refund goes back exactly once to the week, day and pack it came from. Forward change after the v2 daily RPCs.
-- Every function is service role only: the server derives the plan's weekly credits and the message cost from the
-- signed-in user's entitlements, so a client can never pick its own allowance.
begin;

-- Credits spent per user per week. week_start is a Monday (UTC).
create table if not exists public.helper_usage_weekly (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  credits_used integer not null default 0 check (credits_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- Credits spent per user per UTC day, plan and packs together: the abuse guard (1,000 a day).
create table if not exists public.helper_credits_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  credits_used integer not null default 0 check (credits_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.helper_credit_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id text not null check (pack_id in ('credits_1000', 'credits_3000')),
  credits_total integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0 and credits_remaining <= credits_total),
  status text not null default 'active' check (status in ('active', 'revoked')),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  purchased_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists helper_credit_packs_user_active_idx on public.helper_credit_packs (user_id, expires_at) where status = 'active';

-- One row per charged message. Refunds name the row, so each is given back once, to where it was taken from.
create table if not exists public.helper_credit_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  usage_date date not null,
  plan_credits integer not null check (plan_credits >= 0),
  pack_id uuid references public.helper_credit_packs (id) on delete cascade,
  pack_credits integer not null check (pack_credits >= 0),
  global_counted boolean not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  check (plan_credits + pack_credits > 0),
  check ((pack_credits = 0) = (pack_id is null))
);
create index if not exists helper_credit_charges_user_idx on public.helper_credit_charges (user_id, created_at);

-- A refund or dispute can arrive before the pack is credited; this keeps that payment from ever being credited.
create table if not exists public.helper_pack_revoked_payments (
  payment_intent_id text primary key,
  reason text not null check (reason in ('refunded', 'disputed')),
  revoked_at timestamptz not null default now()
);

alter table public.helper_usage_weekly enable row level security;
alter table public.helper_credits_daily enable row level security;
alter table public.helper_credit_packs enable row level security;
alter table public.helper_credit_charges enable row level security;
alter table public.helper_pack_revoked_payments enable row level security;
revoke all on table public.helper_usage_weekly, public.helper_credits_daily, public.helper_credit_packs,
  public.helper_credit_charges, public.helper_pack_revoked_payments from public, anon, authenticated, service_role;

-- Students read their own balance (the panel and /account); nobody writes except through the functions below.
drop policy if exists helper_usage_weekly_select_own on public.helper_usage_weekly;
create policy helper_usage_weekly_select_own on public.helper_usage_weekly for select to authenticated
  using (user_id = (select auth.uid()));
grant select (user_id, week_start, credits_used) on public.helper_usage_weekly to authenticated;

drop policy if exists helper_credit_packs_select_own on public.helper_credit_packs;
create policy helper_credit_packs_select_own on public.helper_credit_packs for select to authenticated
  using (user_id = (select auth.uid()));
grant select (id, user_id, pack_id, credits_total, credits_remaining, status, purchased_at, expires_at) on public.helper_credit_packs to authenticated;

-- {"status": "ok", "charge_id", "week_start", "plan_left", "pack_left"} | {"status": "limit", "reason": "week" | "day", ...}
-- | {"status": "busy"} | {"status": "disabled"}. Nothing is spent unless the status is "ok".
-- The week's plan credits go first; whatever a message still needs comes from one pack, oldest expiry first. Pack-paid
-- messages are prepaid, so they skip the site-wide daily cap; when the cap is full a pack pays for the whole message.
create or replace function public.consume_helper_credits(p_user_id uuid, p_weekly_credits integer, p_cost integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'utc')::date;
  v_week date := date_trunc('week', v_now at time zone 'utc')::date;
  v_daily_guard constant integer := 1000;
  v_enabled boolean;
  v_global_limit integer;
  v_week_used integer;
  v_day_used integer;
  v_pack_left integer;
  v_plan_left integer;
  v_plan_part integer;
  v_pack_part integer;
  v_pack uuid;
  v_global integer;
  v_global_counted boolean := false;
  v_rows integer;
  v_charge uuid;
begin
  if p_user_id is null or p_weekly_credits is null or p_cost is null
     or p_weekly_credits < 0 or p_weekly_credits > 100000 or p_cost < 1 or p_cost > 100 then
    raise exception 'invalid helper credit charge' using errcode = '22023';
  end if;

  select enabled, global_daily_limit into v_enabled, v_global_limit from public.helper_settings where id;
  if not coalesce(v_enabled, false) then
    return jsonb_build_object('status', 'disabled');
  end if;

  -- Every writer of this user's credits (consume, release) takes this lock, so reads below stay true until commit.
  perform pg_advisory_xact_lock(hashtextextended('helper_credits:' || p_user_id::text, 0));

  select coalesce((select credits_used from public.helper_usage_weekly where user_id = p_user_id and week_start = v_week), 0) into v_week_used;
  select coalesce((select credits_used from public.helper_credits_daily where user_id = p_user_id and usage_date = v_day), 0) into v_day_used;
  select coalesce(sum(credits_remaining), 0)::integer into v_pack_left from public.helper_credit_packs
    where user_id = p_user_id and status = 'active' and expires_at > v_now;
  v_plan_left := greatest(p_weekly_credits - v_week_used, 0);

  if v_day_used + p_cost > v_daily_guard then
    return jsonb_build_object('status', 'limit', 'reason', 'day', 'week_start', v_week, 'plan_left', v_plan_left, 'pack_left', v_pack_left);
  end if;

  v_plan_part := least(p_cost, v_plan_left);
  v_pack_part := p_cost - v_plan_part;

  if v_pack_part > 0 then
    select id into v_pack from public.helper_credit_packs
      where user_id = p_user_id and status = 'active' and expires_at > v_now and credits_remaining >= v_pack_part
      order by expires_at, purchased_at, id limit 1 for update;
    if v_pack is null then
      return jsonb_build_object('status', 'limit', 'reason', 'week', 'week_start', v_week, 'plan_left', v_plan_left, 'pack_left', v_pack_left);
    end if;
  end if;

  if v_plan_part > 0 then
    if coalesce(v_global_limit, 0) >= 1 then
      insert into public.helper_global_daily (usage_date, message_count, updated_at)
      values (v_day, 1, v_now)
      on conflict (usage_date) do update
      set message_count = helper_global_daily.message_count + 1, updated_at = v_now
      where helper_global_daily.message_count + 1 <= v_global_limit
      returning message_count into v_global;
    end if;
    if v_global is null then
      -- Site-wide cap reached: a pack can still pay for the whole message.
      select id into v_pack from public.helper_credit_packs
        where user_id = p_user_id and status = 'active' and expires_at > v_now and credits_remaining >= p_cost
        order by expires_at, purchased_at, id limit 1 for update;
      if v_pack is null then
        return jsonb_build_object('status', 'busy');
      end if;
      v_plan_part := 0;
      v_pack_part := p_cost;
    else
      v_global_counted := true;
    end if;
  end if;

  if v_plan_part > 0 then
    insert into public.helper_usage_weekly (user_id, week_start, credits_used, updated_at)
    values (p_user_id, v_week, v_plan_part, v_now)
    on conflict (user_id, week_start) do update
    set credits_used = helper_usage_weekly.credits_used + v_plan_part, updated_at = v_now;
  end if;

  if v_pack_part > 0 then
    update public.helper_credit_packs
    set credits_remaining = credits_remaining - v_pack_part
    where id = v_pack and user_id = p_user_id and status = 'active' and credits_remaining >= v_pack_part;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'helper credit pack changed during charge' using errcode = '40001';
    end if;
  end if;

  insert into public.helper_credits_daily (user_id, usage_date, credits_used, updated_at)
  values (p_user_id, v_day, p_cost, v_now)
  on conflict (user_id, usage_date) do update
  set credits_used = helper_credits_daily.credits_used + p_cost, updated_at = v_now;

  insert into public.helper_credit_charges (user_id, week_start, usage_date, plan_credits, pack_id, pack_credits, global_counted)
  values (p_user_id, v_week, v_day, v_plan_part, case when v_pack_part > 0 then v_pack end, v_pack_part, v_global_counted)
  returning id into v_charge;

  return jsonb_build_object(
    'status', 'ok', 'charge_id', v_charge, 'week_start', v_week,
    'plan_left', v_plan_left - v_plan_part, 'pack_left', v_pack_left - v_pack_part
  );
end;
$$;

-- Gives one charged message back, once, to the week, day and pack it was taken from. A revoked pack stays empty.
create or replace function public.release_helper_credits(p_user_id uuid, p_charge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.helper_credit_charges%rowtype;
begin
  if p_user_id is null or p_charge_id is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('helper_credits:' || p_user_id::text, 0));

  update public.helper_credit_charges
  set released_at = now()
  where id = p_charge_id and user_id = p_user_id and released_at is null
  returning * into v_charge;
  if not found then
    return false;
  end if;

  if v_charge.plan_credits > 0 then
    update public.helper_usage_weekly
    set credits_used = greatest(credits_used - v_charge.plan_credits, 0), updated_at = now()
    where user_id = p_user_id and week_start = v_charge.week_start;
  end if;
  update public.helper_credits_daily
  set credits_used = greatest(credits_used - (v_charge.plan_credits + v_charge.pack_credits), 0), updated_at = now()
  where user_id = p_user_id and usage_date = v_charge.usage_date;
  if v_charge.pack_credits > 0 then
    update public.helper_credit_packs
    set credits_remaining = least(credits_remaining + v_charge.pack_credits, credits_total)
    where id = v_charge.pack_id and user_id = p_user_id and status = 'active';
  end if;
  if v_charge.global_counted then
    update public.helper_global_daily
    set message_count = greatest(message_count - 1, 0), updated_at = now()
    where usage_date = v_charge.usage_date;
  end if;
  return true;
end;
$$;

-- Credits a paid pack once per Checkout Session. Returns 'credited', 'duplicate' or 'revoked' (refunded or disputed
-- before it was credited). The pack catalogue is checked here as well as in the webhook.
create or replace function public.credit_helper_pack(
  p_user_id uuid, p_pack_id text, p_credits integer, p_session_id text, p_payment_intent_id text,
  p_amount_cents integer, p_currency text, p_purchased_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_existing public.helper_credit_packs%rowtype;
begin
  if p_user_id is null or p_session_id is null or p_payment_intent_id is null or p_purchased_at is null
     or p_currency is distinct from 'usd'
     or not ((p_pack_id = 'credits_1000' and p_credits = 1000 and p_amount_cents = 499)
          or (p_pack_id = 'credits_3000' and p_credits = 3000 and p_amount_cents = 1299)) then
    raise exception 'invalid helper credit pack' using errcode = '22023';
  end if;
  if exists (select 1 from public.helper_pack_revoked_payments where payment_intent_id = p_payment_intent_id) then
    return 'revoked';
  end if;

  insert into public.helper_credit_packs (user_id, pack_id, credits_total, credits_remaining, stripe_checkout_session_id,
    stripe_payment_intent_id, amount_cents, currency, purchased_at, expires_at)
  values (p_user_id, p_pack_id, p_credits, p_credits, p_session_id, p_payment_intent_id, p_amount_cents, p_currency,
    p_purchased_at, p_purchased_at + interval '12 months')
  on conflict (stripe_checkout_session_id) do nothing
  returning id into v_id;
  if v_id is not null then
    return 'credited';
  end if;

  select * into v_existing from public.helper_credit_packs where stripe_checkout_session_id = p_session_id;
  if v_existing.user_id is distinct from p_user_id or v_existing.stripe_payment_intent_id is distinct from p_payment_intent_id
     or v_existing.pack_id is distinct from p_pack_id then
    raise exception 'helper credit pack session mismatch' using errcode = '23505';
  end if;
  return 'duplicate';
end;
$$;

-- A refunded or disputed pack payment: its unused credits go, and it can never be credited later.
create or replace function public.revoke_helper_pack(p_payment_intent_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_payment_intent_id is null or p_reason is null or p_reason not in ('refunded', 'disputed') then
    raise exception 'invalid helper pack revocation' using errcode = '22023';
  end if;
  insert into public.helper_pack_revoked_payments (payment_intent_id, reason)
  values (p_payment_intent_id, p_reason)
  on conflict (payment_intent_id) do nothing;
  update public.helper_credit_packs
  set status = 'revoked', credits_remaining = 0, revoked_at = now()
  where stripe_payment_intent_id = p_payment_intent_id and status = 'active';
end;
$$;

alter function public.consume_helper_credits(uuid, integer, integer) owner to postgres;
alter function public.release_helper_credits(uuid, uuid) owner to postgres;
alter function public.credit_helper_pack(uuid, text, integer, text, text, integer, text, timestamptz) owner to postgres;
alter function public.revoke_helper_pack(text, text) owner to postgres;
revoke all on function public.consume_helper_credits(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.release_helper_credits(uuid, uuid) from public, anon, authenticated;
revoke all on function public.credit_helper_pack(uuid, text, integer, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_helper_pack(text, text) from public, anon, authenticated;
grant execute on function public.consume_helper_credits(uuid, integer, integer) to service_role;
grant execute on function public.release_helper_credits(uuid, uuid) to service_role;
grant execute on function public.credit_helper_pack(uuid, text, integer, text, text, integer, text, timestamptz) to service_role;
grant execute on function public.revoke_helper_pack(text, text) to service_role;

-- The v2 daily-message RPCs stay as they are until the Pepper previews built on them are gone; the app no longer
-- calls them, and they only ever counted a caller's own messages.

notify pgrst, 'reload schema';
commit;
