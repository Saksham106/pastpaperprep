-- Add IB Physics HL/SL and the Physics subject pair.
-- This migration is intentionally not applied by repository tooling.
begin;

alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl',
  'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_all'
));

alter table public.saved_questions drop constraint if exists saved_questions_bank;
alter table public.saved_questions add constraint saved_questions_bank
  check (bank_slug in ('igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl', 'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl'));

alter table public.attempts drop constraint if exists attempts_bank;
alter table public.attempts add constraint attempts_bank
  check (bank_slug in ('igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl', 'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl'));

insert into public.products (id, name, active) values
  ('bank_ib_physics_hl', 'IB Physics HL', true),
  ('bank_ib_physics_sl', 'IB Physics SL', true),
  ('bundle_ib_physics', 'IB Physics pair', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_product check (product_id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl',
  'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_all'
));

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
        'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl',
        'bank_ib_physics_hl', 'bank_ib_physics_sl',
        'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_all'
      )
      and e.status in ('active', 'trialing')
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  ) into has_current_access;

  if has_current_access then return false; end if;

  update public.billing_checkout_reservations
  set expires_at = now() + interval '10 minutes', updated_at = now()
  where user_id = p_user_id
    and intent_id = p_intent_id
    and expires_at > now();
  get diagnostics affected_rows = row_count;

  return affected_rows = 1;
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
      'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl',
      'bank_ib_physics_hl', 'bank_ib_physics_sl',
      'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_all'
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
    perform public.refresh_stripe_entitlement(p_user_id, previous_product_id, p_starts_at, p_subscription_id);
  end if;
  perform public.refresh_stripe_entitlement(p_user_id, p_product_id, p_starts_at, p_subscription_id);

  return 'applied';
end;
$$;

revoke all on function public.confirm_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_billing_checkout(uuid, uuid) to service_role;
revoke all on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)
to service_role;

notify pgrst, 'reload schema';
commit;
