#!/usr/bin/env node
/**
 * Owner-approved, create-only upload of the IGCSE Computer Science 0478 release crops to the private
 * R2 bucket through the owner's logged-in Wrangler (OAuth; no keys are created, read or stored).
 *
 *   WRANGLER=<binary> node scripts/upload-igcse-computer-science-0478-wrangler.mjs [--concurrency 4] [--limit N]
 *
 * Per object: check each local file against the manifest (SHA-256, size, key prefix); `get` must report
 * the key absent; `put` with image/webp and private immutable caching; `get` again and compare SHA-256
 * and size. Each verified object appends one line to the log (key, SHA-256, bytes, timestamp; no
 * secrets), so a rerun resumes. A key that already exists is never overwritten: it is accepted only if
 * its bytes match the manifest, otherwise the run stops. When every object is verified, the
 * `verified_readback` receipt is written for `generate-igcse-release.mjs --finalize`.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { manifestSha256 } from "./igcse-release.mjs";

const BANK = "igcse-computer-science-0478";
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
  for (const [key, row] of done) {
    const asset = byKey.get(key);
    if (!asset || row.sha256 !== asset.sha256 || row.bytes !== asset.size || row.status !== "verified") throw new Error(`log line does not match manifest: ${key}`);
  }
  const limit = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : Infinity;
  const pending = manifest.assets.filter((asset) => !done.has(asset.objectKey)).slice(0, limit);
  console.log(JSON.stringify({ total: manifest.assets.length, alreadyVerified: done.size, pending: pending.length }));

  const call = wrangler();
  const dir = mkdtempSync(path.join(tmpdir(), "cs0478-r2-"));
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
          await call(["r2", "object", "put", `${BUCKET}/${asset.objectKey}`, "--file", asset.sourcePath,
            "--content-type", "image/webp", "--cache-control", "private, max-age=31536000, immutable", "--remote"]);
          const after = await get(call, dir, asset.objectKey);
          if (!after || sha256(after) !== asset.sha256 || after.length !== asset.size) throw new Error(`readback mismatch: ${asset.objectKey}`);
        }
        appendFileSync(LOG_PATH, `${JSON.stringify({ bank: BANK, key: asset.objectKey, sha256: asset.sha256, bytes: asset.size, status: "verified", existedBefore, at: new Date().toISOString() })}\n`);
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
  const keys = [...new Set(rows.map((row) => row.key))].sort();
  if (keys.length !== manifest.assets.length || manifest.assets.some((asset) => !keys.includes(asset.objectKey))) throw new Error("log does not cover the manifest");
  writeFileSync(receiptPath, `${JSON.stringify({
    schemaVersion: "igcse-upload-receipt-v1",
    bank: BANK,
    storageState: "verified_readback",
    assetManifestSha256: manifestSha256(manifest),
    completed: keys,
    failed: [],
    readbackProvenance: { method: "wrangler-oauth create-only get/put/get", log: path.relative(repo, LOG_PATH), logSha256: sha256(readFileSync(LOG_PATH)), existedBefore: rows.filter((row) => row.existedBefore).length },
  }, null, 2)}\n`);
  console.log(JSON.stringify({ verified: keys.length, receipt: path.relative(repo, receiptPath) }));
}

await main();
