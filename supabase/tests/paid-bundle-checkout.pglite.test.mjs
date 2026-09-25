import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

test('paid bundle checkout SQL preserves consent and rejects invalid/active All Access', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth; create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$; create table auth.users(id uuid primary key); create table public.entitlements(user_id uuid,product_id text,selected_bank_ids text[],status text,starts_at timestamptz,expires_at timestamptz); create table public.stripe_subscriptions(user_id uuid,product_id text,selected_bank_ids text[],status text,starts_at timestamptz,expires_at timestamptz); create table public.billing_checkout_reservations(user_id uuid,intent_id uuid,expires_at timestamptz,updated_at timestamptz); create function public.is_valid_custom_bank_ids(text[]) returns boolean language sql immutable as $$ select $1 is not null and cardinality($1) between 1 and 5 and cardinality($1)=(select count(distinct x) from unnest($1) x) and not exists(select 1 from unnest($1) x where x is null or x not in ('igcse','igcse-additional','ib-hl','ib-sl','ib-ai-hl','ib-ai-sl','ib-chemistry-hl','ib-chemistry-sl','ib-physics-hl','ib-physics-sl','ib-biology-hl','ib-biology-sl','ib-economics-hl','ib-economics-sl')) $$;`);
  let sql=await readFile(new URL('../migrations/20260926000000_confirm_paid_bundle_checkout.sql',import.meta.url),'utf8');
  sql=sql.slice(sql.indexOf('create table if not exists public.paid_bundle_checkout_consents'));
  sql=sql.slice(0,sql.indexOf('notify pgrst'));
  await db.exec(sql);
  await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000001'); insert into public.billing_checkout_reservations values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',now()+interval '5 min',now()); set request.jwt.claim.role='service_role';`);
  const args=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'];
  const ok=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true) value`,[...args,['ib-hl','ib-sl']]);
  assert.equal(ok.rows[0].value,true);
  assert.equal((await db.query('select count(*)::int n from public.paid_bundle_checkout_consents')).rows[0].n,1);
  await assert.rejects(db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,null,$3,true)`,[...args,['ib-hl','ib-sl']]));
  assert.equal((await db.query('select count(*)::int n from public.paid_bundle_checkout_consents')).rows[0].n,1);
  await assert.rejects(db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true)`,[...args,['ib-hl','ib-hl']]));
  await assert.rejects(db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_all','{}',false)`,args));
  await db.exec(`insert into public.entitlements values ('00000000-0000-0000-0000-000000000001','bundle_all',null,'active',now()-interval '1 day',null); insert into public.billing_checkout_reservations values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',now()+interval '5 min',now());`);
  const denied=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_all','{}',true) value`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']);
  assert.equal(denied.rows[0].value,false);
  await db.exec(`delete from public.entitlements where product_id='bundle_all'; insert into public.stripe_subscriptions values ('00000000-0000-0000-0000-000000000001','bank_ib_ai_hl',null,'active',now()-interval '1 day',null);`);
  const overlapping=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true) value`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',['ib-ai-hl','ib-hl']]);
  assert.equal(overlapping.rows[0].value,false);
  const disjoint=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true) value`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',['ib-sl','ib-hl']]);
  assert.equal(disjoint.rows[0].value,true);
  assert.equal((await db.query('select count(*)::int n from public.paid_bundle_checkout_consents')).rows[0].n,2);
  await db.exec(`insert into public.entitlements values ('00000000-0000-0000-0000-000000000001','bundle_custom',array['igcse','ib-sl'],'active',now()-interval '1 day',null); insert into public.billing_checkout_reservations values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004',now()+interval '5 min',now());`);
  const entitlementOverlap=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true) value`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004',['ib-sl','ib-hl']]);
  assert.equal(entitlementOverlap.rows[0].value,false);
  const entitlementDisjoint=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true) value`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004',['ib-hl','ib-chemistry-hl']]);
  assert.equal(entitlementDisjoint.rows[0].value,true);
  const missingReservation=await db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_custom',$3,true) value`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005',['ib-hl','ib-chemistry-hl']]);
  assert.equal(missingReservation.rows[0].value,false);
  await db.exec(`set request.jwt.claim.role='authenticated'`);
  await assert.rejects(db.query(`select public.confirm_paid_bundle_billing_checkout($1,$2,'bundle_all','{}',true)`,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']));
 } finally { await db.close(); }
});
