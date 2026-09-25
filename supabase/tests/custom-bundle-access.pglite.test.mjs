import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';

test('custom bundle RPC exposes only the authenticated owner current subscription grants', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role service_role;
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function public.is_valid_custom_bank_ids(text[]) returns boolean language sql immutable as $$ select $1 is not null and cardinality($1) between 1 and 5 and cardinality($1)=(select count(distinct x) from unnest($1) x) and not exists(select 1 from unnest($1) x where x is null or x not in ('ib-hl','ib-ai-hl','ib-sl','ib-ai-sl','ib-chemistry-hl','ib-physics-hl','ib-biology-hl','ib-economics-hl')) $$;
      create table public.stripe_subscriptions(
        user_id uuid not null, product_id text not null, selected_bank_ids text[],
        status text not null, starts_at timestamptz not null, expires_at timestamptz
      );
      revoke all on public.stripe_subscriptions from public, anon, authenticated;
    `);
    const sql = await readFile(new URL('../migrations/20260926000001_custom_bundle_access_rpc.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(`
      insert into public.stripe_subscriptions values
        ('${owner}','bundle_custom',array['ib-hl','ib-ai-hl'],'active',now()-interval '5 day',now()+interval '2 day'),
        ('${owner}','bundle_custom',array['ib-sl','ib-ai-sl'],'trialing',now()-interval '1 day',now()+interval '20 day'),
        ('${owner}','bundle_custom',array['ib-chemistry-hl','ib-hl'],'active',now()-interval '30 day',now()-interval '1 second'),
        ('${owner}','bundle_custom',array['ib-physics-hl','ib-hl'],'canceled',now()-interval '2 day',null),
        ('${owner}','bundle_custom',array['ib-biology-hl','ib-hl'],'active',now()+interval '1 day',now()+interval '10 day'),
        ('${owner}','bundle_custom',array['ib-hl','ib-hl'],'active',now()-interval '1 day',now()+interval '10 day'),
        ('${other}','bundle_custom',array['ib-economics-hl','ib-hl'],'active',now()-interval '1 day',now()+interval '10 day'),
        ('${owner}','bundle_all',null,'active',now()-interval '1 day',null);
      set request.jwt.claim.role='authenticated';
      set request.jwt.claim.sub='${owner}';
      set role authenticated;
    `);

    const acl = await db.query(`
      select has_function_privilege('authenticated', 'public.get_custom_bundle_access(uuid)', 'execute') as can_call,
             has_function_privilege('anon', 'public.get_custom_bundle_access(uuid)', 'execute') as anon_can_call,
             has_table_privilege('authenticated', 'public.stripe_subscriptions', 'select') as raw_read
    `);
    assert.deepEqual(acl.rows[0], { can_call: true, anon_can_call: false, raw_read: false });
    const grants = await db.query(`select * from public.get_custom_bundle_access($1) order by starts_at`, [owner]);
    assert.equal(grants.rows.length, 2);
    assert.deepEqual(grants.rows.map(row => row.selected_bank_ids), [['ib-hl', 'ib-ai-hl'], ['ib-sl', 'ib-ai-sl']]);
    assert.deepEqual(grants.rows.map(row => row.status), ['active', 'trialing']);
    assert.ok(grants.rows.every(row => new Date(row.starts_at) <= new Date() && new Date(row.expires_at) > new Date()));
    await assert.rejects(db.query(`select * from public.get_custom_bundle_access($1)`, [other]), /not authorized/);

    await db.exec(`set request.jwt.claim.role='service_role'; set request.jwt.claim.sub='';`);
    const serviceRows = await db.query(`select * from public.get_custom_bundle_access($1)`, [other]);
    assert.equal(serviceRows.rows.length, 1);
    assert.deepEqual(serviceRows.rows[0].selected_bank_ids, ['ib-economics-hl', 'ib-hl']);
  } finally {
    await db.close();
  }
});
