begin;

create table if not exists public.stripe_subscription_sync_leases (
  subscription_id text primary key,
  lease_token uuid not null,
  expires_at timestamptz not null
);
alter table public.stripe_subscription_sync_leases enable row level security;
revoke all on table public.stripe_subscription_sync_leases from public, anon, authenticated, service_role;

create or replace function public.acquire_stripe_subscription_sync_lease(
  p_subscription_id text, p_lease_token uuid
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if nullif(btrim(p_subscription_id), '') is null or p_lease_token is null then
    raise exception 'invalid Stripe sync lease';
  end if;
  insert into public.stripe_subscription_sync_leases(subscription_id, lease_token, expires_at)
  values (p_subscription_id, p_lease_token, pg_catalog.clock_timestamp() + interval '90 seconds')
  on conflict (subscription_id) do update
  set lease_token = excluded.lease_token, expires_at = excluded.expires_at
  where public.stripe_subscription_sync_leases.expires_at <= pg_catalog.clock_timestamp();
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function public.release_stripe_subscription_sync_lease(
  p_subscription_id text, p_lease_token uuid
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if nullif(btrim(p_subscription_id), '') is null or p_lease_token is null then
    raise exception 'invalid Stripe sync lease';
  end if;
  delete from public.stripe_subscription_sync_leases
  where subscription_id = p_subscription_id and lease_token = p_lease_token;
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

-- Event RPCs are rebound by the subsequent compatibility migration. The lease
-- table is private and lease operations are service-role-only.
revoke all on function public.acquire_stripe_subscription_sync_lease(text, uuid) from public, anon, authenticated;
grant execute on function public.acquire_stripe_subscription_sync_lease(text, uuid) to service_role;
revoke all on function public.release_stripe_subscription_sync_lease(text, uuid) from public, anon, authenticated;
grant execute on function public.release_stripe_subscription_sync_lease(text, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
