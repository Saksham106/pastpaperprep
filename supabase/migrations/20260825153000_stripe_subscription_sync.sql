begin;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_created bigint not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.stripe_subscriptions (
  subscription_id text primary key,
  customer_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id),
  status text not null,
  starts_at timestamptz not null,
  expires_at timestamptz,
  last_event_id text not null,
  last_event_created bigint not null,
  updated_at timestamptz not null default now(),
  constraint stripe_subscriptions_product check (product_id = 'bundle_all'),
  constraint stripe_subscriptions_status check (status in ('active', 'trialing', 'revoked'))
);

create index if not exists stripe_subscriptions_user_idx
  on public.stripe_subscriptions(user_id);
create index if not exists stripe_subscriptions_customer_idx
  on public.stripe_subscriptions(customer_id);

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_subscriptions enable row level security;

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
  inserted_events integer;
  applied_rows integer;
  entitlement_status text;
  entitlement_starts_at timestamptz;
  entitlement_expires_at timestamptz;
  entitlement_source_reference text;
begin
  if p_product_id <> 'bundle_all'
    or p_status not in ('active', 'trialing', 'revoked')
    or p_event_id is null
    or p_subscription_id is null
    or p_customer_id is null
    or p_event_created <= 0
    or p_starts_at is null
    or (p_status in ('active', 'trialing') and (p_expires_at is null or p_expires_at <= p_starts_at))
  then
    raise exception 'invalid Stripe subscription event';
  end if;

  select sc.user_id into mapped_user_id
  from public.stripe_customers sc
  where sc.customer_id = p_customer_id;

  if mapped_user_id is null or mapped_user_id <> p_user_id then
    raise exception 'Stripe customer mapping mismatch';
  end if;

  insert into public.stripe_webhook_events (event_id, event_created)
  values (p_event_id, p_event_created)
  on conflict (event_id) do nothing;
  get diagnostics inserted_events = row_count;

  if inserted_events = 0 then
    return 'duplicate';
  end if;

  insert into public.stripe_subscriptions (
    subscription_id,
    customer_id,
    user_id,
    product_id,
    status,
    starts_at,
    expires_at,
    last_event_id,
    last_event_created
  ) values (
    p_subscription_id,
    p_customer_id,
    p_user_id,
    p_product_id,
    p_status,
    p_starts_at,
    p_expires_at,
    p_event_id,
    p_event_created
  )
  on conflict (subscription_id) do update
  set customer_id = excluded.customer_id,
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      last_event_id = excluded.last_event_id,
      last_event_created = excluded.last_event_created,
      updated_at = now()
  where excluded.last_event_created >= public.stripe_subscriptions.last_event_created;
  get diagnostics applied_rows = row_count;

  if applied_rows = 0 then
    return 'stale';
  end if;

  select ss.status, ss.starts_at, ss.expires_at, ss.subscription_id
  into entitlement_status, entitlement_starts_at, entitlement_expires_at, entitlement_source_reference
  from public.stripe_subscriptions ss
  where ss.user_id = p_user_id
    and ss.product_id = p_product_id
    and ss.status in ('active', 'trialing')
    and ss.starts_at <= now()
    and ss.expires_at > now()
  order by ss.expires_at desc
  limit 1;

  if entitlement_status is null then
    entitlement_status := 'revoked';
    entitlement_starts_at := p_starts_at;
    entitlement_expires_at := null;
    entitlement_source_reference := p_subscription_id;
  end if;

  insert into public.entitlements (
    user_id,
    product_id,
    status,
    starts_at,
    expires_at,
    source,
    source_reference
  ) values (
    p_user_id,
    p_product_id,
    entitlement_status,
    entitlement_starts_at,
    entitlement_expires_at,
    'stripe',
    entitlement_source_reference
  )
  on conflict (user_id, product_id) do update
  set status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      source = excluded.source,
      source_reference = excluded.source_reference,
      updated_at = now();

  return 'applied';
end;
$$;

revoke all on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, bigint, text, text, uuid, text, text, timestamptz, timestamptz)
to service_role;

commit;
