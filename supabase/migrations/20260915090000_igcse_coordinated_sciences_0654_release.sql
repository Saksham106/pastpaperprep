begin;

-- Extend the released IGCSE allowlists with Chemistry 0620, Physics 0625 and
-- Co-ordinated Sciences 0654 while reusing the existing generic single-bank Stripe
-- prices. No Stripe object is created, and no Stripe price id is embedded: the
-- price catalog rows are copied from the already-approved generic bank_igcse rows.
alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bank_ib_economics_hl', 'bank_ib_economics_sl',
  'bank_igcse_biology_0610', 'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620', 'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bundle_igcse', 'bundle_ib_aa',
  'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_ib_economics',
  'bundle_all', 'bundle_custom'
));

insert into public.products (id, name, active) values
  ('bank_igcse_biology_0610', 'IGCSE Biology 0610', true),
  ('bank_igcse_economics_0455', 'IGCSE Economics 0455', true),
  ('bank_igcse_chemistry_0620', 'IGCSE Chemistry 0620', true),
  ('bank_igcse_physics_0625', 'IGCSE Physics 0625', true),
  ('bank_igcse_coordinated_sciences_0654', 'IGCSE Co-ordinated Sciences 0654', true)
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
      'igcse-biology-0610','igcse-economics-0455','igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654'));
$$;

alter table public.saved_questions drop constraint if exists saved_questions_bank;
alter table public.saved_questions add constraint saved_questions_bank check (bank_slug in (
  'igcse','igcse-additional','ib-hl','ib-sl','ib-ai-hl','ib-ai-sl','ib-chemistry-hl','ib-chemistry-sl',
  'ib-physics-hl','ib-physics-sl','ib-biology-hl','ib-biology-sl','ib-economics-hl','ib-economics-sl',
  'igcse-biology-0610','igcse-economics-0455','igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654'
));

alter table public.attempts drop constraint if exists attempts_bank;
alter table public.attempts add constraint attempts_bank check (bank_slug in (
  'igcse','igcse-additional','ib-hl','ib-sl','ib-ai-hl','ib-ai-sl','ib-chemistry-hl','ib-chemistry-sl',
  'ib-physics-hl','ib-physics-sl','ib-biology-hl','ib-biology-sl','ib-economics-hl','ib-economics-sl',
  'igcse-biology-0610','igcse-economics-0455','igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654'
));

alter table public.entitlements drop constraint if exists entitlements_custom_bank_shape;
alter table public.entitlements add constraint entitlements_custom_bank_shape check (
  (product_id = 'bundle_custom' and public.is_valid_custom_bank_ids(selected_bank_ids))
  or (product_id <> 'bundle_custom' and selected_bank_ids is null)
);

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product_id;
alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_product check (product_id in (
  'bank_igcse','bank_igcse_additional','bank_ib_hl','bank_ib_sl','bank_ib_ai_hl','bank_ib_ai_sl',
  'bank_ib_chemistry_hl','bank_ib_chemistry_sl','bank_ib_physics_hl','bank_ib_physics_sl',
  'bank_ib_biology_hl','bank_ib_biology_sl','bank_ib_economics_hl','bank_ib_economics_sl',
  'bank_igcse_biology_0610','bank_igcse_economics_0455','bank_igcse_chemistry_0620','bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654','bundle_igcse','bundle_ib_aa','bundle_ib_ai',
  'bundle_ib_chemistry','bundle_ib_physics','bundle_ib_biology','bundle_ib_economics','bundle_all','bundle_custom'
));

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_custom_shape;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_custom_shape check (
  (product_id = 'bundle_custom'
    and public.is_valid_custom_bank_ids(selected_bank_ids)
    and quantity = cardinality(selected_bank_ids)
    and nullif(btrim(price_id), '') is not null)
  or (product_id <> 'bundle_custom' and selected_bank_ids is null and quantity = 1)
);

alter table public.stripe_price_catalog drop constraint if exists stripe_price_catalog_product_id_check;
alter table public.stripe_price_catalog add constraint stripe_price_catalog_product_id_check check (product_id in (
  'bank_igcse','bank_igcse_additional','bank_ib_hl','bank_ib_sl','bank_ib_ai_hl','bank_ib_ai_sl',
  'bank_ib_chemistry_hl','bank_ib_chemistry_sl','bank_ib_physics_hl','bank_ib_physics_sl',
  'bank_ib_biology_hl','bank_ib_biology_sl','bank_ib_economics_hl','bank_ib_economics_sl',
  'bank_igcse_biology_0610','bank_igcse_economics_0455','bank_igcse_chemistry_0620','bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654','bundle_igcse','bundle_ib_aa','bundle_ib_ai',
  'bundle_ib_chemistry','bundle_ib_physics','bundle_ib_biology','bundle_ib_economics','bundle_all','bundle_custom'
));

insert into public.stripe_price_catalog (price_id, product_id, billing_interval, grandfathered, active)
select source.price_id, release_product.product_id, source.billing_interval, source.grandfathered, source.active
from public.stripe_price_catalog source
cross join (values
  ('bank_igcse_biology_0610'::text),
  ('bank_igcse_economics_0455'::text),
  ('bank_igcse_chemistry_0620'::text),
  ('bank_igcse_physics_0625'::text),
  ('bank_igcse_coordinated_sciences_0654'::text)
) as release_product(product_id)
where source.product_id = 'bank_igcse'
on conflict (price_id, product_id, billing_interval) do update set
  grandfathered = excluded.grandfathered,
  active = excluded.active,
  updated_at = now();

-- Reuse the already-approved generic single-bank prices. No Stripe ID is guessed
-- or embedded here; a missing source catalog remains fail-closed at checkout.

drop function if exists public.apply_stripe_subscription_event(
  text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text[], integer, text
);
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

revoke all on function public.apply_stripe_subscription_event(
  text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text[], integer, text
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, bigint, text, text, uuid, text, text, timestamptz, timestamptz, text, text[], integer, text
) to service_role;

notify pgrst, 'reload schema';
commit;
