import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const student = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role service_role; create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users values ('${student}'), ('${other}');
    grant usage on schema public to authenticated, service_role;
  `);
  // Every helper migration in order, so a later replacement of these RPCs is what gets tested.
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, migrations), 'utf8');
    if (/\bhelper_(usage_daily|settings|credit)/i.test(sql)) await db.exec(sql);
  }
  return db;
}

const service = (db) => db.exec(`reset role; set role service_role;`);
const owner = (db) => db.exec('reset role');
const consume = async (db, weekly, cost, user = student) => {
  await service(db);
  return (await db.query('select public.consume_helper_credits($1, $2, $3) as r', [user, weekly, cost])).rows[0].r;
};
const release = async (db, charge, user = student) => {
  await service(db);
  return (await db.query('select public.release_helper_credits($1, $2) as ok', [user, charge])).rows[0].ok;
};
const credit = async (db, { user = student, pack = 'credits_1000', credits = 1000, session = 'cs_1', pi = 'pi_1', cents = 499, currency = 'usd', at = new Date().toISOString() } = {}) => {
  await service(db);
  return (await db.query('select public.credit_helper_pack($1, $2, $3, $4, $5, $6, $7, $8) as r', [user, pack, credits, session, pi, cents, currency, at])).rows[0].r;
};
const one = async (db, sql, params = []) => { await owner(db); return (await db.query(sql, params)).rows[0]; };
const weekUsed = async (db, user = student) => (await one(db, 'select coalesce(sum(credits_used), 0)::int as n from public.helper_usage_weekly where user_id = $1', [user])).n;
const dayUsed = async (db, user = student) => (await one(db, 'select coalesce(sum(credits_used), 0)::int as n from public.helper_credits_daily where user_id = $1', [user])).n;
const packLeft = async (db, user = student) => (await one(db, "select coalesce(sum(credits_remaining), 0)::int as n from public.helper_credit_packs where user_id = $1 and status = 'active'", [user])).n;
const global = async (db) => (await one(db, 'select coalesce(sum(message_count), 0)::int as n from public.helper_global_daily')).n;

test('the week\'s plan credits are spent to the exact limit and then stop with nothing charged', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 7; i += 1) assert.equal((await consume(db, 70, 10)).status, 'ok');
    const last = await consume(db, 70, 10);
    assert.deepEqual([last.status, last.reason, last.plan_left, last.pack_left], ['limit', 'week', 0, 0]);
    assert.equal(await weekUsed(db), 70);
    assert.equal(await dayUsed(db), 70);
    assert.equal(await global(db), 7);
    const monday = (await one(db, 'select week_start, extract(isodow from week_start)::int as dow from public.helper_usage_weekly')).dow;
    assert.equal(monday, 1);
    // Another student's week is separate.
    assert.equal((await consume(db, 70, 10, other)).plan_left, 60);
  } finally { await db.close(); }
});

test('a photo with too few plan credits splits onto a pack, or is refused untouched without one', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 6; i += 1) await consume(db, 70, 10);
    const refused = await consume(db, 70, 20);
    assert.deepEqual([refused.status, refused.plan_left], ['limit', 10]);
    assert.equal(await weekUsed(db), 60);
    assert.equal(await credit(db), 'credited');
    const split = await consume(db, 70, 20);
    assert.deepEqual([split.status, split.plan_left, split.pack_left], ['ok', 0, 990]);
    const row = await one(db, 'select plan_credits, pack_credits, global_counted from public.helper_credit_charges where id = $1', [split.charge_id]);
    assert.deepEqual(row, { plan_credits: 10, pack_credits: 10, global_counted: true });
    // Plan gone: the next message comes wholly from the pack and skips the site-wide count.
    const packOnly = await consume(db, 70, 10);
    assert.equal(packOnly.pack_left, 980);
    assert.equal(await global(db), 7);
  } finally { await db.close(); }
});

test('packs are used oldest expiry first and expired packs are ignored', async () => {
  const db = await setup();
  try {
    const year = 365 * 24 * 3600 * 1000;
    await credit(db, { session: 'cs_old', pi: 'pi_old', at: new Date(Date.now() - year - 1000).toISOString() });
    await credit(db, { session: 'cs_new', pi: 'pi_new', pack: 'credits_3000', credits: 3000, cents: 1299, at: new Date(Date.now() - 1000).toISOString() });
    await credit(db, { session: 'cs_mid', pi: 'pi_mid', at: new Date(Date.now() - year / 2).toISOString() });
    const r = await consume(db, 0, 10);
    assert.equal(r.pack_left, 3990);
    const used = await one(db, 'select p.stripe_checkout_session_id as s from public.helper_credit_charges c join public.helper_credit_packs p on p.id = c.pack_id');
    assert.equal(used.s, 'cs_mid');
  } finally { await db.close(); }
});

test('a full site-wide cap moves the whole message onto a pack, or says busy with nothing spent', async () => {
  const db = await setup();
  try {
    await owner(db);
    await db.exec('update public.helper_settings set global_daily_limit = 1');
    assert.equal((await consume(db, 700, 10, other)).status, 'ok');
    assert.equal((await consume(db, 700, 10)).status, 'busy');
    assert.equal(await weekUsed(db), 0);
    assert.equal(await dayUsed(db), 0);
    await credit(db);
    const paid = await consume(db, 700, 10);
    assert.deepEqual([paid.status, paid.plan_left, paid.pack_left], ['ok', 700, 990]);
    assert.equal(await weekUsed(db), 0);
    assert.equal(await global(db), 1);
  } finally { await db.close(); }
});

test('the kill switch stops every charge, packs included', async () => {
  const db = await setup();
  try {
    await credit(db);
    await owner(db);
    await db.exec('update public.helper_settings set enabled = false');
    assert.equal((await consume(db, 700, 10)).status, 'disabled');
    assert.equal(await packLeft(db), 1000);
  } finally { await db.close(); }
});

test('no account spends more than 1,000 credits in a day, plan and packs together', async () => {
  const db = await setup();
  try {
    await credit(db, { pack: 'credits_3000', credits: 3000, cents: 1299 });
    for (let i = 0; i < 50; i += 1) assert.equal((await consume(db, 3000, 20)).status, 'ok');
    const blocked = await consume(db, 3000, 10);
    assert.deepEqual([blocked.status, blocked.reason], ['limit', 'day']);
    assert.equal(await dayUsed(db), 1000);
  } finally { await db.close(); }
});

test('a refund goes back once, to the week, day, pack and site count it came from', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 6; i += 1) await consume(db, 70, 10);
    await credit(db);
    const split = await consume(db, 70, 20);
    assert.equal(await release(db, split.charge_id), true);
    assert.equal(await release(db, split.charge_id), false);
    assert.equal(await release(db, split.charge_id, other), false);
    assert.deepEqual([await weekUsed(db), await dayUsed(db), await packLeft(db), await global(db)], [60, 60, 1000, 6]);
    // A refund never restores credits to a pack that was revoked in between.
    const packOnly = await consume(db, 0, 10);
    await service(db);
    await db.query("select public.revoke_helper_pack('pi_1', 'refunded')");
    assert.equal(await release(db, packOnly.charge_id), true);
    assert.equal(await packLeft(db), 0);
  } finally { await db.close(); }
});

test('a pack is credited once per Checkout Session and only for the exact catalogue', async () => {
  const db = await setup();
  try {
    assert.equal(await credit(db), 'credited');
    assert.equal(await credit(db), 'duplicate');
    assert.equal(await packLeft(db), 1000);
    await assert.rejects(credit(db, { user: other }), /session mismatch/);
    for (const bad of [{ cents: 100 }, { credits: 5000 }, { pack: 'credits_9000' }, { currency: 'eur' }, { pack: 'credits_3000', credits: 3000, cents: 499 }, { user: null }]) {
      await assert.rejects(credit(db, { session: 'cs_bad', pi: 'pi_bad', ...bad }), /invalid helper credit pack/);
    }
    const expires = await one(db, "select expires_at = purchased_at + interval '12 months' as ok from public.helper_credit_packs");
    assert.equal(expires.ok, true);
  } finally { await db.close(); }
});

test('a payment refunded or disputed before it is credited never becomes credits', async () => {
  const db = await setup();
  try {
    await service(db);
    await db.query("select public.revoke_helper_pack('pi_1', 'disputed')");
    assert.equal(await credit(db), 'revoked');
    assert.equal(await packLeft(db), 0);
    await assert.rejects(db.query("select public.revoke_helper_pack('pi_2', 'whatever')"), /invalid helper pack revocation/);
  } finally { await db.close(); }
});

test('bad charges fail closed', async () => {
  const db = await setup();
  try {
    for (const [weekly, cost] of [[null, 10], [70, null], [-1, 10], [70, 0], [70, 101], [100001, 10]]) {
      await assert.rejects(consume(db, weekly, cost), /invalid helper credit charge/);
    }
    await assert.rejects(consume(db, 70, 10, null), /invalid helper credit charge/);
  } finally { await db.close(); }
});

test('students can read only their own balance and can run none of the credit functions', async () => {
  const db = await setup();
  try {
    await consume(db, 70, 10);
    await consume(db, 70, 10, other);
    await credit(db);
    await owner(db);
    await db.exec(`set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='${student}'; set role authenticated;`);
    assert.equal((await db.query('select user_id from public.helper_usage_weekly')).rows.length, 1);
    assert.equal((await db.query('select id, credits_remaining from public.helper_credit_packs')).rows.length, 1);
    await assert.rejects(db.query('select stripe_payment_intent_id from public.helper_credit_packs'), /permission denied/);
    await assert.rejects(db.query('select * from public.helper_credit_charges'), /permission denied/);
    await assert.rejects(db.query(`update public.helper_usage_weekly set credits_used = 0`), /permission denied/);
    for (const call of [
      `select public.consume_helper_credits('${student}', 100000, 1)`,
      `select public.release_helper_credits('${student}', gen_random_uuid())`,
      `select public.credit_helper_pack('${student}', 'credits_3000', 3000, 'cs_x', 'pi_x', 1299, 'usd', now())`,
      `select public.revoke_helper_pack('pi_x', 'refunded')`,
    ]) await assert.rejects(db.query(call), /permission denied/);
    await owner(db);
    const privileges = await one(db, `select
      has_table_privilege('service_role', 'public.helper_credit_packs', 'insert') as svc_insert,
      has_table_privilege('service_role', 'public.helper_credit_charges', 'select') as svc_select,
      has_table_privilege('anon', 'public.helper_usage_weekly', 'select') as anon_select,
      has_function_privilege('anon', 'public.consume_helper_credits(uuid, integer, integer)', 'execute') as anon_exec,
      has_function_privilege('service_role', 'public.consume_helper_credits(uuid, integer, integer)', 'execute') as svc_exec`);
    assert.deepEqual(privileges, { svc_insert: false, svc_select: false, anon_select: false, anon_exec: false, svc_exec: true });
  } finally { await db.close(); }
});
