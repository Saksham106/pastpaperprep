begin;

-- Fence every webhook write against the currently-held per-subscription lease.
-- The lease row lock is retained until transaction end, preventing lease replacement
-- between validation and event/subscription mutation.
drop function if exists public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text[], integer, text);
drop function if exists public.invalidate_stripe_subscription_event(text, bigint, text);

create or replace function public.invalidate_stripe_subscription_event(
  p_event_id text,
  p_event_created bigint,
  p_subscription_id text,
  p_lease_token uuid
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
  lease_valid boolean;
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
  if p_lease_token is null then raise exception 'invalid Stripe sync lease' using errcode = '42501'; end if;
  select l.lease_token = p_lease_token and l.expires_at > pg_catalog.clock_timestamp() into lease_valid
  from public.stripe_subscription_sync_leases l
  where l.subscription_id = p_subscription_id
  for update;
  if coalesce(lease_valid, false) is not true then
    raise exception 'Stripe sync lease lost' using errcode = '42501';
  end if;
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

revoke all on function public.invalidate_stripe_subscription_event(text, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.invalidate_stripe_subscription_event(text, bigint, text, uuid) to service_role;

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
  p_interval text,
  p_lease_token uuid,
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
  lease_valid boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or nullif(btrim(p_customer_id), '') is null
    or p_product_id not in (
      'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
      'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
      'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bank_ib_economics_hl', 'bank_ib_economics_sl',
      'bank_igcse_biology_0610', 'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620', 'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
      'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom'
    )
    or p_status not in ('active', 'trialing', 'revoked')
    or nullif(btrim(p_event_id), '') is null
    or nullif(btrim(p_subscription_id), '') is null
    or p_event_created <= 0
    or p_starts_at is null
    or p_interval not in ('monthly', 'annual')
    or nullif(btrim(p_price_id), '') is null
    or p_quantity is null
    or p_quantity < 1
    or (p_status in ('active', 'trialing') and (p_expires_at is null or p_expires_at <= p_starts_at))
    or (p_product_id = 'bundle_custom' and (
      not public.is_valid_custom_bank_ids(p_selected_bank_ids)
      or p_quantity <> cardinality(p_selected_bank_ids)
    ))
    or (p_product_id <> 'bundle_custom' and (p_selected_bank_ids is not null or p_quantity <> 1))
  then
    raise exception 'invalid Stripe subscription event';
  end if;

  if p_lease_token is null then raise exception 'invalid Stripe sync lease' using errcode = '42501'; end if;
  select l.lease_token = p_lease_token and l.expires_at > pg_catalog.clock_timestamp() into lease_valid
  from public.stripe_subscription_sync_leases l
  where l.subscription_id = p_subscription_id
  for update;
  if coalesce(lease_valid, false) is not true then
    raise exception 'Stripe sync lease lost' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.stripe_price_catalog c
    where c.product_id = p_product_id and c.price_id = p_price_id
  ) then
    raise exception 'price identity does not match product';
  end if;
  if not public.is_approved_stripe_price(p_product_id, p_price_id, p_interval) then
    raise exception 'price interval does not match product';
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

  select ss.product_id, ss.selected_bank_ids
    into previous_product_id, previous_selected_bank_ids
  from public.stripe_subscriptions ss
  where ss.subscription_id = p_subscription_id;

  insert into public.stripe_subscriptions (
    subscription_id, customer_id, user_id, product_id, selected_bank_ids,
    quantity, price_id, billing_interval, status, starts_at, expires_at,
    last_event_id, last_event_created
  ) values (
    p_subscription_id, p_customer_id, p_user_id, p_product_id, p_selected_bank_ids,
    p_quantity, p_price_id, p_interval, p_status, p_starts_at, p_expires_at,
    p_event_id, p_event_created
  )
  on conflict (subscription_id) do update
  set customer_id = excluded.customer_id,
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      selected_bank_ids = excluded.selected_bank_ids,
      quantity = excluded.quantity,
      price_id = excluded.price_id,
      billing_interval = excluded.billing_interval,
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
      p_user_id, previous_product_id, p_starts_at, p_subscription_id, previous_selected_bank_ids
    );
  end if;
  perform public.refresh_stripe_entitlement(
    p_user_id, p_product_id, p_starts_at, p_subscription_id, p_selected_bank_ids
  );
  return 'applied';
end;
$$;

revoke all on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, uuid, text[], integer, text) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, uuid, text[], integer, text) to service_role;

notify pgrst, 'reload schema';
commit;
