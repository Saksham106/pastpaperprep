#!/usr/bin/env node
// Publishes verified explanations: uploads JSON to R2 at explanations/<bank>/<id>.json, reads every
// object back, then records the IDs in src/data/explanations/available.json (IDs only; text stays out of Git).
//
//   node scripts/explanations/publish.mjs --bank ib-hl                 dry run: what would be published
//   node scripts/explanations/publish.mjs --bank ib-hl --apply         upload + read back + write available.json
//   node scripts/explanations/publish.mjs --bank ib-hl --verify-only   read back only, then write available.json
//
// Uploading needs owner approval and a temporary bucket-scoped token, exposed only as
// R2_SYNC_ACCESS_KEY_ID / R2_SYNC_SECRET_ACCESS_KEY (same rule as npm run r2:sync).
// A question is publishable when the ledger marks it verified and validate.mjs passes.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const objectKey = (id) => `explanations/${bank}/${id}.json`;

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

  const s3 = client();
  const bucket = process.env.R2_BUCKET_NAME ?? "pastpaperprep-assets";
  if (apply) {
    await pool(out, 16, async (item) => {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey(item.id), Body: item.body, ContentType: "application/json", CacheControl: "private, max-age=600" }));
    });
    console.log(`Uploaded ${out.length}`);
  }
  const verified = [];
  const mismatched = [];
  await pool(out, 16, async (item) => {
    try {
      const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(item.id) }));
      const text = await response.Body.transformToString();
      if (sha256(text) === item.hash) verified.push(item.id); else mismatched.push(item.id);
    } catch { mismatched.push(item.id); }
  });
  if (mismatched.length) {
    console.error(`Read-back failed for ${mismatched.length}: ${mismatched.slice(0, 20).join(", ")}`);
    process.exitCode = 1;
  }
  const available = existsSync(AVAILABLE) ? JSON.parse(readFileSync(AVAILABLE, "utf8")) : {};
  available[bank] = verified.sort();
  writeFileSync(AVAILABLE, `${JSON.stringify(Object.fromEntries(Object.entries(available).sort()), null, 2)}\n`);
  console.log(`Verified ${verified.length}; wrote ${AVAILABLE}`);
}

await main();
