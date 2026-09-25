import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

test('checkout catalog lookup is service-only and retains grandfathered prices', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role service_role;
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
      create table public.stripe_price_catalog (
        price_id text not null, product_id text not null, billing_interval text not null,
        grandfathered boolean not null default false, active boolean not null default true,
        primary key(price_id, product_id, billing_interval)
      );
      revoke all on public.stripe_price_catalog from public, anon, authenticated, service_role;
      insert into public.stripe_price_catalog values
        ('price_live', 'bank_ib_sl', 'monthly', false, true),
        ('price_legacy', 'bank_ib_sl', 'annual', true, false),
        ('price_retired', 'bank_ib_sl', 'annual', false, false);
    `);
    const sql = await readFile(new URL('../migrations/20260926000003_checkout_catalog_lookup.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const acl = await db.query(`
      select has_function_privilege('service_role', 'public.get_checkout_price_catalog(text)', 'execute') as service_can_call,
             has_function_privilege('authenticated', 'public.get_checkout_price_catalog(text)', 'execute') as user_can_call,
             has_table_privilege('authenticated', 'public.stripe_price_catalog', 'select') as raw_read
    `);
    assert.deepEqual(acl.rows[0], { service_can_call: true, user_can_call: false, raw_read: false });
    await db.exec(`set request.jwt.claim.role='authenticated'; set role authenticated;`);
    await assert.rejects(db.query(`select * from public.get_checkout_price_catalog('price_live')`), /permission denied|server-only function/);
    await db.exec(`reset role; set request.jwt.claim.role='service_role'; set role service_role;`);
    const live = await db.query(`select * from public.get_checkout_price_catalog('price_live')`);
    const grandfathered = await db.query(`select * from public.get_checkout_price_catalog('price_legacy')`);
    const retired = await db.query(`select * from public.get_checkout_price_catalog('price_retired')`);
    assert.equal(live.rows.length, 1);
    assert.equal(grandfathered.rows[0].grandfathered, true);
    assert.equal(retired.rows.length, 0);
  } finally {
    await db.close();
  }
});
