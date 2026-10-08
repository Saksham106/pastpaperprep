begin;

create table public.lifetime_conversions (
  intent_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null check (customer_id ~ '^cus_[A-Za-z0-9]+$'),
  subscription_id text not null check (subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  subscription_snapshot jsonb not null,
  checkout_session_id text unique,
  payment_intent_id text unique,
  status text not null check (status in ('pending','paid','renewals_stopped','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (jsonb_typeof(subscription_snapshot) = 'object')
);
create unique index lifetime_conversions_one_pending_per_user on public.lifetime_conversions(user_id) where status='pending';
alter table public.lifetime_conversions enable row level security;
revoke all on public.lifetime_conversions from public, anon, authenticated, service_role;
grant select on public.lifetime_conversions to service_role;

-- Keep the prior lease implementation intact; all application callers now use the fenced wrapper.
alter function public.reserve_billing_checkout(uuid, uuid) rename to reserve_billing_checkout_without_lifetime_conversion_fence;
revoke all on function public.reserve_billing_checkout_without_lifetime_conversion_fence(uuid,uuid) from public,anon,authenticated,service_role;

create function public.reserve_billing_checkout(p_user_id uuid,p_intent_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if p_user_id is null or p_intent_id is null then raise exception 'invalid checkout reservation'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 if exists(select 1 from public.lifetime_conversions c where c.user_id=p_user_id and c.status in ('pending','paid','renewals_stopped') and c.intent_id<>p_intent_id) then return false; end if;
 return public.reserve_billing_checkout_without_lifetime_conversion_fence(p_user_id,p_intent_id);
end $$;
revoke all on function public.reserve_billing_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_billing_checkout(uuid,uuid) to service_role;

create function public.reserve_lifetime_conversion(p_user_id uuid,p_intent_id uuid,p_customer_id text,p_subscription_id text,p_snapshot jsonb,p_expires_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare ok boolean;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if p_user_id is null or p_intent_id is null or p_customer_id is null or p_subscription_id is null or p_customer_id !~ '^cus_[A-Za-z0-9]+$' or p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
 or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '32 minutes'
 or not (p_snapshot ?& array['priceId','itemId','quantity','productId','selectedBankIds','interval','periodStart','periodEnd','status','customerId'])
 or (p_snapshot->>'customerId') is distinct from p_customer_id or nullif(p_snapshot->>'priceId','') is null or nullif(p_snapshot->>'itemId','') is null
 or nullif(p_snapshot->>'productId','') is null or coalesce(p_snapshot->>'interval','') not in ('monthly','annual')
 or coalesce(p_snapshot->>'quantity','') !~ '^[1-9][0-9]*$' or jsonb_typeof(p_snapshot->'selectedBankIds') is distinct from 'array'
 or nullif(p_snapshot->>'periodStart','') is null or nullif(p_snapshot->>'periodEnd','') is null
 or coalesce(p_snapshot->>'status','') not in ('active','trialing') then raise exception 'invalid lifetime conversion target'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 if not exists(select 1 from public.stripe_customers sc where sc.user_id=p_user_id and sc.customer_id=p_customer_id) then return false; end if;
 select public.reserve_billing_checkout_without_lifetime_conversion_fence(p_user_id,p_intent_id) into ok;
 if not ok then return false; end if;
 if exists(select 1 from public.lifetime_conversions where user_id=p_user_id and status in ('pending','paid','renewals_stopped')) then return false; end if;
 insert into public.lifetime_conversions(intent_id,user_id,customer_id,subscription_id,subscription_snapshot,status,expires_at)
 values(p_intent_id,p_user_id,p_customer_id,p_subscription_id,p_snapshot,'pending',p_expires_at);
 return true;
end $$;

create function public.attach_lifetime_conversion_session(p_user_id uuid,p_intent_id uuid,p_session_id text,p_expires_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if p_user_id is null or p_intent_id is null or (p_session_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$') or p_expires_at is null or p_expires_at<=now() then raise exception 'invalid conversion session'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 update public.lifetime_conversions set checkout_session_id=p_session_id,expires_at=p_expires_at,updated_at=now()
 where user_id=p_user_id and intent_id=p_intent_id and status='pending' and (checkout_session_id is null or checkout_session_id=p_session_id);
 get diagnostics n=row_count; return n=1;
end $$;

create function public.mark_lifetime_conversion_paid(p_intent_id uuid,p_session_id text,p_payment_intent_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.lifetime_conversions%rowtype; n int;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if p_intent_id is null or (p_session_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$') or (p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$') then raise exception 'invalid conversion payment'; end if;
 select * into c from public.lifetime_conversions where intent_id=p_intent_id for update;
 if not found or not exists(select 1 from public.lifetime_purchases p where p.user_id=c.user_id and p.checkout_session_id=p_session_id and p.payment_intent_id=p_payment_intent_id and p.status='paid') then return false; end if;
 if c.checkout_session_id is not null and c.checkout_session_id<>p_session_id then return false; end if;
 update public.lifetime_conversions set checkout_session_id=p_session_id,payment_intent_id=p_payment_intent_id,status=case when status='renewals_stopped' then status else 'paid' end,updated_at=now()
 where intent_id=p_intent_id and (payment_intent_id is null or payment_intent_id=p_payment_intent_id) and status in ('pending','paid','renewals_stopped');
 get diagnostics n=row_count; return n=1;
end $$;

create function public.complete_lifetime_conversion(p_intent_id uuid,p_session_id text,p_payment_intent_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if p_intent_id is null or (p_session_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$') or (p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$') then raise exception 'invalid completed conversion'; end if;
 update public.lifetime_conversions set status='renewals_stopped',updated_at=now() where intent_id=p_intent_id and checkout_session_id=p_session_id and payment_intent_id=p_payment_intent_id and status in ('paid','renewals_stopped');
 get diagnostics n=row_count; return n=1;
end $$;

create function public.expire_lifetime_conversion(p_session_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if (p_session_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$') then raise exception 'invalid expired session'; end if;
 update public.lifetime_conversions set status='expired',updated_at=now() where checkout_session_id=p_session_id and status='pending';
 get diagnostics n=row_count; return n=1;
end $$;

revoke all on function public.reserve_lifetime_conversion(uuid,uuid,text,text,jsonb,timestamptz), public.attach_lifetime_conversion_session(uuid,uuid,text,timestamptz), public.mark_lifetime_conversion_paid(uuid,text,text), public.complete_lifetime_conversion(uuid,text,text), public.expire_lifetime_conversion(text) from public,anon,authenticated;
grant execute on function public.reserve_lifetime_conversion(uuid,uuid,text,text,jsonb,timestamptz), public.attach_lifetime_conversion_session(uuid,uuid,text,timestamptz), public.mark_lifetime_conversion_paid(uuid,text,text), public.complete_lifetime_conversion(uuid,text,text), public.expire_lifetime_conversion(text) to service_role;
comment on function public.attach_lifetime_conversion_session(uuid,uuid,text,timestamptz) is 'Worker may attach only verified session for stored intent/customer/owner; supports recovery if Stripe created session but response was lost. Never trust event metadata as the stored subscription snapshot.';
create function public.abort_lifetime_conversion(p_user_id uuid,p_intent_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only function' using errcode='42501'; end if;
 if p_user_id is null or p_intent_id is null then raise exception 'invalid conversion abort'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 update public.lifetime_conversions set status='expired',updated_at=now()
 where user_id=p_user_id and intent_id=p_intent_id and status='pending' and checkout_session_id is null;
 get diagnostics n=row_count;
 if n=1 then perform public.release_billing_checkout(p_user_id,p_intent_id); end if;
 return n=1;
end $$;
revoke all on function public.abort_lifetime_conversion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.abort_lifetime_conversion(uuid,uuid) to service_role;
comment on function public.abort_lifetime_conversion(uuid,uuid) is 'Server may call only when no Stripe create attempt was made. An uncertain create must remain fenced and be reconciled by its idempotency key.';
notify pgrst,'reload schema';
commit;
