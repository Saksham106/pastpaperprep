begin;

alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bank_ib_economics_hl', 'bank_ib_economics_sl',
  'bank_igcse_biology_0610', 'bank_igcse_economics_0455', 'bank_igcse_chemistry_0620',
  'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics',
  'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom', 'lifetime_all_access'
));
insert into public.products (id, name, active)
values ('lifetime_all_access', 'Lifetime All Access', true)
on conflict (id) do update set name = excluded.name, active = true;

-- Include lifetime access in the atomic final checkout eligibility fence.
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
      'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654', 'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai',
      'bundle_ib_chemistry', 'bundle_ib_physics', 'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom', 'lifetime_all_access')
    and e.status in ('active', 'trialing') and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now())) into has_current_access;
  if has_current_access then return false; end if;
  update public.billing_checkout_reservations set expires_at = now() + interval '10 minutes', updated_at = now()
    where user_id = p_user_id and intent_id = p_intent_id and expires_at > now();
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create table public.lifetime_payment_states (
  payment_intent_id text primary key,
  status text not null check (status in ('paid', 'refunded', 'disputed')),
  updated_at timestamptz not null default now()
);
alter table public.lifetime_payment_states enable row level security;
revoke all on public.lifetime_payment_states from public, anon, authenticated;
grant select on public.lifetime_payment_states to service_role;

create table public.lifetime_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id text not null unique,
  payment_intent_id text not null unique,
  amount_cents integer not null check (amount_cents = 29900),
  currency text not null check (currency = 'usd'),
  status text not null check (status in ('paid', 'refunded', 'disputed')),
  purchased_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lifetime_purchases_user_status_idx on public.lifetime_purchases(user_id, status);
alter table public.lifetime_purchases enable row level security;
revoke all on public.lifetime_purchases from public, anon, authenticated;
grant select on public.lifetime_purchases to service_role;

