#!/usr/bin/env node
// Publishes verified explanations: uploads JSON to R2 at explanations/<bank>/<id>.json, reads every
// object back, then records the IDs in src/data/explanations/available.json (IDs only; text stays out of Git).
//
//   node scripts/explanations/publish.mjs --bank ib-hl                 dry run: what would be published
//   node scripts/explanations/publish.mjs --bank ib-hl --apply         upload + read back + write available.json
//   node scripts/explanations/publish.mjs --bank ib-hl --verify-only   read back only, then write available.json
//
// Uploading needs owner approval. Two ways to reach R2:
//   default         a temporary bucket-scoped token as R2_SYNC_ACCESS_KEY_ID / R2_SYNC_SECRET_ACCESS_KEY
//   --via-wrangler  the owner's logged-in Wrangler (no token); set WRANGLER to a local binary to skip npx
// A question is publishable when the ledger marks it verified and validate.mjs passes.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { validateExplanation } from "./validate.mjs";
import { outputPathFor, researchRoot } from "./prepare-batch.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AVAILABLE = join(repoRoot, "src/data/explanations/available.json");
const PUBLISHABLE = new Set(["pass", "pass-after-fix", "pass-after-minor-fix"]);
const argv = process.argv.slice(2);
const bank = argv[argv.indexOf("--bank") + 1];
const apply = argv.includes("--apply");
const verifyOnly = argv.includes("--verify-only");
const viaWrangler = argv.includes("--via-wrangler");

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const SAFE = /^[A-Za-z0-9._-]+$/;
const objectKey = (id) => {
  const key = `explanations/${bank}/${id}.json`;
  if (!/^[a-z0-9-]+$/.test(bank) || !SAFE.test(id) || id === "." || id === "..") throw new Error(`Unsafe explanation key ${key}`);
  return key;
};

function publishable() {
  const ledgerPath = join(researchRoot, bank, "_ledger.json");
  if (!existsSync(ledgerPath)) throw new Error(`No ledger at ${ledgerPath}`);
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const out = [];
  const skipped = [];
  for (const row of ledger.rows) {
    const file = outputPathFor(bank, row.questionId);
    if (!PUBLISHABLE.has(row.status) || !existsSync(file)) { skipped.push(`${row.questionId}: ${row.status}`); continue; }
    const text = readFileSync(file, "utf8");
    const doc = JSON.parse(text);
    const errors = validateExplanation(doc, { bank, questionId: row.questionId });
    if (doc.status === "needs_review" || errors.length) { skipped.push(`${row.questionId}: ${errors[0] ?? "needs_review"}`); continue; }
    // Publish only the student-facing fields.
    const body = JSON.stringify({ schemaVersion: 1, bank, questionId: row.questionId, totalMarks: doc.totalMarks, parts: doc.parts });
    objectKey(row.questionId);
    out.push({ id: row.questionId, body, hash: sha256(body) });
  }
  return { out, skipped };
}

function client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_SYNC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SYNC_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error("R2_ACCOUNT_ID, R2_SYNC_ACCESS_KEY_ID and R2_SYNC_SECRET_ACCESS_KEY are required.");
  return new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
}

function s3Store(bucket) {
  const s3 = client();
  return {
    concurrency: 16,
    put: (key, body) => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/json", CacheControl: "private, max-age=600" })),
    get: async (key) => (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToString(),
    close: () => {},
  };
}

function wranglerStore(bucket) {
  const run = promisify(execFile);
  const [bin, ...prefix] = process.env.WRANGLER ? [process.env.WRANGLER] : ["npx", "-y", "wrangler@4"];
  const dir = mkdtempSync(join(tmpdir(), "explanations-"));
  const file = (key) => join(dir, key.replaceAll("/", "__"));
  // Cloudflare's API occasionally answers 5xx; retry with backoff instead of failing the whole run.
  const wrangler = async (args) => {
    for (let attempt = 1; ; attempt += 1) {
      try { return await run(bin, [...prefix, ...args], { maxBuffer: 1 << 24 }); }
      catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((resolveWait) => setTimeout(resolveWait, 1500 * attempt));
      }
    }
  };
  return {
    concurrency: 4,
    put: async (key, body) => {
      writeFileSync(file(key), body);
      await wrangler(["r2", "object", "put", `${bucket}/${key}`, "--file", file(key), "--content-type", "application/json", "--cache-control", "private, max-age=600", "--remote"]);
    },
    get: async (key) => {
      const target = `${file(key)}.read`;
      await wrangler(["r2", "object", "get", `${bucket}/${key}`, "--file", target, "--remote"]);
      return readFileSync(target, "utf8");
    },
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => { while (queue.length) await fn(queue.shift()); }));
}

async function main() {
  if (!bank) throw new Error("Pass --bank <slug>");
  const { out, skipped } = publishable();
  console.log(`${bank}: ${out.length} publishable, ${skipped.length} held back`);
  for (const line of skipped) console.log(`  held: ${line}`);
  if (!apply && !verifyOnly) { console.log("Dry run. Pass --apply to upload."); return; }

  const bucket = process.env.R2_BUCKET_NAME ?? "pastpaperprep-assets";
  const store = viaWrangler ? wranglerStore(bucket) : s3Store(bucket);
  if (apply) {
    let done = 0;
    await pool(out, store.concurrency, async (item) => {
      await store.put(objectKey(item.id), item.body);
      if (++done % 100 === 0) console.log(`  uploaded ${done}/${out.length}`);
    });
    console.log(`Uploaded ${out.length}`);
  }
  const verified = [];
  const mismatched = [];
  await pool(out, store.concurrency, async (item) => {
    try {
      if (sha256(await store.get(objectKey(item.id))) === item.hash) verified.push(item.id); else mismatched.push(item.id);
    } catch { mismatched.push(item.id); }
  });
  store.close();
  if (mismatched.length) {
    console.error(`Read-back failed for ${mismatched.length}: ${mismatched.slice(0, 20).join(", ")}`);
    console.error("available.json left unchanged. Fix the failures and rerun.");
    process.exitCode = 1;
    return;
  }
  const available = existsSync(AVAILABLE) ? JSON.parse(readFileSync(AVAILABLE, "utf8")) : {};
  available[bank] = verified.sort();
  writeFileSync(AVAILABLE, `${JSON.stringify(Object.fromEntries(Object.entries(available).sort()), null, 2)}\n`);
  console.log(`Verified ${verified.length}; wrote ${AVAILABLE}`);
}

await main();
