begin;

alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_all'
));

insert into public.products (id, name, active) values
  ('bundle_igcse', 'Cambridge IGCSE Mathematics pair', true),
  ('bundle_ib_aa', 'IB Mathematics AA pair', true),
  ('bundle_ib_ai', 'IB Mathematics AI pair', true)
on conflict (id) do update set name = excluded.name;

create table if not exists public.billing_checkout_reservations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  intent_id uuid not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_checkout_reservations enable row level security;
revoke all on table public.billing_checkout_reservations from public, anon, authenticated, service_role;

create or replace function public.reserve_billing_checkout(p_user_id uuid, p_intent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or p_intent_id is null then
    raise exception 'invalid checkout reservation';
  end if;

  insert into public.billing_checkout_reservations (user_id, intent_id, expires_at)
  values (p_user_id, p_intent_id, now() + interval '10 minutes')
  on conflict (user_id) do update
  set intent_id = excluded.intent_id,
      expires_at = excluded.expires_at,
      updated_at = now()
  where public.billing_checkout_reservations.expires_at <= now();
  get diagnostics affected_rows = row_count;

  return affected_rows = 1;
end;
$$;

create or replace function public.release_billing_checkout(p_user_id uuid, p_intent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or p_intent_id is null then
    raise exception 'invalid checkout reservation';
  end if;

  delete from public.billing_checkout_reservations
  where user_id = p_user_id and intent_id = p_intent_id;
  get diagnostics affected_rows = row_count;

  return affected_rows = 1;
end;
$$;

create or replace function public.confirm_billing_checkout(p_user_id uuid, p_intent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
  has_current_access boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or p_intent_id is null then
    raise exception 'invalid checkout reservation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.product_id in (
        'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
        'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_all'
      )
      and e.status in ('active', 'trialing')
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  ) into has_current_access;

  if has_current_access then
    return false;
  end if;

  update public.billing_checkout_reservations
  set expires_at = now() + interval '10 minutes', updated_at = now()
  where user_id = p_user_id
    and intent_id = p_intent_id
    and expires_at > now();
  get diagnostics affected_rows = row_count;

  return affected_rows = 1;
end;
$$;

create or replace function public.block_manual_entitlement_during_checkout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source <> 'manual'
    or new.status not in ('active', 'trialing')
    or new.starts_at > now()
    or (new.expires_at is not null and new.expires_at <= now())
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));

  if exists (
    select 1
    from public.billing_checkout_reservations r
    where r.user_id = new.user_id and r.expires_at > now()
  ) then
    raise exception 'manual entitlement conflicts with active checkout reservation'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists block_manual_entitlement_during_checkout on public.entitlements;
create trigger block_manual_entitlement_during_checkout
before insert or update on public.entitlements
for each row execute function public.block_manual_entitlement_during_checkout();

create or replace function public.claim_stripe_customer(p_user_id uuid, p_customer_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_user_id uuid;
  mapped_customer_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or nullif(btrim(p_customer_id), '') is null then
    raise exception 'invalid Stripe customer claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  insert into public.stripe_customers (user_id, customer_id)
  values (p_user_id, p_customer_id)
  on conflict do nothing;

  select sc.user_id into mapped_user_id
  from public.stripe_customers sc
  where sc.customer_id = p_customer_id;

  select sc.customer_id into mapped_customer_id
  from public.stripe_customers sc
  where sc.user_id = p_user_id;

  if mapped_user_id is not null and mapped_user_id is distinct from p_user_id then
    raise exception 'Stripe customer mapping mismatch';
  end if;
  if mapped_customer_id is null then
    raise exception 'Stripe customer claim failed';
  end if;

  return mapped_customer_id;
end;
$$;

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_product check (product_id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_all'
));