create or replace function public.fulfill_lifetime_purchase(
  p_user_id uuid, p_session_id text, p_payment_intent_id text,
  p_amount_cents integer, p_currency text, p_purchased_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare inserted_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'server-only function' using errcode = '42501'; end if;
  if p_user_id is null or nullif(btrim(p_session_id), '') is null or nullif(btrim(p_payment_intent_id), '') is null
    or p_amount_cents <> 29900 or p_currency <> 'usd' or p_purchased_at is null then
    raise exception 'invalid lifetime payment';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lifetime:' || p_payment_intent_id, 1));
  if exists(select 1 from public.lifetime_payment_states where payment_intent_id = p_payment_intent_id and status in ('refunded', 'disputed')) then
    raise exception 'lifetime payment is not eligible for fulfillment';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  insert into public.lifetime_payment_states(payment_intent_id, status, updated_at)
  values (p_payment_intent_id, 'paid', now()) on conflict (payment_intent_id) do update set status = 'paid', updated_at = now()
  where public.lifetime_payment_states.status = 'paid';
  insert into public.lifetime_purchases(user_id, checkout_session_id, payment_intent_id, amount_cents, currency, status, purchased_at)
  values (p_user_id, p_session_id, p_payment_intent_id, p_amount_cents, p_currency, 'paid', p_purchased_at)
  on conflict do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    if exists(select 1 from public.lifetime_purchases where checkout_session_id = p_session_id and payment_intent_id = p_payment_intent_id and user_id = p_user_id and status = 'paid') then return 'duplicate'; end if;
    raise exception 'lifetime payment identity conflict';
  end if;
  insert into public.entitlements(user_id, product_id, status, starts_at, expires_at, source, source_reference)
  values (p_user_id, 'lifetime_all_access', 'active', p_purchased_at, null, 'stripe', 'lifetime:' || p_payment_intent_id)
  on conflict (user_id, product_id) do update set
    status = 'active', starts_at = least(public.entitlements.starts_at, excluded.starts_at), expires_at = null,
    source = 'stripe', source_reference = excluded.source_reference, updated_at = now()
  where public.entitlements.source <> 'manual';
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then raise exception 'lifetime entitlement conflicts with manual access'; end if;
  return 'applied';
end;
$$;

create or replace function public.revoke_lifetime_purchase(p_payment_intent_id text, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare purchase_user_id uuid; changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'server-only function' using errcode = '42501'; end if;
  if nullif(btrim(p_payment_intent_id), '') is null or p_status not in ('refunded', 'disputed') then raise exception 'invalid lifetime revocation'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lifetime:' || p_payment_intent_id, 1));
  insert into public.lifetime_payment_states(payment_intent_id, status, updated_at) values (p_payment_intent_id, p_status, now())
    on conflict (payment_intent_id) do update set status = case when public.lifetime_payment_states.status = 'refunded' then 'refunded' else excluded.status end, updated_at = now();
  select user_id into purchase_user_id from public.lifetime_purchases where payment_intent_id = p_payment_intent_id;
  if purchase_user_id is null then return 'unknown'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(purchase_user_id::text, 0));
  update public.lifetime_purchases set status = p_status, updated_at = now() where payment_intent_id = p_payment_intent_id and status <> 'refunded';
  get diagnostics changed = row_count;
  if changed = 0 then return 'duplicate'; end if;
  if not exists(select 1 from public.lifetime_purchases where user_id = purchase_user_id and status = 'paid') then
    update public.entitlements set status = 'revoked', source_reference = 'lifetime:' || p_payment_intent_id, updated_at = now()
    where user_id = purchase_user_id and product_id = 'lifetime_all_access' and source = 'stripe';
  end if;
  return 'revoked';
end;
$$;

create or replace function public.restore_lifetime_purchase(p_payment_intent_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare purchase_user_id uuid; changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'server-only function' using errcode = '42501'; end if;
  if nullif(btrim(p_payment_intent_id), '') is null then raise exception 'invalid lifetime restoration'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lifetime:' || p_payment_intent_id, 1));
  update public.lifetime_payment_states set status = 'paid', updated_at = now()
    where payment_intent_id = p_payment_intent_id and status = 'disputed';
  select user_id into purchase_user_id from public.lifetime_purchases where payment_intent_id = p_payment_intent_id and status = 'disputed';
  if purchase_user_id is null then return 'unchanged'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(purchase_user_id::text, 0));
  update public.lifetime_purchases set status = 'paid', updated_at = now()
    where payment_intent_id = p_payment_intent_id and user_id = purchase_user_id and status = 'disputed';
  get diagnostics changed = row_count;
  if changed = 0 then return 'unchanged'; end if;
  insert into public.entitlements(user_id, product_id, status, starts_at, expires_at, source, source_reference)
  select purchase_user_id, 'lifetime_all_access', 'active', p.purchased_at, null, 'stripe', 'lifetime:' || p_payment_intent_id
    from public.lifetime_purchases p where p.payment_intent_id = p_payment_intent_id
  on conflict (user_id, product_id) do update set status = 'active', expires_at = null, source = 'stripe',
    source_reference = excluded.source_reference, updated_at = now()
  where public.entitlements.source <> 'manual';
  get diagnostics changed = row_count;
  if changed = 0 then raise exception 'lifetime restoration conflicts with manual access'; end if;
  return 'restored';
end;
$$;
revoke all on function public.fulfill_lifetime_purchase(uuid, text, text, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.fulfill_lifetime_purchase(uuid, text, text, integer, text, timestamptz) to service_role;
revoke all on function public.revoke_lifetime_purchase(text, text) from public, anon, authenticated;
grant execute on function public.revoke_lifetime_purchase(text, text) to service_role;
revoke all on function public.restore_lifetime_purchase(text) from public, anon, authenticated;
grant execute on function public.restore_lifetime_purchase(text) to service_role;
notify pgrst, 'reload schema';
commit;
