begin;

-- New purchases use one product with graduated Stripe tiers. Existing fixed
-- product IDs remain valid and their entitlements continue to have NULL here.
alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
  'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_all', 'bundle_custom'
));
insert into public.products (id, name, active)
values ('bundle_custom', 'Build Your Plan', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

create or replace function public.is_valid_custom_bank_ids(p_selected_bank_ids text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_selected_bank_ids is not null
    and cardinality(p_selected_bank_ids) between 1 and 5
    and not exists (
      select 1 from unnest(p_selected_bank_ids) as selected(bank_id)
      where selected.bank_id is null
         or selected.bank_id not in (
        'igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl',
        'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl',
        'ib-biology-hl', 'ib-biology-sl'
      )
    )
    and cardinality(p_selected_bank_ids) = cardinality(
      array(select distinct selected.bank_id from unnest(p_selected_bank_ids) as selected(bank_id))
    );
$$;

alter table public.entitlements
  add column if not exists selected_bank_ids text[];
alter table public.entitlements drop constraint if exists entitlements_custom_bank_shape;
alter table public.entitlements add constraint entitlements_custom_bank_shape check (
  (product_id = 'bundle_custom' and public.is_valid_custom_bank_ids(selected_bank_ids))
  or (product_id <> 'bundle_custom' and selected_bank_ids is null)
);

alter table public.stripe_subscriptions
  add column if not exists selected_bank_ids text[],
  add column if not exists quantity integer not null default 1,
  add column if not exists price_id text;
alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_custom_shape;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_custom_shape check (
  (product_id = 'bundle_custom'
    and public.is_valid_custom_bank_ids(selected_bank_ids)
    and quantity = cardinality(selected_bank_ids)
    and nullif(btrim(price_id), '') is not null)
  or (product_id <> 'bundle_custom' and selected_bank_ids is null and quantity = 1)
);
alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_product check (product_id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
  'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_all', 'bundle_custom'
));

-- Add the custom product to the final Checkout eligibility recheck.
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
    select 1 from public.entitlements e
    where e.user_id = p_user_id
      and e.product_id in (
        'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
        'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
        'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
        'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_all', 'bundle_custom'
      )
      and e.status in ('active', 'trialing')
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  ) into has_current_access;
  if has_current_access then return false; end if;
  update public.billing_checkout_reservations
  set expires_at = now() + interval '10 minutes', updated_at = now()
  where user_id = p_user_id and intent_id = p_intent_id and expires_at > now();
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

-- Recreate the refresh function with selected-bank persistence while retaining
-- the existing function's manual-entitlement and grandfathering behavior.
drop function if exists public.refresh_stripe_entitlement(uuid, text, timestamptz, text);
create function public.refresh_stripe_entitlement(
  p_user_id uuid,
  p_product_id text,
  p_fallback_starts_at timestamptz,
  p_fallback_reference text,
  p_selected_bank_ids text[] default null
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
  entitlement_selected_bank_ids text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_product_id = 'bundle_custom' and not public.is_valid_custom_bank_ids(p_selected_bank_ids) then
    raise exception 'Duplicate or unknown custom bank';
  end if;
  select e.source, e.status, e.starts_at, e.expires_at
    into existing_entitlement_source, existing_entitlement_status,
      existing_entitlement_starts_at, existing_entitlement_expires_at
  from public.entitlements e
  where e.user_id = p_user_id and e.product_id = p_product_id;
  if existing_entitlement_source = 'manual'
    and existing_entitlement_status in ('active', 'trialing')
    and existing_entitlement_starts_at <= now()
    and (existing_entitlement_expires_at is null or existing_entitlement_expires_at > now()) then
    return;
  end if;
  select ss.status, ss.starts_at, ss.expires_at, ss.subscription_id, ss.selected_bank_ids
    into entitlement_status, entitlement_starts_at, entitlement_expires_at,
      entitlement_source_reference, entitlement_selected_bank_ids
  from public.stripe_subscriptions ss
  where ss.user_id = p_user_id and ss.product_id = p_product_id
    and ss.status in ('active', 'trialing') and ss.starts_at <= now() and ss.expires_at > now()
  order by ss.expires_at desc limit 1;
  if entitlement_status is null then
    entitlement_status := 'revoked';
    entitlement_starts_at := p_fallback_starts_at;
    entitlement_expires_at := null;
    entitlement_source_reference := p_fallback_reference;
    entitlement_selected_bank_ids := p_selected_bank_ids;
  end if;
  insert into public.entitlements (
    user_id, product_id, selected_bank_ids, status, starts_at, expires_at, source, source_reference
  ) values (
    p_user_id, p_product_id, entitlement_selected_bank_ids, entitlement_status,
    entitlement_starts_at, entitlement_expires_at, 'stripe', entitlement_source_reference
  )
  on conflict (user_id, product_id) do update
  set selected_bank_ids = excluded.selected_bank_ids,
      status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      source = excluded.source,
      source_reference = excluded.source_reference,
      updated_at = now();
end;
$$;

-- Rebind invalid webhook handling to the selected-bank-aware refresh function.
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
  subscription_selected_bank_ids text[];
  inserted_events integer;
  applied_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if nullif(btrim(p_event_id), '') is null
    or nullif(btrim(p_subscription_id), '') is null
    or p_event_created <= 0 then
    raise exception 'invalid Stripe invalidation event';
  end if;
  select ss.user_id, ss.product_id, ss.starts_at, ss.selected_bank_ids
    into subscription_user_id, subscription_product_id, subscription_starts_at, subscription_selected_bank_ids
  from public.stripe_subscriptions ss
  where ss.subscription_id = p_subscription_id;
  if subscription_user_id is null then return 'unknown'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(subscription_user_id::text, 0));
  insert into public.stripe_webhook_events (event_id, event_created)
  values (p_event_id, p_event_created) on conflict (event_id) do nothing;
  get diagnostics inserted_events = row_count;
  if inserted_events = 0 then return 'duplicate'; end if;
  update public.stripe_subscriptions
  set status = 'revoked', expires_at = null, last_event_id = p_event_id,
      last_event_created = p_event_created, updated_at = now()
  where subscription_id = p_subscription_id and p_event_created >= last_event_created;
  get diagnostics applied_rows = row_count;
  if applied_rows = 0 then return 'stale'; end if;
  perform public.refresh_stripe_entitlement(
    subscription_user_id, subscription_product_id, subscription_starts_at,
    p_subscription_id, subscription_selected_bank_ids
  );
  return 'revoked';
