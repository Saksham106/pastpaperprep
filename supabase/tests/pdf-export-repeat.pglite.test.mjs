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
  for (const file of ['20260826012000_add_download_allowances.sql', '20261012000000_explanation_daily_cap.sql', '20261012010000_atomic_explanation_sign_allowance.sql', '20261016000000_download_quota_headroom.sql', '20261020000000_pdf_export_same_day_repeat.sql', '20261020020000_remove_daily_pdf_export_count_cap.sql']) {
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

test('allows more than three distinct PDFs while retaining the 150-question daily budget', async () => {
  const db = await setup();
  try {
    await as(db, student);
    for (let n = 1; n <= 150; n++) {
      assert.equal(await exportPdf(db, key(n), 1, 0), true, `PDF ${n} should fit the question budget`);
    }
    const expected = { pdf_export_count: 150, pdf_question_count: 150, signed_asset_count: 0 };
    assert.deepEqual(await usage(db, student), expected);
    await as(db, student);
    assert.equal(await exportPdf(db, key(151), 1, 0), false);
    assert.equal(await exportPdf(db, key(1), 1, 0), true);
    assert.deepEqual(await usage(db, student), expected);
  } finally { await db.close(); }
});

test('repeating the same worksheet the same day does not use another export', async () => {
  const db = await setup();
  try {
    await as(db, student);
    assert.equal(await exportPdf(db, key(1)), true);
    // Double click / retry / cancelled-then-repeated: same key, no new charge.
    assert.equal(await exportPdf(db, key(1)), true);
    assert.equal(await exportPdf(db, key(1)), true);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 1, pdf_question_count: 50, signed_asset_count: 100 });

    // New worksheets still charge, and the 150-question daily limit still holds.
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

test('a receipt only covers what it charged: a costlier repeat of the same key is charged', async () => {
  const db = await setup();
  try {
    await as(db, student);
    // A direct caller registers a cheap charge for some key...
    assert.equal(await exportPdf(db, key(7), 1, 1), true);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 1, pdf_question_count: 1, signed_asset_count: 1 });
    // ...and then asks for far more under the same key: charged normally, not free.
    await as(db, student);
    assert.equal(await exportPdf(db, key(7), 50, 900), true);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 2, pdf_question_count: 51, signed_asset_count: 901 });
    // At the daily boundary that costlier repeat is denied, exactly like a new export.
    await as(db, student);
    assert.equal(await exportPdf(db, key(8), 50, 1000), true);
    assert.equal(await exportPdf(db, key(7), 50, 1000), false);
    // An equal-or-cheaper repeat stays free.
    assert.equal(await exportPdf(db, key(7), 1, 1), true);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 3, pdf_question_count: 101, signed_asset_count: 1901 });
  } finally { await db.close(); }
});

test('asset budget, per-call bounds, and explanation/PDF arrival orders remain enforced', async () => {
  for (const pdfFirst of [false, true]) {
    const db = await setup();
    try {
      await as(db, student);
      const explanation = async () => (await db.query('select public.consume_explanation_and_download_allowance(1, 1000) as ok')).rows[0].ok;
      assert.equal(pdfFirst ? await exportPdf(db, key(1), 1, 1000) : await explanation(), true);
      assert.equal(pdfFirst ? await explanation() : await exportPdf(db, key(1), 1, 1000), true);
      assert.equal(await exportPdf(db, key(2), 1, 1000), true);
      await db.exec('reset role');
      const before = (await db.query('select * from public.download_usage_daily')).rows;
      await as(db, student);
      assert.equal(await exportPdf(db, key(3), 1, 1), false);
      assert.equal(await exportPdf(db, key(3), 51, 0), false);
      assert.equal(await exportPdf(db, key(3), 1, 1001), false);
      assert.equal(await explanation(), false);
      // A charged repeat still succeeds even at the shared asset boundary.
      assert.equal(await exportPdf(db, key(1), 1, 1000), true);
      await db.exec('reset role');
      assert.deepEqual((await db.query('select * from public.download_usage_daily')).rows, before);
      assert.equal((await db.query('select count(*)::int as n from public.pdf_export_charges')).rows[0].n, 2);
    } finally { await db.close(); }
  }
});

test('active exemptions bypass daily accounting, not per-call bounds; expiry is strict', async () => {
  const db = await setup();
  try {
    await db.exec(`insert into public.download_allowance_exemptions(user_id) values ('${student}')`);
    await as(db, student);
    for (let n = 1; n <= 4; n++) assert.equal(await exportPdf(db, key(n)), true);
    assert.equal(await usage(db, student), null);
    await as(db, student);
    assert.equal(await exportPdf(db, key(5), 51), false);
    assert.equal(await exportPdf(db, key(5), 1, 1001), false);
    await db.exec(`reset role; begin; update public.download_allowance_exemptions set expires_at = now() where user_id = '${student}';`);
    await as(db, student);
    for (let n = 5; n <= 7; n++) assert.equal(await exportPdf(db, key(n)), true);
    assert.equal(await exportPdf(db, key(8), 1, 0), false);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 3, pdf_question_count: 150, signed_asset_count: 300 });
    await db.exec('rollback');
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
    // Bounds are checked before the repeat path: an out-of-range request is refused even for a charged key.
    assert.equal(await exportPdf(db, key(10), 5, 5), true);
    assert.equal(await exportPdf(db, key(10), 51, 5), false);
    assert.equal(await exportPdf(db, key(10), 5, 1001), false);
    assert.equal(await exportPdf(db, key(10), 5, -1), false);
    assert.deepEqual(await usage(db, student), { pdf_export_count: 1, pdf_question_count: 5, signed_asset_count: 5 });

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
