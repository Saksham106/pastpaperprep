-- Replace direct Stripe customer table access with tightly scoped server RPCs.
revoke all on table public.stripe_customers from anon, authenticated, service_role;

create or replace function public.get_stripe_customer_id(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select customer_id
  from public.stripe_customers
  where user_id = p_user_id;
$$;

create or replace function public.upsert_stripe_customer(
  p_user_id uuid,
  p_customer_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or nullif(btrim(p_customer_id), '') is null then
    raise exception 'invalid Stripe customer mapping';
  end if;

  insert into public.stripe_customers (user_id, customer_id)
  values (p_user_id, p_customer_id)
  on conflict (user_id) do update
  set customer_id = excluded.customer_id;
end;
$$;

revoke all on function public.get_stripe_customer_id(uuid) from public, anon, authenticated;
revoke all on function public.upsert_stripe_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.get_stripe_customer_id(uuid) to service_role;
grant execute on function public.upsert_stripe_customer(uuid, text) to service_role;
