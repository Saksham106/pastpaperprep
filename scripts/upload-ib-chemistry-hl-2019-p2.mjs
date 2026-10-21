#!/usr/bin/env node
// Uploads the 129 private crops in docs/ib-chemistry-hl-2019-p2/r2-upload-plan.json to pastpaperprep-assets.
// Owner approval required (AGENTS.md). Needs `wrangler login`; no keys.
//
//   node scripts/upload-ib-chemistry-hl-2019-p2.mjs
//
// For each object: re-hash the source against the plan, check the key with `wrangler r2 object get`
// (the same bytes already there are left alone; different bytes abort the run), put it with the plan's
// content type and cache control, then read it back and compare SHA-256 and size. Every event goes to
// docs/ib-chemistry-hl-2019-p2/r2-upload-log.jsonl, in the format of the May 2026 log. Serialized by one
// local writer; not an atomic create, because wrangler has no conditional put.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireSingleWriterLock } from "./lib/single-writer-lock.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(readFileSync(join(root, "docs/ib-chemistry-hl-2019-p2/r2-upload-plan.json"), "utf8"));
const LOG = join(root, "docs/ib-chemistry-hl-2019-p2/r2-upload-log.jsonl");
const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
const workspace = resolve(dirname(common), "..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const wrangler = (args) => execFileSync("npx", ["-y", "wrangler@4", "r2", "object", ...args, "--remote"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
const scratch = mkdtempSync(join(tmpdir(), "ib-chem-hl-2019-p2-"));

function remote(key) {
  const file = join(scratch, "get.webp");
  rmSync(file, { force: true });
  try { wrangler(["get", `${plan.bucket}/${key}`, "--file", file]); } catch { return null; }
  return existsSync(file) ? readFileSync(file) : null;
}

if (plan.bucket !== "pastpaperprep-assets" || plan.mode !== "create-only") throw new Error("Unexpected plan target");
const lock = acquireSingleWriterLock("upload-ib-chemistry-hl-2019-p2");
let verified = 0, preexisting = 0;
try {
  for (const object of plan.objects) {
    const source = join(workspace, object.sourcePath);
    const bytes = readFileSync(source);
    if (sha(bytes) !== object.sha256 || bytes.byteLength !== object.bytes) throw new Error(`Source drift ${object.sourcePath}`);
    const before = remote(object.key);
    if (before && sha(before) !== object.sha256) throw new Error(`Different object already at ${object.key}; refusing to replace it`);
    if (!before) wrangler(["put", `${plan.bucket}/${object.key}`, "--file", source, "--content-type", plan.contentType, "--cache-control", plan.cacheControl]);
    const after = remote(object.key);
    if (!after || sha(after) !== object.sha256 || after.byteLength !== object.bytes) throw new Error(`Read-back mismatch ${object.key}`);
    appendFileSync(LOG, `${JSON.stringify({ bucket: plan.bucket, key: object.key, sha256: object.sha256, bytes: object.bytes, status: "verified", existedBefore: Boolean(before), at: new Date().toISOString() })}\n`);
    verified++; if (before) preexisting++;
    if (verified % 10 === 0) console.log(`${verified}/${plan.objects.length}`);
  }
} finally {
  lock.release?.();
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`verified ${verified}/${plan.objects.length} (${preexisting} already present with the same bytes)`);
