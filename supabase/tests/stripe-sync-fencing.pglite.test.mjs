import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const userId = '00000000-0000-0000-0000-000000000001';
const lease1 = '00000000-0000-0000-0000-000000000011';
const lease2 = '00000000-0000-0000-0000-000000000012';

const subscriptionEvent = (id, created, status = 'active', expires = '2099-01-01T00:00:00Z') => [
  id, created, 'sub_1', 'cus_1', userId, 'bundle_all', status,
  '2020-01-01T00:00:00Z', expires, 'annual', lease2, null, 1, 'price_annual',
];

test('Stripe sync fencing applies verified snapshots and invalidations only under sequential live leases', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role service_role; create role anon; create role authenticated; create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
      create table auth.users(id uuid primary key);
      create table public.products(id text primary key);
      insert into auth.users values ('${userId}');
      insert into public.products values ('bundle_all');
      create table public.entitlements (
        user_id uuid not null, product_id text not null, selected_bank_ids text[], status text not null,
        starts_at timestamptz not null, expires_at timestamptz, source text not null, source_reference text,
        updated_at timestamptz not null default now(), primary key(user_id, product_id)
      );
      create table public.stripe_customers(user_id uuid primary key, customer_id text unique not null);
      create table public.stripe_subscription_sync_leases(subscription_id text primary key, lease_token uuid not null, expires_at timestamptz not null);
      create table public.stripe_webhook_events(event_id text primary key, event_created bigint not null, processed_at timestamptz not null default now());
      create table public.stripe_subscriptions (
        subscription_id text primary key, customer_id text not null, user_id uuid not null, product_id text not null,
        status text not null, starts_at timestamptz not null, expires_at timestamptz, last_event_id text not null,
        last_event_created bigint not null, updated_at timestamptz not null default now(), selected_bank_ids text[],
        quantity integer not null default 1, price_id text, billing_interval text
      );
      create table public.stripe_price_catalog (
        price_id text not null, product_id text not null, billing_interval text not null,
        grandfathered boolean not null default false, active boolean not null default true,
        primary key(price_id, product_id, billing_interval)
      );
      insert into public.stripe_price_catalog(price_id, product_id, billing_interval, active, grandfathered) values ('price_annual','bundle_all','annual',false,true);
      create function public.get_checkout_price_catalog(text) returns table(price_id text, product_id text, billing_interval text, grandfathered boolean, active boolean)
      language sql stable as $$ select c.price_id,c.product_id,c.billing_interval,c.grandfathered,c.active from public.stripe_price_catalog c where c.price_id=$1 and (c.active or c.grandfathered) $$;
      insert into public.stripe_customers values ('${userId}', 'cus_1');
      create function public.is_valid_custom_bank_ids(text[]) returns boolean language sql immutable as $$ select false $$;
      create function public.claim_stripe_customer(uuid,text) returns text language sql as $$ select $2 $$;
      create function public.is_approved_stripe_price(text,text,text) returns boolean language sql stable as $$
        select exists(select 1 from public.stripe_price_catalog where product_id=$1 and price_id=$2 and billing_interval=$3 and active)
      $$;
      create function public.refresh_stripe_entitlement(uuid,text,timestamptz,text,text[]) returns void
      language plpgsql as $$
      declare
        current_source text; current_status text; current_start timestamptz; current_expiry timestamptz;
        candidate_status text; candidate_start timestamptz; candidate_expiry timestamptz;
        candidate_ref text; candidate_banks text[];
      begin
        select source,status,starts_at,expires_at into current_source,current_status,current_start,current_expiry
          from public.entitlements where user_id=$1 and product_id=$2;
        if current_source='manual' and current_status in ('active','trialing') and current_start<=now()
          and (current_expiry is null or current_expiry>now()) then return; end if;
        select status,starts_at,expires_at,subscription_id,selected_bank_ids into
          candidate_status,candidate_start,candidate_expiry,candidate_ref,candidate_banks
          from public.stripe_subscriptions where user_id=$1 and product_id=$2
            and status in ('active','trialing') and starts_at<=now() and expires_at>now()
          order by expires_at desc limit 1;
        if candidate_status is null then
          candidate_status:='revoked'; candidate_start:=$3; candidate_expiry:=null;
          candidate_ref:=$4; candidate_banks:=$5;
        end if;
        insert into public.entitlements(user_id,product_id,selected_bank_ids,status,starts_at,expires_at,source,source_reference)
          values($1,$2,candidate_banks,candidate_status,candidate_start,candidate_expiry,'stripe',candidate_ref)
        on conflict(user_id,product_id) do update set selected_bank_ids=excluded.selected_bank_ids,
          status=excluded.status,starts_at=excluded.starts_at,expires_at=excluded.expires_at,
          source=excluded.source,source_reference=excluded.source_reference,updated_at=now();
      end $$;
    `);
    const sql = await readFile(new URL('../migrations/20260926000004_stripe_sync_fencing.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const signatures = await db.query(`select
      to_regprocedure('public.apply_stripe_subscription_event(text,bigint,text,text,uuid,text,text,timestamptz,timestamptz,text,uuid,text[],integer,text)') is not null as fenced_apply,
      to_regprocedure('public.apply_stripe_subscription_event(text,bigint,text,text,uuid,text,text,timestamptz,timestamptz,text,text[],integer,text)') is null as no_unsafe_apply,
      to_regprocedure('public.invalidate_stripe_subscription_event(text,bigint,text,uuid)') is not null as fenced_invalidate,
      to_regprocedure('public.invalidate_stripe_subscription_event(text,bigint,text)') is null as no_unsafe_invalidate`);
    assert.deepEqual(signatures.rows[0], { fenced_apply: true, no_unsafe_apply: true, fenced_invalidate: true, no_unsafe_invalidate: true });
    const acl = await db.query(`select
      has_function_privilege('anon','public.apply_stripe_subscription_event(text,bigint,text,text,uuid,text,text,timestamptz,timestamptz,text,uuid,text[],integer,text)','execute') as anon_apply,
      has_function_privilege('authenticated','public.apply_stripe_subscription_event(text,bigint,text,text,uuid,text,text,timestamptz,timestamptz,text,uuid,text[],integer,text)','execute') as authenticated_apply,
      has_function_privilege('service_role','public.apply_stripe_subscription_event(text,bigint,text,text,uuid,text,text,timestamptz,timestamptz,text,uuid,text[],integer,text)','execute') as service_apply,
      has_function_privilege('anon','public.invalidate_stripe_subscription_event(text,bigint,text,uuid)','execute') as anon_invalidate,
      has_function_privilege('authenticated','public.invalidate_stripe_subscription_event(text,bigint,text,uuid)','execute') as authenticated_invalidate,
      has_function_privilege('service_role','public.invalidate_stripe_subscription_event(text,bigint,text,uuid)','execute') as service_invalidate`);
    assert.deepEqual(acl.rows[0], { anon_apply:false, authenticated_apply:false, service_apply:true, anon_invalidate:false, authenticated_invalidate:false, service_invalidate:true });
    await db.exec(`set request.jwt.claim.role='service_role';
      insert into public.stripe_subscriptions(subscription_id,customer_id,user_id,product_id,status,starts_at,expires_at,last_event_id,last_event_created,price_id,billing_interval)
      values ('sub_1','cus_1','${userId}','bundle_all','revoked','2020-01-01T00:00:00Z',null,'seed',0,'price_annual','annual');
      insert into public.stripe_subscription_sync_leases values ('sub_1','${lease1}',now()+interval '1 hour');`);
    const apply = async args => db.query(`select public.apply_stripe_subscription_event(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`, args);
    const invalidate = async args => db.query('select public.invalidate_stripe_subscription_event($1,$2,$3,$4) as result', args);
    const renewLease = async token => db.query(`insert into public.stripe_subscription_sync_leases values ('sub_1',$1,now()+interval '1 hour') on conflict(subscription_id) do update set lease_token=excluded.lease_token, expires_at=excluded.expires_at`, [token]);
    const callApply = async (id, created, status='active', expires='2099-01-01T00:00:00Z', token=lease2) => apply(subscriptionEvent(id,created,status,expires).map((v,i)=>i===10?token:v));
    await assert.rejects(invalidate(['evt_wrong_lease', 1, 'sub_1', lease2]), /Stripe sync lease lost/);
    await renewLease(lease1);
    await assert.rejects(invalidate(['evt_rejected', 1, 'sub_1', lease2]), /Stripe sync lease lost/);
    await renewLease(lease2);

    assert.equal((await callApply('evt_created', 100)).rows[0].result, 'applied');
    let state = await db.query(`select s.status, s.last_event_id, s.last_event_created, s.price_id, s.billing_interval,
      e.status as entitlement_status, e.source, e.source_reference from public.stripe_subscriptions s
      join public.entitlements e using(user_id,product_id) where s.subscription_id='sub_1'`);
    assert.deepEqual(state.rows[0], {status:'active',last_event_id:'evt_created',last_event_created:100,price_id:'price_annual',billing_interval:'annual',entitlement_status:'active',source:'stripe',source_reference:'sub_1'});

    await renewLease(lease1);
    assert.equal((await callApply('evt_renewed', 101, 'active', '2099-02-01T00:00:00Z', lease1)).rows[0].result, 'applied');
    state = await db.query(`select last_event_id,last_event_created,expires_at=(timestamptz '2099-02-01T00:00:00Z') as renewed from public.stripe_subscriptions`);
    assert.deepEqual(state.rows[0], {last_event_id:'evt_renewed',last_event_created:101,renewed:true});

    await renewLease(lease2);
    assert.equal((await callApply('evt_same_second_retry', 101)).rows[0].result, 'applied');
    assert.equal((await callApply('evt_duplicate', 102)).rows[0].result, 'applied');
    assert.equal((await callApply('evt_duplicate', 103)).rows[0].result, 'duplicate');
    assert.equal((await callApply('evt_stale', 99)).rows[0].result, 'stale');
    state = await db.query(`select last_event_id,last_event_created,status from public.stripe_subscriptions`);
    assert.deepEqual(state.rows[0], {last_event_id:'evt_duplicate',last_event_created:102,status:'active'});

    await renewLease(lease1);
    assert.equal((await invalidate(['evt_cancel', 103, 'sub_1', lease1])).rows[0].result, 'revoked');
    state = await db.query(`select s.status,e.status as entitlement_status,e.source from public.stripe_subscriptions s
      join public.entitlements e using(user_id,product_id)`);
    assert.deepEqual(state.rows[0], {status:'revoked',entitlement_status:'revoked',source:'stripe'});
    await renewLease(lease2);
    assert.equal((await invalidate(['evt_cancel', 104, 'sub_1', lease2])).rows[0].result, 'duplicate');
    assert.equal((await invalidate(['evt_cancel_stale', 102, 'sub_1', lease2])).rows[0].result, 'stale');

    await db.exec(`insert into public.entitlements(user_id,product_id,status,starts_at,expires_at,source,source_reference)
      values ('${userId}','bundle_all','active',now()-interval '1 day',null,'manual','operator-grant')
      on conflict(user_id,product_id) do update set status='active',starts_at=now()-interval '1 day',expires_at=null,source='manual',source_reference='operator-grant';`);
    await renewLease(lease1);
    assert.equal((await callApply('evt_manual_preserve', 105, 'active', '2099-01-01T00:00:00Z', lease1)).rows[0].result, 'applied');
    state = await db.query(`select source,source_reference,status from public.entitlements`);
    assert.deepEqual(state.rows[0], {source:'manual',source_reference:'operator-grant',status:'active'});
    const eventCount = await db.query('select count(*)::int as count from public.stripe_webhook_events');
    assert.equal(eventCount.rows[0].count, 8);
  } finally { await db.close(); }
});
