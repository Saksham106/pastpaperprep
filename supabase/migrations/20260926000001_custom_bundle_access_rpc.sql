begin;

-- Stripe custom bundles are independent subscription grants. Keep them out of
-- the one-row-per-user entitlements projection and expose only current grants.
create or replace function public.get_custom_bundle_access(p_user_id uuid)
returns table (
  product_id text,
  selected_bank_ids text[],
  status text,
  starts_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'user id is required' using errcode = '22004';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and (coalesce(auth.role(), '') <> 'authenticated' or auth.uid() is distinct from p_user_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select s.product_id, s.selected_bank_ids, s.status, s.starts_at, s.expires_at
  from public.stripe_subscriptions as s
  where s.user_id = p_user_id
    and s.product_id = 'bundle_custom'
    and s.status in ('active', 'trialing')
    and s.starts_at <= pg_catalog.now()
    and s.expires_at > pg_catalog.now()
    and public.is_valid_custom_bank_ids(s.selected_bank_ids);
end;
$$;

revoke all on function public.get_custom_bundle_access(uuid) from public, anon;
grant execute on function public.get_custom_bundle_access(uuid) to authenticated, service_role;
-- Deliberately grant no table privileges on stripe_subscriptions.
notify pgrst, 'reload schema';
commit;