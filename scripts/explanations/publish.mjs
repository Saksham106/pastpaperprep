#!/usr/bin/env node
// Publishes verified explanations: uploads JSON to R2 at explanations/<bank>/<id>.json, reads every
// object back, then records the IDs in src/data/explanations/available.json (IDs only; text stays out of Git).
//
//   node scripts/explanations/publish.mjs --bank ib-hl                 dry run: what would be published
//   node scripts/explanations/publish.mjs --bank ib-hl --apply         upload + read back + write available.json
//   node scripts/explanations/publish.mjs --bank ib-hl --verify-only   read back only, then write available.json
//   ... --apply --replace id1,id2   deliberately replace those named objects after a correction; each must
//                                   be publishable now (its current text passed verification)
//
// Uploading needs owner approval. Two ways to reach R2:
//   default         a temporary bucket-scoped token as R2_SYNC_ACCESS_KEY_ID / R2_SYNC_SECRET_ACCESS_KEY
//   --via-wrangler  the owner's logged-in Wrangler. Create-if-absent is checked (look, then put), not atomic:
//                   safe for one operator publishing at a time. Set WRANGLER to a local binary to skip npx.
// A question is publishable when the ledger marks it verified and validate.mjs passes.
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { validateExplanation } from "./validate.mjs";
import { BANKS, outputPathFor, researchRoot } from "./prepare-batch.mjs";
import { loadLocalPath } from "./local-files.mjs";
import { publishSet } from "./publish-set.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AVAILABLE = join(repoRoot, "src/data/explanations/available.json");
const PUBLISHABLE = new Set(["pass", "pass-after-fix", "pass-after-minor-fix"]);
const argv = process.argv.slice(2);
const bank = argv[argv.indexOf("--bank") + 1];
const apply = argv.includes("--apply");
const verifyOnly = argv.includes("--verify-only");
const viaWrangler = argv.includes("--via-wrangler");
const replaceIds = argv.includes("--replace") ? new Set(String(argv[argv.indexOf("--replace") + 1] ?? "").split(",").filter(Boolean)) : new Set();

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
  const ledger = JSON.parse(loadLocalPath(researchRoot, ledgerPath));
  const config = BANKS[bank];
  if (!config || ledger.bank !== bank || !Array.isArray(ledger.rows)) throw new Error("Invalid bank ledger");
  const raw = JSON.parse(readFileSync(join(repoRoot, config.data), "utf8"));
  const questions = new Map((raw.questions ?? raw).map(q => [q.id, q]));
  const out = [];
  const skipped = [];
  const seen = new Set();
  for (const row of ledger.rows) {
    objectKey(row.questionId);
    if (seen.has(row.questionId)) throw new Error(`Duplicate ledger ID ${row.questionId}`);
    seen.add(row.questionId);
    if (ledger.bankEvidenceVersion !== 1 || row.bankEvidenceVersion !== 1 || row.bank !== bank) {
      skipped.push(`${row.questionId}: bank-scoped replay required`); continue;
    }
    const q = questions.get(row.questionId);
    if (!q) { skipped.push(`${row.questionId}: unknown runtime question`); continue; }
    const marks = q.marks ?? q.maxMarks ?? q.maximumMarks;
    if (!Number.isInteger(marks) || marks <= 0) { skipped.push(`${row.questionId}: unknown runtime marks`); continue; }
    const file = outputPathFor(bank, row.questionId);
    if (!PUBLISHABLE.has(row.status) || !existsSync(file)) { skipped.push(`${row.questionId}: ${row.status}`); continue; }
    const text = loadLocalPath(researchRoot, file);
    const doc = JSON.parse(text);
    const errors = validateExplanation(doc, { bank, questionId: row.questionId, marks });
    if (doc.status === "needs_review" || errors.length) { skipped.push(`${row.questionId}: ${errors[0] ?? "needs_review"}`); continue; }
    // Publish only the student-facing fields.
    const body = JSON.stringify({ schemaVersion: 1, bank, questionId: row.questionId, totalMarks: doc.totalMarks, parts: doc.parts });
    objectKey(row.questionId);
    out.push({ id: row.questionId, body, hash: sha256(body), status: row.status });
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
    putIfAbsent: (key, body) => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, IfNoneMatch: "*", ContentType: "application/json", CacheControl: "private, max-age=600" })),
    replace: (key, body) => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/json", CacheControl: "private, max-age=600" })),
    get: async (key) => (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToString(),
    close: () => {},
  };
}

