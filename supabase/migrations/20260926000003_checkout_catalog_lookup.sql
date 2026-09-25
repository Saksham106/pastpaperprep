begin;

create or replace function public.get_checkout_price_catalog(p_price_id text)
returns table(price_id text, product_id text, billing_interval text, grandfathered boolean, active boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server-only function' using errcode = '42501';
  end if;
  if nullif(btrim(p_price_id), '') is null then
    raise exception 'price id is required';
  end if;
  return query
    select c.price_id, c.product_id, c.billing_interval, c.grandfathered, c.active
    from public.stripe_price_catalog c
    where c.price_id = p_price_id and (c.active or c.grandfathered);
end;
$$;

revoke all on function public.get_checkout_price_catalog(text) from public, anon, authenticated, service_role;
grant execute on function public.get_checkout_price_catalog(text) to service_role;
notify pgrst, 'reload schema';
commit;
