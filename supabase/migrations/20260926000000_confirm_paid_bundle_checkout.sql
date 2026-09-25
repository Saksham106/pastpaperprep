begin;

-- Record the explicit All Access overlap acknowledgement against the checkout intent.
create table if not exists public.paid_bundle_checkout_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null,
  product_id text not null check (product_id in ('bundle_custom', 'bundle_all')),
  selected_bank_ids text[] not null,
  acknowledged boolean not null check (acknowledged),
  created_at timestamptz not null default now(),
  primary key (user_id, intent_id)
);
alter table public.paid_bundle_checkout_consents enable row level security;
revoke all on table public.paid_bundle_checkout_consents from public, anon, authenticated, service_role;

create or replace function public.confirm_paid_bundle_billing_checkout(
  p_user_id uuid,
  p_intent_id uuid,
  p_product_id text,
  p_selected_bank_ids text[],
  p_acknowledged boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affected integer;
  v_bundle_product text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or p_intent_id is null or p_product_id is null
    or p_product_id not in ('bundle_custom', 'bundle_all')
    or p_acknowledged is distinct from true then
    raise exception 'invalid paid bundle checkout request';
  end if;
  if p_product_id = 'bundle_custom' then
    if not public.is_valid_custom_bank_ids(p_selected_bank_ids)
      or cardinality(p_selected_bank_ids) not between 2 and 5 then
      raise exception 'custom bundle requires 2-5 unique allowed banks';
    end if;
  elsif p_selected_bank_ids is null or cardinality(p_selected_bank_ids) <> 0 then
    raise exception 'All Access requires an empty selected bank list';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if p_product_id = 'bundle_all' then
    if exists (
      select 1 from public.entitlements e
      where e.user_id = p_user_id and e.product_id = 'bundle_all'
        and e.status in ('active', 'trialing') and e.starts_at <= now()
        and (e.expires_at is null or e.expires_at > now())
    ) or exists (
      select 1 from public.stripe_subscriptions s
      where s.user_id = p_user_id and s.product_id = 'bundle_all'
        and s.status in ('active', 'trialing') and s.starts_at <= now()
        and (s.expires_at is null or s.expires_at > now())
    ) then
      return false;
    end if;
  else
    select case
      when x.bank_id like 'igcse%' then 'bundle_igcse'
      when x.bank_id in ('ib-hl', 'ib-sl') then 'bundle_ib_aa'
      when x.bank_id in ('ib-ai-hl', 'ib-ai-sl') then 'bundle_ib_ai'
      when x.bank_id in ('ib-chemistry-hl', 'ib-chemistry-sl') then 'bundle_ib_chemistry'
      when x.bank_id in ('ib-physics-hl', 'ib-physics-sl') then 'bundle_ib_physics'
      when x.bank_id in ('ib-biology-hl', 'ib-biology-sl') then 'bundle_ib_biology'
      when x.bank_id in ('ib-economics-hl', 'ib-economics-sl') then 'bundle_ib_economics'
    end into v_bundle_product
    from unnest(p_selected_bank_ids) x(bank_id)
    limit 1;

    if exists (
      select 1 from public.entitlements e
      where e.user_id = p_user_id and e.status in ('active', 'trialing')
        and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now())
        and (e.product_id = 'bundle_all'
          or e.product_id in (select case
            when x.bank_id like 'igcse%' then 'bundle_igcse'
            when x.bank_id in ('ib-hl', 'ib-sl') then 'bundle_ib_aa'
            when x.bank_id in ('ib-ai-hl', 'ib-ai-sl') then 'bundle_ib_ai'
            when x.bank_id in ('ib-chemistry-hl', 'ib-chemistry-sl') then 'bundle_ib_chemistry'
            when x.bank_id in ('ib-physics-hl', 'ib-physics-sl') then 'bundle_ib_physics'
            when x.bank_id in ('ib-biology-hl', 'ib-biology-sl') then 'bundle_ib_biology'
            when x.bank_id in ('ib-economics-hl', 'ib-economics-sl') then 'bundle_ib_economics' end
            from unnest(p_selected_bank_ids) x(bank_id))
          or (e.product_id = 'bundle_custom' and e.selected_bank_ids && p_selected_bank_ids)
          or exists (select 1 from unnest(p_selected_bank_ids) x(bank_id)
            where e.product_id = 'bank_' || replace(x.bank_id, '-', '_')))
    ) or exists (
      select 1 from public.stripe_subscriptions s
      where s.user_id = p_user_id and s.status in ('active', 'trialing')
        and s.starts_at <= now() and (s.expires_at is null or s.expires_at > now())
        and (s.product_id = 'bundle_all'
          or (s.product_id = 'bundle_custom' and s.selected_bank_ids && p_selected_bank_ids)
          or s.product_id in (select case
            when x.bank_id like 'igcse%' then 'bundle_igcse'
            when x.bank_id in ('ib-hl','ib-sl') then 'bundle_ib_aa'
            when x.bank_id in ('ib-ai-hl','ib-ai-sl') then 'bundle_ib_ai'
            when x.bank_id in ('ib-chemistry-hl','ib-chemistry-sl') then 'bundle_ib_chemistry'
            when x.bank_id in ('ib-physics-hl','ib-physics-sl') then 'bundle_ib_physics'
            when x.bank_id in ('ib-biology-hl','ib-biology-sl') then 'bundle_ib_biology'
            when x.bank_id in ('ib-economics-hl','ib-economics-sl') then 'bundle_ib_economics' end
            from unnest(p_selected_bank_ids) x(bank_id))
          or exists (select 1 from unnest(p_selected_bank_ids) x(bank_id)
            where s.product_id = 'bank_' || replace(x.bank_id, '-', '_')))
    ) then
      return false;
    end if;
  end if;

  update public.billing_checkout_reservations
    set expires_at = now() + interval '10 minutes', updated_at = now()
    where user_id = p_user_id and intent_id = p_intent_id and expires_at > now();
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then return false; end if;

  insert into public.paid_bundle_checkout_consents
    (user_id, intent_id, product_id, selected_bank_ids, acknowledged)
  values (p_user_id, p_intent_id, p_product_id, p_selected_bank_ids, p_acknowledged)
  on conflict (user_id, intent_id) do update
    set product_id = excluded.product_id,
        selected_bank_ids = excluded.selected_bank_ids,
        acknowledged = excluded.acknowledged,
        created_at = now();
  return true;
end;
$$;

revoke all on function public.confirm_paid_bundle_billing_checkout(uuid, uuid, text, text[], boolean) from public, anon, authenticated;
grant execute on function public.confirm_paid_bundle_billing_checkout(uuid, uuid, text, text[], boolean) to service_role;
notify pgrst, 'reload schema';
commit;
