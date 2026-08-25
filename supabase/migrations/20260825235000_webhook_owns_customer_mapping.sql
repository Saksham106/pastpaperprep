begin;

-- Keep the established RPC name in PostgREST while separating the previously
-- verified subscription/entitlement state machine from customer claiming.
-- The guard also makes this safe on production, where migrations are applied
-- through the dashboard before the repository migration ledger is connected.
do $migration$
begin
  if to_regprocedure(
    'public.apply_stripe_subscription_event_core(text,bigint,text,text,uuid,text,text,timestamptz,timestamptz)'
  ) is null then
    alter function public.apply_stripe_subscription_event(
      text, bigint, text, text, uuid, text, text, timestamptz, timestamptz
    ) rename to apply_stripe_subscription_event_core;
  end if;
end;
$migration$;

revoke all on function public.apply_stripe_subscription_event_core(
  text, bigint, text, text, uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated, service_role;

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
  mapped_user_id uuid;
  mapped_customer_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if p_user_id is null or nullif(btrim(p_customer_id), '') is null then
    raise exception 'invalid Stripe customer mapping';
  end if;

  -- The unique constraints on both columns make this an atomic, fail-closed
  -- claim. A retry is harmless; a conflicting user/customer pair is rejected.
  insert into public.stripe_customers (user_id, customer_id)
  values (p_user_id, p_customer_id)
  on conflict do nothing;

  select sc.user_id into mapped_user_id
  from public.stripe_customers sc
  where sc.customer_id = p_customer_id;

  select sc.customer_id into mapped_customer_id
  from public.stripe_customers sc
  where sc.user_id = p_user_id;

  if mapped_user_id is distinct from p_user_id
    or mapped_customer_id is distinct from p_customer_id
  then
    raise exception 'Stripe customer mapping mismatch';
  end if;

  return public.apply_stripe_subscription_event_core(
    p_event_id,
    p_event_created,
    p_subscription_id,
    p_customer_id,
    p_user_id,
    p_product_id,
    p_status,
    p_starts_at,
    p_expires_at
  );
end;
$$;

revoke all on function public.apply_stripe_subscription_event(
  text, bigint, text, text, uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, bigint, text, text, uuid, text, text, timestamptz, timestamptz
) to service_role;

-- Checkout and Portal now resolve the exact metadata-bound customer through
-- Stripe. These temporary database helpers are no longer part of the API.
drop function if exists public.get_stripe_customer_id(uuid);
drop function if exists public.upsert_stripe_customer(uuid, text);
revoke all on table public.stripe_customers from anon, authenticated, service_role;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
