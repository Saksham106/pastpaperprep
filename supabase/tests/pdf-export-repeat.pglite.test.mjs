import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const student = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const key = (n) => n.toString(16).padStart(64, '0');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role service_role; create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.products(id text primary key, name text);
    alter table public.products owner to postgres;
    insert into auth.users values ('${student}'), ('${other}');
  `);
  for (const file of ['20260826012000_add_download_allowances.sql', '20261012010000_atomic_explanation_sign_allowance.sql', '20261016000000_download_quota_headroom.sql', '20261020000000_pdf_export_same_day_repeat.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  return db;
}

const as = async (db, user) => db.exec(`reset role; set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='${user}'; set role authenticated;`);
const exportPdf = async (db, k, questions = 50, assets = 100) => (await db.query(`select public.consume_pdf_export_allowance($1, $2, $3) as ok`, [k, assets, questions])).rows[0].ok;
const usage = async (db, user) => {
  await db.exec('reset role');
  const row = (await db.query(`select pdf_export_count, pdf_question_count, signed_asset_count from public.download_usage_daily where user_id = $1`, [user])).rows[0];
  return row ?? null;
};

test('repeating the same worksheet the same day does not use another export', async () => {
  const db = await setup();
  try {
    await as(db, student);
    assert.equal(await exportPdf(db, key(1)), true);
    // Double click / retry / cancelled-then-repeated: same key, no new charge.
    assert.equal(await exportPdf(db, key(1)), true);
    assert.equal(await exportPdf(db, key(1)), true);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 1, pdf_question_count: 50, signed_asset_count: 100 });

    // New worksheets still charge, and the daily limits still hold (3 exports, 150 questions).
    await as(db, student);
    assert.equal(await exportPdf(db, key(2)), true);
    assert.equal(await exportPdf(db, key(3)), true);
    assert.equal(await exportPdf(db, key(4), 1, 1), false);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 3, pdf_question_count: 150, signed_asset_count: 300 });

    // A denied key is not remembered as charged, and charged keys stay free to repeat.
    await as(db, student);
    assert.equal(await exportPdf(db, key(4), 1, 1), false);
    assert.equal(await exportPdf(db, key(2)), true);
    await db.exec('reset role');
    assert.deepEqual((await db.query(`select export_key from public.pdf_export_charges where user_id = $1 order by export_key`, [student])).rows.map(r => r.export_key), [key(1), key(2), key(3)]);

    // Keys are per user: another student's identical worksheet is charged to them.
    await as(db, other);
    assert.equal(await exportPdf(db, key(1)), true);
    assert.equal((await usage(db, other)).pdf_export_count, 1);
  } finally { await db.close(); }
});

test('rejects malformed input and anonymous callers; table and function grants are exact', async () => {
  const db = await setup();
  try {
    await as(db, student);
    for (const bad of [null, '', 'not-a-hash', 'A'.repeat(64), key(1) + '0']) assert.equal(await exportPdf(db, bad), false);
    assert.equal((await db.query(`select public.consume_pdf_export_allowance($1, null, 5) as ok`, [key(9)])).rows[0].ok, false);
    assert.equal((await db.query(`select public.consume_pdf_export_allowance($1, 5, null) as ok`, [key(9)])).rows[0].ok, false);
    assert.equal((await db.query(`select public.consume_pdf_export_allowance($1, 5, 0) as ok`, [key(9)])).rows[0].ok, false);
    assert.equal(await usage(db, student), null);

    await db.exec(`set request.jwt.claim.role='anon'; set request.jwt.claim.sub='';`);
    assert.equal(await exportPdf(db, key(5)), false);

    await db.exec('reset role');
    const acl = (await db.query(`
      select has_function_privilege('authenticated', 'public.consume_pdf_export_allowance(text, integer, integer)', 'execute') as auth_exec,
             has_function_privilege('anon', 'public.consume_pdf_export_allowance(text, integer, integer)', 'execute') as anon_exec,
             has_function_privilege('service_role', 'public.consume_pdf_export_allowance(text, integer, integer)', 'execute') as service_exec,
             has_table_privilege('authenticated', 'public.pdf_export_charges', 'select') as auth_read,
             has_table_privilege('authenticated', 'public.pdf_export_charges', 'insert') as auth_write,
             has_table_privilege('service_role', 'public.pdf_export_charges', 'delete') as service_delete`)).rows[0];
    assert.deepEqual(acl, { auth_exec: true, anon_exec: false, service_exec: false, auth_read: false, auth_write: false, service_delete: false });
  } finally { await db.close(); }
});
