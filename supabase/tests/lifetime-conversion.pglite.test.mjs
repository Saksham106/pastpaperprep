import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const user = '00000000-0000-0000-0000-000000000001';
const intent = '00000000-0000-0000-0000-000000000011';
const other = '00000000-0000-0000-0000-000000000012';
const snapshot = { priceId: 'price_a', itemId: 'si_a', quantity: 1, productId: 'bank_igcse', selectedBankIds: ['igcse'], interval: 'monthly', periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z', status: 'active', customerId: 'cus_owned' };

async function setup() {
 const db = new PGlite();
 await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth;
 create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
 create table auth.users(id uuid primary key);
 create table public.products(id text primary key, name text not null, active boolean not null default true, constraint products_known_id check(id in ('bundle_all')));
 create table public.entitlements(id uuid primary key default gen_random_uuid(),user_id uuid not null,product_id text not null references public.products(id),status text not null,starts_at timestamptz not null,expires_at timestamptz,source text not null,source_reference text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,product_id));
 create table public.billing_checkout_reservations(user_id uuid primary key references auth.users(id),intent_id uuid unique not null,expires_at timestamptz not null,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.stripe_customers(user_id uuid primary key references auth.users(id),customer_id text unique not null);
 insert into auth.users values ('${user}');insert into public.products values ('bundle_all','All Access',true);insert into public.stripe_customers values('${user}','cus_owned');set request.jwt.claim.role='service_role';`);
 const base = await readFile(new URL('../migrations/20260826194645_add_bank_based_pricing.sql',import.meta.url),'utf8');
 await db.exec(base.slice(base.indexOf('create or replace function public.reserve_billing_checkout'),base.indexOf('create or replace function public.confirm_billing_checkout')));
 let lifetime = await readFile(new URL('../migrations/20261007000000_lifetime_all_access.sql',import.meta.url),'utf8');
 lifetime = lifetime.replace(/^create extension if not exists pgcrypto;\s*/m,'');
 await db.exec(lifetime);
 await db.exec(await readFile(new URL('../migrations/20261008000000_lifetime_subscription_conversion.sql',import.meta.url),'utf8'));
 return db;
}
const reserve = (db, value=snapshot) => db.query('select public.reserve_lifetime_conversion($1,$2,$3,$4,$5::jsonb,now()+interval \'31 minutes\') as ok',[user,intent,'cus_owned','sub_owned',JSON.stringify(value)]);

test('conversion fence, paid binding, completion and duplicate replay execute on real SQL',async()=>{
 const db=await setup();try {
 assert.equal((await reserve(db)).rows[0].ok,true);
 assert.equal((await db.query('select public.reserve_billing_checkout($1,$2) as ok',[user,other])).rows[0].ok,false);
 assert.equal((await db.query('select public.attach_lifetime_conversion_session($1,$2,$3,now()+interval \'31 minutes\') as ok',[user,intent,'cs_test_owned'])).rows[0].ok,true);
 assert.equal((await db.query('select public.mark_lifetime_conversion_paid($1,$2,$3) as ok',[intent,'cs_test_owned','pi_owned'])).rows[0].ok,false);
 await db.query("select public.fulfill_lifetime_purchase($1,$2,$3,29900,'usd',now())",[user,'cs_test_owned','pi_owned']);
 assert.equal((await db.query('select public.mark_lifetime_conversion_paid($1,$2,$3) as ok',[intent,'cs_test_owned','pi_owned'])).rows[0].ok,true);
 assert.equal((await db.query('select public.complete_lifetime_conversion($1,$2,$3) as ok',[intent,'cs_test_owned','pi_owned'])).rows[0].ok,true);
 assert.equal((await db.query('select public.mark_lifetime_conversion_paid($1,$2,$3) as ok',[intent,'cs_test_owned','pi_owned'])).rows[0].ok,true);
 assert.equal((await db.query('select status from public.lifetime_conversions')).rows[0].status,'renewals_stopped');
 assert.equal((await db.query('select public.expire_lifetime_conversion($1) as ok',['cs_test_owned'])).rows[0].ok,false);
 await assert.rejects(db.query('select public.mark_lifetime_conversion_paid($1,null,$2)',[intent,'pi_owned']));
 } finally {await db.close();}
});

test('known unattempted conversion abort releases the common billing lease',async()=>{
 const db=await setup();try {
 assert.equal((await reserve(db)).rows[0].ok,true);
 assert.equal((await db.query('select public.abort_lifetime_conversion($1,$2) as ok',[user,intent])).rows[0].ok,true);
 assert.equal((await db.query('select public.reserve_billing_checkout($1,$2) as ok',[user,other])).rows[0].ok,true);
 } finally {await db.close();}
});

test('null snapshot fields and non-server access are rejected by the database',async()=>{
 const db=await setup();try {
 for (const field of ['priceId','itemId','quantity','productId','selectedBankIds','interval','periodStart','periodEnd','status','customerId']) {
  await assert.rejects(reserve(db,{...snapshot,[field]:null}),field);
 }
 assert.equal((await db.query("select has_table_privilege('authenticated','public.lifetime_conversions','SELECT') as ok")).rows[0].ok,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.reserve_lifetime_conversion(uuid,uuid,text,text,jsonb,timestamptz)','EXECUTE') as ok")).rows[0].ok,false);
 assert.equal((await db.query("select has_function_privilege('service_role','public.reserve_lifetime_conversion(uuid,uuid,text,text,jsonb,timestamptz)','EXECUTE') as ok")).rows[0].ok,true);
 await db.exec("set request.jwt.claim.role='authenticated'");
 await assert.rejects(reserve(db));
 } finally {await db.close();}
});
