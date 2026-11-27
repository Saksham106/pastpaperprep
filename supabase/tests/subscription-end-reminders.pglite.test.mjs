import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const student = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const sub = 'sub_ending00001';
const ends = '2026-12-01T09:00:00Z';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role service_role bypassrls; create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${student}'), ('${other}');
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(await readFile(new URL('../migrations/20261128000000_subscription_end_reminders.sql', import.meta.url), 'utf8'));
  return db;
}

const as = async (db, role) => { await db.exec('reset role'); await db.exec(`set role ${role}`); };
const claim = async (db, id = sub, user = student) => (await db.query('select public.claim_subscription_end_reminder($1, $2, $3) as ok', [id, ends, user])).rows[0].ok;
const finish = async (db, status, id = sub) => (await db.query('select public.finish_subscription_end_reminder($1, $2, $3) as ok', [id, ends, status])).rows[0].ok;
const row = async (db) => { await db.exec('reset role'); return (await db.query('select status, attempts from public.subscription_end_reminders')).rows; };

test('one claim per subscription period; a sent or failed reminder is never claimed again', async () => {
  const db = await setup();
  try {
    await as(db, 'service_role');
    assert.equal(await claim(db), true);
    assert.equal(await claim(db), false);
    assert.equal(await finish(db, 'sent'), true);
    assert.equal(await finish(db, 'sent'), false);
    await db.exec('reset role');
    await db.exec("update public.subscription_end_reminders set claimed_at = now() - interval '2 hours'");
    await as(db, 'service_role');
    assert.equal(await claim(db), false);
    assert.deepEqual(await row(db), [{ status: 'sent', attempts: 1 }]);
    // A new period end for the same subscription is its own reminder.
    assert.equal((await db.query('select public.claim_subscription_end_reminder($1, $2, $3) as ok', [sub, '2027-01-01T09:00:00Z', student])).rows[0].ok, true);
  } finally { await db.close(); }
});

test('a stale claim (send timed out) is retried once, only after 30 minutes, only for its owner', async () => {
  const db = await setup();
  try {
    await as(db, 'service_role');
    assert.equal(await claim(db), true);
    assert.equal(await claim(db), false, 'fresh claim is not retried');
    await db.exec('reset role');
    await db.exec("update public.subscription_end_reminders set claimed_at = now() - interval '31 minutes'");
    await as(db, 'service_role');
    assert.equal(await claim(db, sub, other), false, 'another account cannot take it');
    assert.equal(await claim(db), true);
    await db.exec('reset role');
    await db.exec("update public.subscription_end_reminders set claimed_at = now() - interval '31 minutes'");
    await as(db, 'service_role');
    assert.equal(await claim(db), false, 'only one retry');
    assert.deepEqual(await row(db), [{ status: 'claimed', attempts: 2 }]);
  } finally { await db.close(); }
});

test('bad input fails closed', async () => {
  const db = await setup();
  try {
    await as(db, 'service_role');
    for (const args of [[null, ends, student], ['not_a_sub', ends, student], [sub, null, student], [sub, ends, null]]) {
      await assert.rejects(db.query('select public.claim_subscription_end_reminder($1, $2, $3)', args), /invalid reminder claim/);
    }
    await assert.rejects(finish(db, 'claimed'), /invalid reminder status/);
    await assert.rejects(finish(db, null), /invalid reminder status/);
  } finally { await db.close(); }
});

test('only the service role can claim, finish or read; nobody writes the table directly', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      await as(db, role);
      await assert.rejects(claim(db), /permission denied/);
      await assert.rejects(finish(db, 'sent'), /permission denied/);
      await assert.rejects(db.query('select * from public.subscription_end_reminders'), /permission denied/);
    }
    await as(db, 'service_role');
    await db.query('select * from public.subscription_end_reminders');
    await assert.rejects(db.query(`insert into public.subscription_end_reminders (subscription_id, ends_at, user_id) values ('${sub}', '${ends}', '${student}')`), /permission denied/);
    await db.exec('reset role');
    const privileges = (await db.query(`select has_table_privilege('service_role', 'public.subscription_end_reminders', 'INSERT') as i, has_table_privilege('service_role', 'public.subscription_end_reminders', 'UPDATE') as u, has_table_privilege('service_role', 'public.subscription_end_reminders', 'DELETE') as d`)).rows[0];
    assert.deepEqual(privileges, { i: false, u: false, d: false });
  } finally { await db.close(); }
});

test('reminders go with the account', async () => {
  const db = await setup();
  try {
    await as(db, 'service_role');
    await claim(db);
    await db.exec('reset role');
    await db.exec(`delete from auth.users where id = '${student}'`);
    assert.deepEqual(await row(db), []);
  } finally { await db.close(); }
});
