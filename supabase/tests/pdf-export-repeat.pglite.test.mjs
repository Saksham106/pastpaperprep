import { readFile, readdir } from 'node:fs/promises';
import { MAX_DAILY_PDF_QUESTIONS, MAX_DAILY_SIGNED_ASSETS, MAX_PDF_QUESTIONS } from '../../src/lib/export-limits.ts';
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
  // Discover the quota migration chain, so a later RPC/constraint replacement
  // cannot silently leave these tests exercising an obsolete definition.
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, migrations), 'utf8');
    if (/\b(download_usage_daily|consume_pdf_export_allowance|consume_download_allowance|consume_explanation_and_download_allowance)\b/i.test(sql)) {
      await db.exec(sql);
    }
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

test('latest SQL RPCs and CHECK constraints agree with exported TypeScript limits', async () => {
  const db = await setup();
  try {
    const reset = async (assets = 0, questions = 0) => {
      await db.exec('reset role; delete from public.pdf_export_charges; delete from public.download_usage_daily');
      await db.query(`insert into public.download_usage_daily
        (user_id, signed_asset_count, pdf_question_count) values ($1, $2, $3)`, [student, assets, questions]);
      await as(db, student);
    };
    let receipt = 0;
    // Seed cap-minus-one to isolate each RPC's predicate from the table CHECK.
    // Exact-cap acceptance catches tighter SQL; cap+1 denial catches looser SQL
    // (or a CHECK exception instead of the required false RPC result).
    for (const rpc of [
      n => db.query('select public.consume_download_allowance($1, 0) as ok', [n]),
      n => db.query('select public.consume_pdf_export_allowance($1, $2, 1) as ok', [key(++receipt), n]),
      n => db.query('select public.consume_explanation_and_download_allowance(1, $1) as ok', [n]),
    ]) {
      await reset(MAX_DAILY_SIGNED_ASSETS - 1);
      assert.equal((await rpc(1)).rows[0].ok, true, 'TS daily asset cap must be reachable');
      assert.equal((await rpc(1)).rows[0].ok, false, 'SQL must deny above TS daily asset cap');
    }
    for (const rpc of [
      n => db.query('select public.consume_download_allowance(0, $1) as ok', [n]),
      n => db.query('select public.consume_pdf_export_allowance($1, 0, $2) as ok', [key(++receipt), n]),
    ]) {
      await reset(0, MAX_DAILY_PDF_QUESTIONS - 1);
      assert.equal((await rpc(1)).rows[0].ok, true, 'TS daily question cap must be reachable');
      assert.equal((await rpc(1)).rows[0].ok, false, 'SQL must deny above TS daily question cap');
      await reset();
      assert.equal((await rpc(MAX_PDF_QUESTIONS)).rows[0].ok, true, 'TS per-PDF cap must be reachable');
      assert.equal((await rpc(MAX_PDF_QUESTIONS + 1)).rows[0].ok, false, 'SQL must deny above TS per-PDF cap');
    }
    // Exercise CHECKs independently: an RPC-only assertion misses a too-loose
    // table constraint. The export count is nonnegative, with no policy ceiling.
    await reset();
    await db.exec('reset role');
    await db.query(`update public.download_usage_daily set signed_asset_count=$1,
      pdf_question_count=$2, pdf_export_count=1000000`, [MAX_DAILY_SIGNED_ASSETS, MAX_DAILY_PDF_QUESTIONS]);
    for (const [column, cap] of [
      ['signed_asset_count', MAX_DAILY_SIGNED_ASSETS],
      ['pdf_question_count', MAX_DAILY_PDF_QUESTIONS],
    ]) {
      await assert.rejects(db.query(`update public.download_usage_daily set ${column}=$1`, [cap + 1]),
        { code: '23514', constraint: `download_usage_daily_${column}_check` });
    }
    await assert.rejects(db.exec('update public.download_usage_daily set pdf_export_count=-1'),
      { code: '23514', constraint: 'download_usage_daily_pdf_export_count_check' });
  } finally { await db.close(); }
});

test('5000 shared daily assets: image, PDF and combined explanation boundaries are atomic', async () => {
  for (const path of ['image', 'pdf', 'explanation']) {
    const db = await setup();
    try {
      await as(db, student);
      const image = async (n) => (await db.query('select public.consume_download_allowance($1, 0) as ok', [n])).rows[0].ok;
      const mixed = async (n, count = 1) => (await db.query('select public.consume_explanation_and_download_allowance($1, $2) as ok', [count, n])).rows[0].ok;
      // Reach the boundary through real RPC calls, not a fixture-only row.
      for (let n = 0; n < 4; n++) assert.equal(await image(1000), true, path);
      assert.equal(await image(999), true, path);
      const consume = (n, k) => path === 'image' ? image(n) : path === 'pdf' ? exportPdf(db, key(k), 1, n) : mixed(n);
      assert.equal(await consume(1, 100), true, `${path}: 4999 + 1 allowed`);
      await db.exec('reset role');
      const full = (await db.query('select * from public.download_usage_daily')).rows;
      await as(db, student);
      assert.equal(await consume(1, 101), false, `${path}: 5000 + 1 denied`);
      assert.equal(await mixed(1), false, 'asset denial must not consume explanations');
      await db.exec('reset role');
      assert.deepEqual((await db.query('select * from public.download_usage_daily')).rows, full);
      assert.equal(full[0].signed_asset_count, 5000);
      // Explanation exhaustion must likewise not consume the remaining asset.
      await db.exec(`update public.download_usage_daily set signed_asset_count=4999, explanation_count=200`);
      const exhausted = (await db.query('select * from public.download_usage_daily')).rows;
      await as(db, student);
      assert.equal(await mixed(1), false, 'explanation denial must not consume assets');
      await db.exec('reset role');
      assert.deepEqual((await db.query('select * from public.download_usage_daily')).rows, exhausted);
      // Daily reset, not a rolling or weekly allowance.
      await db.exec('update public.download_usage_daily set usage_date=current_date-1');
      await as(db, student);
      assert.equal(await consume(1, 102), true);
      await db.exec('reset role');
      assert.equal((await db.query('select signed_asset_count from public.download_usage_daily where usage_date=current_date')).rows[0].signed_asset_count, 1);
    } finally { await db.close(); }
  }
});

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
      for (let n = 0; n < 2; n++) {
        assert.equal((await db.query('select public.consume_download_allowance(1000, 0) as ok')).rows[0].ok, true);
      }
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