create or replace function public.refresh_stripe_entitlement(
  p_user_id uuid,
  p_product_id text,
  p_fallback_starts_at timestamptz,
  p_fallback_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_entitlement_source text;
  existing_entitlement_status text;
  existing_entitlement_starts_at timestamptz;
  existing_entitlement_expires_at timestamptz;
  entitlement_status text;
  entitlement_starts_at timestamptz;
  entitlement_expires_at timestamptz;
  entitlement_source_reference text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;

  select e.source, e.status, e.starts_at, e.expires_at
  into existing_entitlement_source, existing_entitlement_status,
       existing_entitlement_starts_at, existing_entitlement_expires_at
  from public.entitlements e
  where e.user_id = p_user_id and e.product_id = p_product_id;

  if existing_entitlement_source = 'manual'
    and existing_entitlement_status in ('active', 'trialing')
    and existing_entitlement_starts_at <= now()
    and (existing_entitlement_expires_at is null or existing_entitlement_expires_at > now())
  then
    return;
  end if;

  select ss.status, ss.starts_at, ss.expires_at, ss.subscription_id
  into entitlement_status, entitlement_starts_at, entitlement_expires_at, entitlement_source_reference
  from public.stripe_subscriptions ss
  where ss.user_id = p_user_id
    and ss.product_id = p_product_id
    and ss.status in ('active', 'trialing')
    and ss.starts_at <= now()
    and ss.expires_at > now()
  order by ss.expires_at desc
  limit 1;

  if entitlement_status is null then
    entitlement_status := 'revoked';
    entitlement_starts_at := p_fallback_starts_at;
    entitlement_expires_at := null;
    entitlement_source_reference := p_fallback_reference;
  end if;

  insert into public.entitlements (
    user_id, product_id, status, starts_at, expires_at, source, source_reference
  ) values (
    p_user_id, p_product_id, entitlement_status, entitlement_starts_at,
    entitlement_expires_at, 'stripe', entitlement_source_reference
  )
  on conflict (user_id, product_id) do update
  set status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      source = excluded.source,
      source_reference = excluded.source_reference,
      updated_at = now();
end;
$$;

create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_event_created bigint,
  p_subscription_id text,
  p_customer_id text,
  p_user_id uuid,
  p_product_id text,
  p_status text,
  p_starts_at timestamptz,
  p_expires_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_customer_id text;
  previous_product_id text;
  inserted_events integer;
  applied_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null
    or nullif(btrim(p_customer_id), '') is null
    or p_product_id not in (
      'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
      'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_all'
    )
    or p_status not in ('active', 'trialing', 'revoked')
    or p_event_id is null
    or p_subscription_id is null
    or p_customer_id is null
    or p_event_created <= 0
    or p_starts_at is null
    or (p_status in ('active', 'trialing') and (p_expires_at is null or p_expires_at <= p_starts_at))
  then
    raise exception 'invalid Stripe subscription event';
  end if;

  mapped_customer_id := public.claim_stripe_customer(p_user_id, p_customer_id);
  if mapped_customer_id is distinct from p_customer_id then
    raise exception 'Stripe customer mapping mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  insert into public.stripe_webhook_events (event_id, event_created)
  values (p_event_id, p_event_created)
  on conflict (event_id) do nothing;
  get diagnostics inserted_events = row_count;
  if inserted_events = 0 then return 'duplicate'; end if;

  select ss.product_id into previous_product_id
  from public.stripe_subscriptions ss
  where ss.subscription_id = p_subscription_id;

  insert into public.stripe_subscriptions (
    subscription_id, customer_id, user_id, product_id, status, starts_at, expires_at,
    last_event_id, last_event_created
  ) values (
    p_subscription_id, p_customer_id, p_user_id, p_product_id, p_status, p_starts_at, p_expires_at,
    p_event_id, p_event_created
  )
  on conflict (subscription_id) do update
  set customer_id = excluded.customer_id,
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      last_event_id = excluded.last_event_id,
      last_event_created = excluded.last_event_created,
      updated_at = now()
  where excluded.last_event_created >= public.stripe_subscriptions.last_event_created;
  get diagnostics applied_rows = row_count;
  if applied_rows = 0 then return 'stale'; end if;

  if previous_product_id is not null and previous_product_id is distinct from p_product_id then
    perform public.refresh_stripe_entitlement(
      p_user_id, previous_product_id, p_starts_at, p_subscription_id
    );
  end if;
  perform public.refresh_stripe_entitlement(p_user_id, p_product_id, p_starts_at, p_subscription_id);

  return 'applied';
end;
$$;

create or replace function public.invalidate_stripe_subscription_event(
  p_event_id text,
  p_event_created bigint,
  p_subscription_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_user_id uuid;
  subscription_product_id text;
  subscription_starts_at timestamptz;
  inserted_events integer;
  applied_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if nullif(btrim(p_event_id), '') is null
    or nullif(btrim(p_subscription_id), '') is null
    or p_event_created <= 0
  then
    raise exception 'invalid Stripe invalidation event';
  end if;

  select ss.user_id, ss.product_id, ss.starts_at
  into subscription_user_id, subscription_product_id, subscription_starts_at
  from public.stripe_subscriptions ss
  where ss.subscription_id = p_subscription_id;

  if subscription_user_id is null then return 'unknown'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(subscription_user_id::text, 0));

  insert into public.stripe_webhook_events (event_id, event_created)
  values (p_event_id, p_event_created)
  on conflict (event_id) do nothing;
  get diagnostics inserted_events = row_count;
  if inserted_events = 0 then return 'duplicate'; end if;

  update public.stripe_subscriptions
  set status = 'revoked',
      expires_at = null,
      last_event_id = p_event_id,
      last_event_created = p_event_created,
      updated_at = now()
  where subscription_id = p_subscription_id
    and p_event_created >= last_event_created;
  get diagnostics applied_rows = row_count;
  if applied_rows = 0 then return 'stale'; end if;

  perform public.refresh_stripe_entitlement(
    subscription_user_id, subscription_product_id, subscription_starts_at, p_subscription_id
  );
  return 'revoked';
end;
$$;

create or replace function public.get_stripe_customer_id(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  mapped_customer_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'invalid user';
  end if;

  select sc.customer_id into mapped_customer_id
  from public.stripe_customers sc
  where sc.user_id = p_user_id;

  return mapped_customer_id;
end;
$$;

revoke all on function public.get_stripe_customer_id(uuid) from public, anon, authenticated;
grant execute on function public.get_stripe_customer_id(uuid) to service_role;

revoke all on function public.reserve_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_billing_checkout(uuid, uuid) to service_role;

revoke all on function public.release_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_billing_checkout(uuid, uuid) to service_role;

revoke all on function public.confirm_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_billing_checkout(uuid, uuid) to service_role;

revoke all on function public.block_manual_entitlement_during_checkout()
from public, anon, authenticated, service_role;

revoke all on function public.claim_stripe_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_customer(uuid, text) to service_role;

revoke all on function public.refresh_stripe_entitlement(uuid, text, timestamptz, text)
from public, anon, authenticated, service_role;

revoke all on function public.invalidate_stripe_subscription_event(text, bigint, text)
from public, anon, authenticated;
grant execute on function public.invalidate_stripe_subscription_event(text, bigint, text) to service_role;

revoke all on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)
to service_role;

notify pgrst, 'reload schema';

commit;
