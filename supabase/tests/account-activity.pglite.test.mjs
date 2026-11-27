import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const student = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role service_role bypassrls; create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, created_at timestamptz not null default now());
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users values ('${student}'), ('${other}');
    grant usage on schema public to anon, authenticated, service_role;
    create table public.entitlements(id uuid primary key default gen_random_uuid(), user_id uuid not null, product_id text not null, status text not null, source text not null default 'stripe', starts_at timestamptz not null default now() - interval '30 days', expires_at timestamptz);
  `);
  for (const file of ['20261127000000_account_activity_daily.sql', '20261127010000_account_activity_v2.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  return db;
}

const as = async (db, role, sub = '') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.role', $1, false), set_config('request.jwt.claim.sub', $2, false)", [role, sub]);
  await db.exec(`set role ${role}`);
};
const record = async (db, area, user = student) => {
  await as(db, 'authenticated', user);
  await db.query('select public.record_account_activity($1)', [area]);
};
const rows = async (db) => {
  await db.exec('reset role');
  return (await db.query('select user_id, page_views, areas from public.account_activity_daily order by user_id')).rows;
};

test('a signed-in student\'s day counts page views and the areas used, once each', async () => {
  const db = await setup();
  try {
    await record(db, 'bank');
    await record(db, 'bank');
    await record(db, 'notes');
    await record(db, 'past_papers', other);
    assert.deepEqual(await rows(db), [
      { user_id: student, page_views: 3, areas: ['bank', 'notes'] },
      { user_id: other, page_views: 1, areas: ['past_papers'] },
    ]);
  } finally { await db.close(); }
});

test('an unknown area is stored as other, never as the caller\'s text', async () => {
  const db = await setup();
  try {
    await record(db, '<script>alert(1)</script>');
    await record(db, null);
    assert.deepEqual(await rows(db), [{ user_id: student, page_views: 2, areas: ['other'] }]);
  } finally { await db.close(); }
});

test('signed-out callers and other roles record nothing', async () => {
  const db = await setup();
  try {
    await as(db, 'authenticated', '');
    await db.query("select public.record_account_activity('bank')");
    await as(db, 'anon');
    await assert.rejects(db.query("select public.record_account_activity('bank')"), /permission denied/);
    await as(db, 'service_role');
    await assert.rejects(db.query("select public.record_account_activity('bank')"), /permission denied/);
    assert.deepEqual(await rows(db), []);
  } finally { await db.close(); }
});

test('students cannot read or write the table directly', async () => {
  const db = await setup();
  try {
    await record(db, 'bank');
    await as(db, 'authenticated', student);
    await assert.rejects(db.query('select * from public.account_activity_daily'), /permission denied/);
    await assert.rejects(db.query(`update public.account_activity_daily set page_views = 1999`), /permission denied/);
    await assert.rejects(db.query(`insert into public.account_activity_daily (user_id, activity_date) values ('${other}', current_date)`), /permission denied/);
  } finally { await db.close(); }
});

test('page views are capped per day', async () => {
  const db = await setup();
  try {
    await record(db, 'bank');
    await db.exec('reset role');
    await db.exec(`update public.account_activity_daily set page_views = 1999`);
    await record(db, 'bank');
    await record(db, 'bank');
    assert.equal((await rows(db))[0].page_views, 2000);
  } finally { await db.close(); }
});

test('deleting the account deletes its activity', async () => {
  const db = await setup();
  try {
    await record(db, 'bank');
    await db.exec('reset role');
    await db.exec(`delete from auth.users where id = '${student}'`);
    assert.deepEqual(await rows(db), []);
  } finally { await db.close(); }
});

test('every report query in docs/account-activity.md runs against the schema', async () => {
  const db = await setup();
  try {
    await record(db, 'bank');
    await record(db, 'notes', other);
    await db.exec('reset role');
    await db.exec(`insert into public.entitlements (user_id, product_id, status, expires_at) values ('${student}', 'bundle_all', 'active', now() + interval '20 days')`);
    const doc = await readFile(new URL('../../docs/account-activity.md', import.meta.url), 'utf8');
    const queries = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1]);
    assert.ok(queries.length >= 5);
    for (const query of queries) await db.query(query);
  } finally { await db.close(); }
});

test('an account that objected is never recorded', async () => {
  const db = await setup();
  try {
    await as(db, 'service_role');
    await db.query('insert into public.account_activity_opt_outs (user_id) values ($1)', [student]);
    await record(db, 'bank');
    await record(db, 'bank', other);
    assert.deepEqual((await rows(db)).map((row) => row.user_id), [other]);
  } finally { await db.close(); }
});

test('rows older than 13 months are deleted as new activity arrives', async () => {
  const db = await setup();
  try {
    await db.exec('reset role');
    await db.exec(`insert into public.account_activity_daily (user_id, activity_date, page_views) values
      ('${other}', (now() at time zone 'utc')::date - interval '14 months', 5),
      ('${other}', (now() at time zone 'utc')::date - interval '12 months', 5)`);
    await record(db, 'bank');
    await db.exec('reset role');
    const left = (await db.query(`select user_id, page_views from public.account_activity_daily order by activity_date`)).rows;
    assert.deepEqual(left, [{ user_id: other, page_views: 5 }, { user_id: student, page_views: 1 }]);
  } finally { await db.close(); }
});

test('only the service role can read activity and opt-outs', async () => {
  const db = await setup();
  try {
    await record(db, 'bank');
    await as(db, 'service_role');
    assert.equal((await db.query('select count(*)::int as n from public.account_activity_daily')).rows[0].n, 1);
    await assert.rejects(db.query(`update public.account_activity_daily set page_views = 1`), /permission denied/);
    await as(db, 'authenticated', student);
    await assert.rejects(db.query('select * from public.account_activity_opt_outs'), /permission denied/);
    await assert.rejects(db.query(`delete from public.account_activity_opt_outs`), /permission denied/);
  } finally { await db.close(); }
});