function wranglerStore(bucket) {
  const run = promisify(execFile);
  const [bin, ...prefix] = process.env.WRANGLER ? [process.env.WRANGLER] : ["npx", "-y", "wrangler@4"];
  const dir = mkdtempSync(join(tmpdir(), "explanations-"));
  const file = (key) => join(dir, key.replaceAll("/", "__"));
  const missing = (error) => /does not exist|NoSuchKey|\b404\b|not found/i.test(`${error?.stderr ?? ""} ${error?.stdout ?? ""} ${error?.message ?? ""}`);
  // Cloudflare's API occasionally answers 5xx; retry with backoff instead of failing the whole run.
  const wrangler = async (args) => {
    for (let attempt = 1; ; attempt += 1) {
      try { return await run(bin, [...prefix, ...args], { maxBuffer: 1 << 24 }); }
      catch (error) {
        // "Does not exist" is an answer, not a transient failure: never retry it.
        if (attempt >= 5 || missing(error)) throw error;
        await new Promise((resolveWait) => setTimeout(resolveWait, 1500 * attempt));
      }
    }
  };
  const read = async (key) => {
    const target = `${file(key)}.read`;
    await wrangler(["r2", "object", "get", `${bucket}/${key}`, "--file", target, "--remote"]);
    return readFileSync(target, "utf8");
  };
  const seen = new Map();
  const upload = async (key, body) => {
    writeFileSync(file(key), body);
    await wrangler(["r2", "object", "put", `${bucket}/${key}`, "--file", file(key), "--content-type", "application/json", "--cache-control", "private, max-age=600", "--remote"]);
  };
  return {
    replace: upload,
    // Never replace: an existing object is reported as a precondition failure, and publishSet
    // then accepts it only if its bytes match. A brief look-then-put window remains.
    putIfAbsent: async (key, body) => {
      try { seen.set(key, await read(key)); } catch (error) {
        if (!missing(error)) throw error;
        await upload(key, body);
        return;
      }
      throw Object.assign(new Error("Object already exists"), { name: "PreconditionFailed" });
    },
    get: async (key) => {
      if (seen.has(key)) { const body = seen.get(key); seen.delete(key); return body; }
      return read(key);
    },
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function main() {
  if (!bank || !/^[a-z0-9-]+$/.test(bank)) throw new Error("Pass --bank <safe slug>");
  if (apply && verifyOnly) throw new Error("--apply and --verify-only are mutually exclusive");
  const { out, skipped } = publishable();
  const byId = new Map(out.map((item) => [item.id, item]));
  for (const id of replaceIds) {
    const item = byId.get(id);
    if (!item) throw new Error(`--replace ${id}: not publishable`);
  }
  if (replaceIds.size && !apply) throw new Error("--replace needs --apply");
  console.log(`${bank}: ${out.length} publishable, ${skipped.length} held back`);
  for (const line of skipped) console.log(`  held: ${line}`);
  if (!apply && !verifyOnly) { console.log("Dry run. Pass --apply to upload."); return; }

  const bucket = process.env.R2_BUCKET_NAME ?? "pastpaperprep-assets";
  const store = viaWrangler ? wranglerStore(bucket) : s3Store(bucket);
  const receiptDir = join(researchRoot, bank, "_publish-receipts");
  mkdirSync(receiptDir, { recursive: true });
  const expected = out.map(item => ({ key: objectKey(item.id), body: item.body }));
  const setHash = sha256(JSON.stringify(expected.map(({key, body}) => ({key, sha256: sha256(body)}))));
  if (realpathSync(receiptDir) !== receiptDir) throw new Error("Unsafe receipt directory symlink");
  const receiptPath = join(receiptDir, `${setHash}-${randomUUID()}.json`);
  let verified;
  try {
    for (const id of replaceIds) {
      await store.replace(objectKey(id), byId.get(id).body);
      console.log(`  replaced ${objectKey(id)}`);
    }
    const keys = await publishSet(expected, store, { apply, receipt: (state) => {
      const temp = `${receiptPath}.${process.pid}.tmp`;
      writeFileSync(temp, `${JSON.stringify({ bank, bucket, setHash, ...state }, null, 2)}\n`, { flush: true, flag: "wx" });
      renameSync(temp, receiptPath);
    } });
    verified = keys.map(key => key.slice(`explanations/${bank}/`.length, -5));
  } finally { store.close(); }
  const available = existsSync(AVAILABLE) ? JSON.parse(readFileSync(AVAILABLE, "utf8")) : {};
  available[bank] = verified.sort();
  const tempAvailable = `${AVAILABLE}.${process.pid}.tmp`;
  writeFileSync(tempAvailable, `${JSON.stringify(Object.fromEntries(Object.entries(available).sort()), null, 2)}\n`, { flush: true, flag: "wx" });
  renameSync(tempAvailable, AVAILABLE);
  console.log(`Verified ${verified.length}; wrote ${AVAILABLE}`);
}

await main();
