-- Referral MVP ledger. Apply manually after review; never deploy this migration automatically.
create table if not exists public.referral_partners (
  code text primary key check (code ~ '^[a-z0-9_-]{2,40}$'),
  display_name text not null,
  commission_bps integer not null default 3000 check (commission_bps between 0 and 10000),
  owner_email text check (owner_email = lower(trim(owner_email)) and owner_email like '%@%'),
  active boolean not null default false,
  check (not active or owner_email is not null),
  created_at timestamptz not null default now()
);
insert into public.referral_partners (code, display_name, active) values ('pietro', 'Pietro', false) on conflict (code) do nothing;

create table if not exists public.referral_attributions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  partner_code text not null references public.referral_partners(code),
  attributed_at timestamptz not null default now(),
  source text not null default 'cookie' check (source in ('cookie','checkout'))
);

create table if not exists public.referral_commissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  partner_code text not null references public.referral_partners(code),
  stripe_invoice_id text not null unique,
  stripe_subscription_id text not null,
  stripe_invoice_payment_id text,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  gross_collected_cents bigint not null check (gross_collected_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  commission_cents bigint not null check (commission_cents >= 0),
  paid_commission_cents bigint not null default 0 check (paid_commission_cents >= 0 and paid_commission_cents <= commission_cents),
  settled_adjustment_cents bigint not null default 0 check (settled_adjustment_cents >= 0 and settled_adjustment_cents <= commission_cents),
  state text not null default 'pending' check (state in ('pending','adjusted','paid')),
  payout_month date,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.referral_adjustments (
  id bigint generated always as identity primary key,
  commission_id bigint not null references public.referral_commissions(id),
  stripe_refund_id text unique,
  stripe_dispute_id text,
  amount_cents bigint not null,
  reason text not null check (reason in ('refund','dispute','dispute_won','dispute_lost')),
  created_at timestamptz not null default now(),
  unique (stripe_dispute_id, reason),
  check (stripe_refund_id is not null or stripe_dispute_id is not null),
  check ((reason = 'dispute_won' and amount_cents < 0 and stripe_dispute_id is not null)
      or (reason <> 'dispute_won' and amount_cents >= 0))
);

create table if not exists public.referral_payout_batches (
  id bigint generated always as identity primary key,
  partner_code text not null references public.referral_partners(code),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  payout_month date not null,
  net_cents bigint not null check (net_cents >= 0),
  external_reference text not null check (length(trim(external_reference)) between 3 and 160),
  recorded_at timestamptz not null default now(),
  unique (partner_code, currency, payout_month),
  unique (partner_code, currency, external_reference)
);

alter table public.referral_partners enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.referral_adjustments enable row level security;
alter table public.referral_payout_batches enable row level security;
revoke all on public.referral_partners, public.referral_attributions, public.referral_commissions, public.referral_adjustments, public.referral_payout_batches from public, anon, authenticated;
grant select on public.referral_partners, public.referral_attributions, public.referral_commissions, public.referral_adjustments, public.referral_payout_batches to service_role;
grant insert on public.referral_attributions, public.referral_commissions, public.referral_adjustments to service_role;
grant update on public.referral_adjustments to service_role;
-- No client policies: writes/reads are service-role-only; authenticated clients cannot forge attribution or payout state.

-- Bind only after authentication. Canonical auth identity, partner ownership,
-- signup time and billing history are checked in the same statement as insert.
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
  insert into public.referral_attributions(user_id, partner_code, attributed_at, source)
  select u.id, p.code, p_attributed_at, 'cookie'
  from auth.users u
  join public.referral_partners p on p.code = p_partner_code and p.active = true
  where u.id = p_user_id and u.created_at >= p_attributed_at
    and u.email is not null and lower(u.email) <> lower(p.owner_email)
    and not exists (select 1 from public.stripe_subscriptions ss where ss.user_id = u.id)
  on conflict do nothing
  returning user_id into v_inserted;
  return v_inserted is not null;
end;
$$;
revoke all on function public.bind_new_referral_attribution(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.bind_new_referral_attribution(uuid,text,timestamptz) to service_role;

-- Only server-verified Stripe webhooks may create a commission. The unique user
-- and invoice constraints make replays and concurrent deliveries idempotent.
create or replace function public.record_first_referral_commission(
  p_user_id uuid, p_partner_code text, p_invoice_id text, p_subscription_id text,
  p_customer_id text, p_invoice_payment_id text, p_paid_at timestamptz,
  p_currency text, p_gross_cents bigint, p_tax_cents bigint,
  p_discount_cents bigint, p_commission_cents bigint
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_attributed_at timestamptz;
  v_created_at timestamptz;
  v_rows integer;
begin
  if p_user_id is null or p_paid_at is null or p_invoice_id !~ '^in_[A-Za-z0-9]+$'
    or p_subscription_id !~ '^sub_[A-Za-z0-9]+$' or p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_invoice_payment_id !~ '^inpay_[A-Za-z0-9]+$'
    or p_currency !~ '^[a-z]{3}$' or p_gross_cents <= 0 or p_tax_cents < 0
    or p_discount_cents < 0 or p_commission_cents <= 0 or p_commission_cents > p_gross_cents
  then
    raise exception 'invalid referral commission';
  end if;

  select a.attributed_at, u.created_at into v_attributed_at, v_created_at
  from public.referral_attributions a
  join auth.users u on u.id = a.user_id
  join public.referral_partners p on p.code = a.partner_code and p.active = true
  where a.user_id = p_user_id and a.partner_code = p_partner_code
    and u.email is not null and lower(u.email) <> lower(p.owner_email);
  if v_attributed_at is null or v_created_at < v_attributed_at
    or p_paid_at < v_attributed_at or p_paid_at > v_attributed_at + interval '30 days'
    or not exists (select 1 from public.stripe_customers sc
                   where sc.user_id = p_user_id and sc.customer_id = p_customer_id)
    or exists (select 1 from public.stripe_subscriptions ss
               where ss.user_id = p_user_id and ss.subscription_id <> p_subscription_id)
  then
    return 'ineligible';
  end if;

  insert into public.referral_commissions (
    user_id, partner_code, stripe_invoice_id, stripe_subscription_id,
    stripe_invoice_payment_id, currency, gross_collected_cents, tax_cents,
    discount_cents, commission_cents
  ) values (
    p_user_id, p_partner_code, p_invoice_id, p_subscription_id,
    p_invoice_payment_id, p_currency, p_gross_cents, p_tax_cents,
    p_discount_cents, p_commission_cents
  ) on conflict do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'recorded' else 'duplicate' end;
end;
$$;
revoke all on function public.record_first_referral_commission(uuid,text,text,text,text,text,timestamptz,text,bigint,bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.record_first_referral_commission(uuid,text,text,text,text,text,timestamptz,text,bigint,bigint,bigint,bigint) to service_role;

-- Show only unsettled amounts. A late refund after payout becomes a negative
-- carry-forward; winning a disputed payment can create a later positive credit.
create or replace function public.referral_monthly_payout_report(p_month date)
returns table(partner_code text, currency text, commission_cents bigint, adjustment_cents bigint, net_cents bigint)
language sql security definer set search_path = '' as $$
  select c.partner_code, c.currency,
         sum(c.commission_cents - c.paid_commission_cents)::bigint,
         sum(least(c.commission_cents, greatest(0, coalesce(adjusted.amount_cents, 0))) - c.settled_adjustment_cents)::bigint,
         sum(c.commission_cents - c.paid_commission_cents
           - (least(c.commission_cents, greatest(0, coalesce(adjusted.amount_cents, 0))) - c.settled_adjustment_cents))::bigint
  from public.referral_commissions c
  left join lateral (
    select sum(a.amount_cents) as amount_cents
    from public.referral_adjustments a
    where a.commission_id = c.id
  ) adjusted on true
  where c.created_at + interval '30 days' < date_trunc('month', p_month) + interval '1 month'
  group by c.partner_code, c.currency
  having sum(c.commission_cents - c.paid_commission_cents) <> 0
      or sum(least(c.commission_cents, greatest(0, coalesce(adjusted.amount_cents, 0))) - c.settled_adjustment_cents) <> 0;
$$;
revoke all on function public.referral_monthly_payout_report(date) from public, anon, authenticated;
grant execute on function public.referral_monthly_payout_report(date) to service_role;

-- Call ONLY after an operator sends/verifies the external transfer. The expected
-- net protects against a changed report; commission rows lock adjustment inserts.
create or replace function public.mark_referral_payout(
  p_month date, p_partner_code text, p_currency text, p_expected_net bigint,
  p_external_reference text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_net bigint;
  v_reference text;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date
    or date_trunc('month', p_month) + interval '1 month' > now()
    or p_expected_net is null or p_expected_net < 0
    or length(trim(coalesce(p_external_reference, ''))) not between 3 and 160 then
    raise exception 'invalid or premature payout month/net/reference';
  end if;
  select b.net_cents, b.external_reference into v_net, v_reference
    from public.referral_payout_batches b
    where b.partner_code = p_partner_code and b.currency = p_currency and b.payout_month = p_month;
  if found then
    if v_net = p_expected_net and v_reference = p_external_reference then return v_net; end if;
    raise exception 'payout batch already recorded with different transfer evidence';
  end if;
  perform 1 from public.referral_commissions c
    where c.partner_code = p_partner_code and c.currency = p_currency
      and c.created_at + interval '30 days' < date_trunc('month', p_month) + interval '1 month'
    for update;
  select r.net_cents into v_net
    from public.referral_monthly_payout_report(p_month) r
    where r.partner_code = p_partner_code and r.currency = p_currency;
  if v_net is null or v_net <> p_expected_net then
    raise exception 'payout changed since it was reviewed';
  end if;
  insert into public.referral_payout_batches(partner_code, currency, payout_month, net_cents, external_reference)
    values (p_partner_code, p_currency, p_month, v_net, p_external_reference);
  update public.referral_commissions c
  set paid_commission_cents = c.commission_cents,
      settled_adjustment_cents = least(c.commission_cents, greatest(0, coalesce((
        select sum(a.amount_cents) from public.referral_adjustments a where a.commission_id = c.id
      ), 0))),
      payout_month = p_month,
      state = 'paid'
  where c.partner_code = p_partner_code and c.currency = p_currency
    and c.created_at + interval '30 days' < date_trunc('month', p_month) + interval '1 month';
  return v_net;
end;
$$;
revoke all on function public.mark_referral_payout(date,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.mark_referral_payout(date,text,text,bigint,text) to service_role;
