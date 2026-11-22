#!/usr/bin/env node
/**
 * Verifies, logs and seals a bank's private R2 objects through the owner's logged-in Wrangler (OAuth; no keys are
 * created, read or stored). This script NO LONGER UPLOADS: Wrangler's `r2 object put` has no conditional
 * (If-None-Match) option, so a check-absent-then-put can overwrite a concurrent writer and cannot be made atomic.
 * New writes go through scripts/r2-upload-worker/upload.mjs (atomic `If-None-Match: *` put, R2-checked SHA-256,
 * read-back; same log rows and receipt). This script remains for objects that are already in the bucket:
 * it reads each key back, accepts it only when its bytes match the manifest, logs it, and writes the
 * `verified_readback` receipt for `generate-igcse-release.mjs --finalize`. A key that is absent stops the run
 * with a pointer to the Worker uploader.
 *
 *   WRANGLER=<binary> node scripts/upload-computer-science-wrangler.mjs [--bank <bank>] [--concurrency 4] [--limit N]
 *
 *   --bank   igcse-computer-science-0478 (default, the original behaviour), ib-computer-science-hl,
 *            ib-computer-science-sl, a-level-maths-9709, a-level-physics-9702, a-level-chemistry-9701, a-level-biology-9700, a-level-economics-9708 or a-level-computer-science-9618 (same lane; the file name is historical). Each bank reads data/storage/<bank>.manifest.json, appends to
 *            docs/<bank>-r2-upload-log.jsonl and writes data/storage/<bank>.receipt.json.
 *
 * Per object: check each local file against the manifest (SHA-256, size, key prefix), then `get` the key. An existing key is
 * accepted only if its bytes match the manifest, otherwise the run stops; this script never writes. Each verified object
 * appends one line to the log (key, SHA-256, bytes, timestamp; no secrets), so a rerun resumes.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { manifestSha256 } from "./igcse-release.mjs";
import { composeUploadReceipt, indexLogRows, verifiedLogRow } from "./lib/upload-receipt.mjs";

const BANKS = ["igcse-computer-science-0478", "ib-computer-science-hl", "ib-computer-science-sl", "a-level-maths-9709", "a-level-physics-9702", "a-level-chemistry-9701", "a-level-biology-9700", "a-level-economics-9708", "a-level-computer-science-9618"];
const bankFlag = process.argv.indexOf("--bank");
const BANK = bankFlag === -1 ? BANKS[0] : process.argv[bankFlag + 1];
if (!BANKS.includes(BANK)) throw new Error(`--bank must be one of ${BANKS.join(", ")}`);
const BUCKET = "pastpaperprep-assets";
const repo = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(repo, "data/storage", `${BANK}.manifest.json`);
const receiptPath = path.join(repo, "data/storage", `${BANK}.receipt.json`);
export const LOG_PATH = path.join(repo, "docs", `${BANK}-r2-upload-log.jsonl`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = promisify(execFile);

function wrangler() {
  const [bin, ...prefix] = process.env.WRANGLER ? [process.env.WRANGLER] : ["npx", "-y", "wrangler@4"];
  // R2's API rate-limits bursts (429); back off and retry those only. Every other error propagates.
  return async (args) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await run(bin, [...prefix, ...args], { maxBuffer: 1 << 26, cwd: tmpdir() });
      } catch (error) {
        const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
        if (!output.includes("429") || attempt >= 6) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
      }
    }
  };
}

async function get(call, dir, key) {
  const target = path.join(dir, `${sha256(key)}.webp`);
  rmSync(target, { force: true });
  try {
    await call(["r2", "object", "get", `${BUCKET}/${key}`, "--file", target, "--remote"]);
  } catch (error) {
    if (`${error.stdout ?? ""}${error.stderr ?? ""}`.includes("The specified key does not exist")) return null;
    throw new Error(`wrangler get failed for ${key}`);
  }
  const bytes = readFileSync(target);
  rmSync(target, { force: true });
  return bytes;
}

async function main() {
  const concurrency = Number(process.argv[process.argv.indexOf("--concurrency") + 1]) || 4;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.bank !== BANK || manifest.storageState !== "pending_upload") throw new Error("unexpected manifest state");
  for (const asset of manifest.assets) {
    if (!asset.objectKey.startsWith(manifest.objectPrefix) || asset.contentType !== "image/webp") throw new Error(`bad key or type: ${asset.objectKey}`);
    const bytes = readFileSync(asset.sourcePath);
    if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256) throw new Error(`local file drifted: ${asset.sourcePath}`);
  }
  const done = new Map();
  if (existsSync(LOG_PATH)) {
    for (const line of readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean)) {
      const row = JSON.parse(line);
      done.set(row.key, row);
    }
  }
  const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
  // A crop revision replaces a verified key with a new `<stem>.v2.webp` key (the original stays in the bucket, unreferenced).
  // Only such superseded originals may sit in the log outside the manifest; anything else still fails closed (shared rule).
  const superseded = new Set();
  const indexed = indexLogRows([...done.values()], byKey, superseded);
  done.clear();
  for (const [key, row] of indexed) done.set(key, row);
  const limit = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : Infinity;
  const pending = manifest.assets.filter((asset) => !done.has(asset.objectKey)).slice(0, limit);
  console.log(JSON.stringify({ total: manifest.assets.length, alreadyVerified: done.size, superseded: superseded.size, pending: pending.length }));

  const call = wrangler();
  const dir = mkdtempSync(path.join(tmpdir(), `${BANK}-r2-`));
  let index = 0;
  let verified = done.size;
  let failure = null;
  const worker = async () => {
    while (!failure && index < pending.length) {
      const asset = pending[index++];
      try {
        const before = await get(call, dir, asset.objectKey);
        let existedBefore = false;
        if (before) {
          if (sha256(before) !== asset.sha256 || before.length !== asset.size) throw new Error(`existing object differs; not overwriting: ${asset.objectKey}`);
          existedBefore = true;
        } else {
          throw new Error(`${asset.objectKey} is not in the bucket, and this script no longer writes (a Wrangler put cannot be create-only). Upload with: node scripts/r2-upload-worker/upload.mjs deploy|upload --bank ${BANK} --work <private dir> (owner approval required)`);
        }
        appendFileSync(LOG_PATH, `${JSON.stringify(verifiedLogRow({ bank: BANK, asset, existedBefore }))}\n`);
        verified += 1;
        if (verified % 50 === 0) console.log(JSON.stringify({ verified, total: manifest.assets.length }));
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  rmSync(dir, { recursive: true, force: true });
  if (failure) throw failure;

  if (Number.isFinite(limit)) { console.log(JSON.stringify({ verified, total: manifest.assets.length, stoppedAtLimit: limit })); return; }
  const rows = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const receipt = composeUploadReceipt({
    bank: BANK, manifest, rows, manifestSha256,
    method: "wrangler-oauth read-back of objects already in the bucket (no put; not atomic create-only)",
    logPath: path.relative(repo, LOG_PATH), logSha256: sha256(readFileSync(LOG_PATH)), supersededKeys: [...superseded],
  });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const keys = receipt.completed;
  console.log(JSON.stringify({ verified: keys.length, receipt: path.relative(repo, receiptPath) }));
}

await main();
