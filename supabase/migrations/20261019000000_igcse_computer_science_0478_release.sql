begin;

-- Register IGCSE Computer Science 0478 (bank_igcse_computer_science_0478) on the same terms as the
-- other released IGCSE banks: sold as a single bank, included in All Access and custom bundles.
-- No Stripe object is created and no Stripe price id is embedded: catalog rows are copied from the
-- already-approved generic bank_igcse rows. Every object below is copied from its latest
-- definition with the new product or slug added next to Co-ordinated Sciences 0654:
--   products_known_id, confirm_billing_checkout       20261007000000_lifetime_all_access.sql
--   apply_stripe_subscription_event                    20260926000004_stripe_sync_fencing.sql
--   confirm_addon_billing_checkout                     20260925000000_add_bank_subscriptions.sql
--   bank and product checks, is_valid_custom_bank_ids  20260915090000_igcse_coordinated_sciences_0654_release.sql

alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bank_ib_economics_hl', 'bank_ib_economics_sl',
  'bank_igcse_biology_0610', 'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620',
  'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bank_igcse_computer_science_0478',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics',
  'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom', 'lifetime_all_access'
));

insert into public.products (id, name, active) values
  ('bank_igcse_computer_science_0478', 'IGCSE Computer Science 0478', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

create or replace function public.is_valid_custom_bank_ids(p_selected_bank_ids text[])
returns boolean language sql immutable set search_path = '' as $$
  select p_selected_bank_ids is not null
    and cardinality(p_selected_bank_ids) between 1 and 5
    and cardinality(p_selected_bank_ids) = cardinality(array(select distinct x from unnest(p_selected_bank_ids) x))
    and not exists (select 1 from unnest(p_selected_bank_ids) x where x is null or x not in (
      'igcse','igcse-additional','ib-hl','ib-sl','ib-ai-hl','ib-ai-sl',
      'ib-chemistry-hl','ib-chemistry-sl','ib-physics-hl','ib-physics-sl',
      'ib-biology-hl','ib-biology-sl','ib-economics-hl','ib-economics-sl',
      'igcse-biology-0610','igcse-economics-0455','igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654','igcse-computer-science-0478'));
$$;
alter table public.saved_questions drop constraint if exists saved_questions_bank;
alter table public.saved_questions add constraint saved_questions_bank check (bank_slug in (
  'igcse','igcse-additional','ib-hl','ib-sl','ib-ai-hl','ib-ai-sl','ib-chemistry-hl','ib-chemistry-sl',
  'ib-physics-hl','ib-physics-sl','ib-biology-hl','ib-biology-sl','ib-economics-hl','ib-economics-sl',
  'igcse-biology-0610','igcse-economics-0455','igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654','igcse-computer-science-0478'
));

alter table public.attempts drop constraint if exists attempts_bank;
alter table public.attempts add constraint attempts_bank check (bank_slug in (
  'igcse','igcse-additional','ib-hl','ib-sl','ib-ai-hl','ib-ai-sl','ib-chemistry-hl','ib-chemistry-sl',
  'ib-physics-hl','ib-physics-sl','ib-biology-hl','ib-biology-sl','ib-economics-hl','ib-economics-sl',
  'igcse-biology-0610','igcse-economics-0455','igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654','igcse-computer-science-0478'
));

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_product check (product_id in (
  'bank_igcse','bank_igcse_additional','bank_ib_hl','bank_ib_sl','bank_ib_ai_hl','bank_ib_ai_sl',
  'bank_ib_chemistry_hl','bank_ib_chemistry_sl','bank_ib_physics_hl','bank_ib_physics_sl',
  'bank_ib_biology_hl','bank_ib_biology_sl','bank_ib_economics_hl','bank_ib_economics_sl',
  'bank_igcse_biology_0610','bank_igcse_economics_0455','bank_igcse_chemistry_0620','bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bank_igcse_computer_science_0478','bundle_igcse','bundle_ib_aa','bundle_ib_ai',
  'bundle_ib_chemistry','bundle_ib_physics','bundle_ib_biology','bundle_ib_economics','bundle_all','bundle_custom'
));

alter table public.stripe_price_catalog drop constraint if exists stripe_price_catalog_product_id_check;
alter table public.stripe_price_catalog add constraint stripe_price_catalog_product_id_check check (product_id in (
  'bank_igcse','bank_igcse_additional','bank_ib_hl','bank_ib_sl','bank_ib_ai_hl','bank_ib_ai_sl',
  'bank_ib_chemistry_hl','bank_ib_chemistry_sl','bank_ib_physics_hl','bank_ib_physics_sl',
  'bank_ib_biology_hl','bank_ib_biology_sl','bank_ib_economics_hl','bank_ib_economics_sl',
  'bank_igcse_biology_0610','bank_igcse_economics_0455','bank_igcse_chemistry_0620','bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bank_igcse_computer_science_0478','bundle_igcse','bundle_ib_aa','bundle_ib_ai',
  'bundle_ib_chemistry','bundle_ib_physics','bundle_ib_biology','bundle_ib_economics','bundle_all','bundle_custom'
));

insert into public.stripe_price_catalog (price_id, product_id, billing_interval, grandfathered, active)
select source.price_id, 'bank_igcse_computer_science_0478', source.billing_interval, source.grandfathered, source.active
from public.stripe_price_catalog source
where source.product_id = 'bank_igcse'
on conflict (price_id, product_id, billing_interval) do update set
  grandfathered = excluded.grandfathered,
  active = excluded.active,
  updated_at = now();

create or replace function public.confirm_addon_billing_checkout(
  p_user_id uuid, p_intent_id uuid, p_product_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bank_slug text;
  v_bundle_product text;
  v_affected integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or p_intent_id is null or p_product_id is null or p_product_id not in (
    'bank_igcse', 'bank_igcse_additional', 'bank_igcse_biology_0610',
    'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620',
    'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bank_igcse_computer_science_0478',
    'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
    'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl',
    'bank_ib_physics_hl', 'bank_ib_physics_sl',
    'bank_ib_biology_hl', 'bank_ib_biology_sl',
    'bank_ib_economics_hl', 'bank_ib_economics_sl'
  ) then
    raise exception 'invalid add-on checkout request';
  end if;
  v_bank_slug := replace(substr(p_product_id, 6), '_', '-');
  v_bundle_product := case
    when v_bank_slug like 'igcse%' then 'bundle_igcse'
    when v_bank_slug in ('ib-hl', 'ib-sl') then 'bundle_ib_aa'
    when v_bank_slug in ('ib-ai-hl', 'ib-ai-sl') then 'bundle_ib_ai'
    when v_bank_slug in ('ib-chemistry-hl', 'ib-chemistry-sl') then 'bundle_ib_chemistry'
    when v_bank_slug in ('ib-physics-hl', 'ib-physics-sl') then 'bundle_ib_physics'
    when v_bank_slug in ('ib-biology-hl', 'ib-biology-sl') then 'bundle_ib_biology'
    when v_bank_slug in ('ib-economics-hl', 'ib-economics-sl') then 'bundle_ib_economics'
  end;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if exists (
    select 1 from public.entitlements e
    where e.user_id = p_user_id
      and e.status in ('active', 'trialing') and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
      and (e.product_id in (p_product_id, v_bundle_product, 'bundle_all')
        or (e.product_id = 'bundle_custom' and v_bank_slug = any(e.selected_bank_ids)))
  ) or exists (
    select 1 from public.stripe_subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'trialing') and s.starts_at <= now()
      and s.expires_at > now()
      and (s.product_id in (p_product_id, v_bundle_product, 'bundle_all')
        or (s.product_id = 'bundle_custom' and v_bank_slug = any(s.selected_bank_ids)))
  ) then return false; end if;

  update public.billing_checkout_reservations
  set expires_at = now() + interval '10 minutes', updated_at = now()
  where user_id = p_user_id and intent_id = p_intent_id and expires_at > now();
  get diagnostics v_affected = row_count;
  return v_affected = 1;
end;
$$;
create or replace function public.confirm_billing_checkout(p_user_id uuid, p_intent_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare affected_rows integer; has_current_access boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'server-only function' using errcode = '42501'; end if;
  if p_user_id is null or p_intent_id is null then raise exception 'invalid checkout reservation'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select exists(select 1 from public.entitlements e where e.user_id = p_user_id
    and e.product_id in ('bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
      'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl', 'bank_ib_biology_hl', 'bank_ib_biology_sl',
      'bank_ib_economics_hl', 'bank_ib_economics_sl', 'bank_igcse_biology_0610', 'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620',
      'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bank_igcse_computer_science_0478', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
      'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom', 'lifetime_all_access')
    and e.status in ('active', 'trialing') and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now())) into has_current_access;
  if has_current_access then return false; end if;
  update public.billing_checkout_reservations set expires_at = now() + interval '10 minutes', updated_at = now()
    where user_id = p_user_id and intent_id = p_intent_id and expires_at > now();
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
      'bank_igcse_biology_0610', 'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620', 'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bank_igcse_computer_science_0478', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
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
    select 1 from public.get_checkout_price_catalog(p_price_id) c
    where c.price_id = p_price_id and c.product_id = p_product_id
      and c.billing_interval = p_interval and (c.active or c.grandfathered)
  ) then
    raise exception 'price identity or interval does not match product';
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
commit;
