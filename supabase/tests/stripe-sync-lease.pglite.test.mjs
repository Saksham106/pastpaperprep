import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

test('Stripe subscription sync lease is service-only, exclusive, expiring and token-fenced', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;`);
    const sql = await readFile(new URL('../migrations/20260926000002_stripe_sync_lease.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const acl = await db.query(`select has_function_privilege('service_role', 'public.acquire_stripe_subscription_sync_lease(text,uuid)', 'execute') as service_can_acquire, has_function_privilege('anon', 'public.acquire_stripe_subscription_sync_lease(text,uuid)', 'execute') as anon_can_acquire, has_table_privilege('authenticated', 'public.stripe_subscription_sync_leases', 'select') as raw_read`);
    assert.deepEqual(acl.rows[0], { service_can_acquire: true, anon_can_acquire: false, raw_read: false });
    await db.exec(`set request.jwt.claim.role='service_role';`);
    const acquire = async token => (await db.query('select public.acquire_stripe_subscription_sync_lease($1,$2) as ok', ['sub_1', token])).rows[0].ok;
    const release = async token => (await db.query('select public.release_stripe_subscription_sync_lease($1,$2) as ok', ['sub_1', token])).rows[0].ok;
    assert.equal(await acquire('00000000-0000-0000-0000-000000000001'), true);
    assert.equal(await acquire('00000000-0000-0000-0000-000000000002'), false);
    assert.equal(await release('00000000-0000-0000-0000-000000000002'), false);
    assert.equal(await release('00000000-0000-0000-0000-000000000001'), true);
    assert.equal(await acquire('00000000-0000-0000-0000-000000000002'), true);
    await db.exec(`update public.stripe_subscription_sync_leases set expires_at=now()-interval '1 second' where subscription_id='sub_1'`);
    assert.equal(await acquire('00000000-0000-0000-0000-000000000003'), true);
    assert.equal(await release('00000000-0000-0000-0000-000000000002'), false);
    assert.equal(await release('00000000-0000-0000-0000-000000000003'), true);
  } finally { await db.close(); }
});
