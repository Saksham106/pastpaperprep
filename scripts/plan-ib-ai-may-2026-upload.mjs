#!/usr/bin/env node
// Writes the exact crop upload plan for the IB Maths AI May 2026 rows (read-only: no network, no credentials, no upload).
//
//   node scripts/plan-ib-ai-may-2026-upload.mjs [out.json]
//
// Every 2026 key the committed runtime banks reference is listed with its SHA-256, size, MD5 (the R2 ETag the
// sync verifies) and source path. Uploading publishes the files and needs owner approval (AGENTS.md); at upload time
// each key must first be confirmed absent (`npm run r2:sync` puts only missing/mismatched keys).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { SOURCES, localManifest } from "./sync-r2-assets.mjs";

const REPO = resolve(import.meta.dirname, "..");
const out = resolve(process.argv[2] ?? `${REPO}/docs/ib-ai-may-2026-r2-upload-plan.json`);
const WORKSPACE = resolve(execFileSync("git", ["-C", REPO, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim(), "../..");
const sources = SOURCES.filter((source) => source.bank === "ib-ai-hl" || source.bank === "ib-ai-sl");
const entries = (await localManifest(sources)).filter((entry) => /^ib-ai-(hl|sl)\/(questions|markschemes)\/2026-may-/.test(entry.key));
const objects = [];
for (const entry of entries) {
  objects.push({
    key: entry.key,
    sha256: createHash("sha256").update(await readFile(entry.path)).digest("hex"),
    bytes: entry.size,
    md5: entry.etag,
    sourcePath: relative(WORKSPACE, entry.path),
  });
}
const summary = {};
for (const bank of ["ib-ai-hl", "ib-ai-sl"]) {
  const rows = objects.filter((object) => object.key.startsWith(`${bank}/`));
  summary[bank] = {
    objects: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    questions: rows.filter((row) => row.key.includes("/questions/")).length,
    markschemes: rows.filter((row) => row.key.includes("/markschemes/")).length,
  };
}
const plan = {
  schemaVersion: "ib-ai-may-2026-r2-upload-plan-v1",
  status: "planned-not-uploaded",
  bucket: "pastpaperprep-assets",
  contentType: "image/webp",
  cacheControl: "private, max-age=31536000, immutable",
  workspaceRoot: "ProjectsInternships (sibling source checkouts ib-maths-ai-{hl,sl}-topic-practice-may-2026/site)",
  precondition: "Every key must be confirmed absent in R2 before its put (2026 ids never existed in the AI banks). Existing 2021-2025 objects are not touched: their referenced files are byte-identical in the new checkouts.",
  summary,
  totalObjects: objects.length,
  totalBytes: objects.reduce((sum, row) => sum + row.bytes, 0),
  objects: objects.sort((a, b) => a.key.localeCompare(b.key)),
};
await writeFile(out, JSON.stringify(plan, null, 2) + "\n");
console.log(JSON.stringify({ out, summary, totalObjects: plan.totalObjects, totalBytes: plan.totalBytes }, null, 1));
