-- Add-on checkout confirms a new, uncovered single bank without changing the
-- original first-purchase checkout gate or any existing Stripe subscription.
begin;

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
    'bank_igcse_physics_0625', 'bank_igcse_coordinated_sciences_0654',
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

revoke all on function public.confirm_addon_billing_checkout(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_addon_billing_checkout(uuid, uuid, text) to service_role;
commit;