end;
$$;

-- The old public signature is dropped so PostgREST cannot select an unsafe
-- overload. Defaults preserve callers that process grandfathered products.
drop function if exists public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz);
create function public.apply_stripe_subscription_event(
  p_event_id text,
  p_event_created bigint,
  p_subscription_id text,
  p_customer_id text,
  p_user_id uuid,
  p_product_id text,
  p_status text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_selected_bank_ids text[] default null,
  p_quantity integer default 1,
  p_price_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_customer_id text;
  previous_product_id text;
  previous_selected_bank_ids text[];
  inserted_events integer;
  applied_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or nullif(btrim(p_customer_id), '') is null
    or p_product_id not in (
      'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
      'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
      'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
      'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_all', 'bundle_custom'
    )
    or p_status not in ('active', 'trialing', 'revoked') or nullif(btrim(p_event_id), '') is null
    or nullif(btrim(p_subscription_id), '') is null or p_event_created <= 0 or p_starts_at is null
    or (p_status in ('active', 'trialing') and (p_expires_at is null or p_expires_at <= p_starts_at))
    or (p_product_id = 'bundle_custom' and (
      not public.is_valid_custom_bank_ids(p_selected_bank_ids)
      or p_quantity <> cardinality(p_selected_bank_ids)
      or nullif(btrim(p_price_id), '') is null
    ))
    or (p_product_id <> 'bundle_custom' and (p_selected_bank_ids is not null or p_quantity <> 1)) then
    raise exception 'invalid Stripe subscription event';
  end if;
  mapped_customer_id := public.claim_stripe_customer(p_user_id, p_customer_id);
  if mapped_customer_id is distinct from p_customer_id then
    raise exception 'Stripe customer mapping mismatch';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  insert into public.stripe_webhook_events (event_id, event_created)
  values (p_event_id, p_event_created) on conflict (event_id) do nothing;
  get diagnostics inserted_events = row_count;
  if inserted_events = 0 then return 'duplicate'; end if;
  select ss.product_id, ss.selected_bank_ids into previous_product_id, previous_selected_bank_ids
  from public.stripe_subscriptions ss where ss.subscription_id = p_subscription_id;
  insert into public.stripe_subscriptions (
    subscription_id, customer_id, user_id, product_id, selected_bank_ids, quantity, price_id,
    status, starts_at, expires_at, last_event_id, last_event_created
  ) values (
    p_subscription_id, p_customer_id, p_user_id, p_product_id, p_selected_bank_ids, p_quantity, p_price_id,
    p_status, p_starts_at, p_expires_at, p_event_id, p_event_created
  )
  on conflict (subscription_id) do update
  set customer_id = excluded.customer_id, user_id = excluded.user_id, product_id = excluded.product_id,
      selected_bank_ids = excluded.selected_bank_ids, quantity = excluded.quantity, price_id = excluded.price_id,
      status = excluded.status, starts_at = excluded.starts_at, expires_at = excluded.expires_at,
      last_event_id = excluded.last_event_id, last_event_created = excluded.last_event_created, updated_at = now()
  where excluded.last_event_created >= public.stripe_subscriptions.last_event_created;
  get diagnostics applied_rows = row_count;
  if applied_rows = 0 then return 'stale'; end if;
  if previous_product_id is not null and previous_product_id is distinct from p_product_id then
    perform public.refresh_stripe_entitlement(p_user_id, previous_product_id, p_starts_at, p_subscription_id, previous_selected_bank_ids);
  end if;
  perform public.refresh_stripe_entitlement(p_user_id, p_product_id, p_starts_at, p_subscription_id, p_selected_bank_ids);
  return 'applied';
end;
$$;

revoke all on function public.is_valid_custom_bank_ids(text[]) from public, anon, authenticated, service_role;
revoke all on function public.refresh_stripe_entitlement(uuid, text, timestamptz, text, text[]) from public, anon, authenticated, service_role;
revoke all on function public.confirm_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_billing_checkout(uuid, uuid) to service_role;
revoke all on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text[], integer, text)
from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text[], integer, text)
to service_role;

notify pgrst, 'reload schema';
commit;
