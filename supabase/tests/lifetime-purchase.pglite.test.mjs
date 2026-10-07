import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

test('lifetime migration fulfills idempotently and revokes only after last active payment', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      create table auth.users(id uuid primary key);
      create table public.products(id text primary key, name text not null, active boolean not null default true, constraint products_known_id check (id in ('bundle_all')));
      create table public.entitlements(id uuid primary key default gen_random_uuid(), user_id uuid not null, product_id text not null references public.products(id),
        status text not null, starts_at timestamptz not null, expires_at timestamptz, source text not null, source_reference text,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,product_id));
      create table public.billing_checkout_reservations(user_id uuid, intent_id uuid, expires_at timestamptz, updated_at timestamptz);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'); insert into public.products values ('bundle_all','All Access',true);
      set request.jwt.claim.role='service_role';`);
    let migration = await readFile(new URL('../migrations/20261007000000_lifetime_all_access.sql', import.meta.url), 'utf8');
    migration = migration.replace(/^create extension if not exists pgcrypto;\s*/m, '').replace(/notify pgrst, 'reload schema';\s*/g, '');
    await db.exec(migration);
    const user = '00000000-0000-0000-0000-000000000001';
    const apply = (session, intent) => db.query('select public.fulfill_lifetime_purchase($1,$2,$3,29900,\'usd\',now()) as result', [user, session, intent]);
    assert.equal((await apply('cs_a','pi_a')).rows[0].result, 'applied');
    assert.equal((await apply('cs_a','pi_a')).rows[0].result, 'duplicate');
    await assert.rejects(db.query("select public.fulfill_lifetime_purchase($1,'cs_bad','pi_bad',100,'usd',now())", [user]));
    assert.equal((await db.query("select count(*)::int as n from public.entitlements where product_id='lifetime_all_access' and status='active'")).rows[0].n, 1);
    assert.equal((await apply('cs_b','pi_b')).rows[0].result, 'applied');
    assert.equal((await db.query("select count(*)::int as n from public.lifetime_purchases where status='paid'")).rows[0].n, 2);
    await db.exec("insert into public.billing_checkout_reservations values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099',now()+interval '5 minutes',now())");
    assert.equal((await db.query("select public.confirm_billing_checkout($1,'00000000-0000-0000-0000-000000000099') as result", [user])).rows[0].result, false);
    assert.equal((await db.query("select public.revoke_lifetime_purchase('pi_a','refunded') as result")).rows[0].result, 'revoked');
    assert.equal((await db.query("select status from public.entitlements where product_id='lifetime_all_access'")).rows[0].status, 'active');
    assert.equal((await db.query("select public.revoke_lifetime_purchase('pi_b','disputed') as result")).rows[0].result, 'revoked');
    assert.equal((await db.query("select status from public.entitlements where product_id='lifetime_all_access'")).rows[0].status, 'revoked');
    assert.equal((await db.query("select public.restore_lifetime_purchase('pi_b') as result")).rows[0].result, 'restored');
    assert.equal((await db.query("select status from public.entitlements where product_id='lifetime_all_access'")).rows[0].status, 'active');
    assert.equal((await db.query("select public.revoke_lifetime_purchase('pi_b','disputed') as result")).rows[0].result, 'revoked');
    assert.equal((await db.query("select public.restore_lifetime_purchase('pi_a') as result")).rows[0].result, 'unchanged');
    await db.exec("set request.jwt.claim.role='authenticated'");
    await assert.rejects(db.query("select public.fulfill_lifetime_purchase($1,'cs_forbidden','pi_forbidden',29900,'usd',now())", [user]));
  } finally { await db.close(); }
});
