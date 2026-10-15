#!/usr/bin/env node
/**
 * Proves the May 2026 Economics addition is a pure append: every 2021-2025 row, paper and asset entry is
 * byte-identical to the base ref, the sealed storage receipt is untouched, existing Full past papers entries are
 * unchanged, and the new crops are all verified in the upload log.
 *
 *   node scripts/verify-ib-economics-2026-may-addition.mjs [--base-ref origin/main]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const refIndex = process.argv.indexOf("--base-ref");
const baseRef = refIndex > -1 ? process.argv[refIndex + 1] : process.env.BASE_REF ?? "5d0f243624e449a7b589d83708145102e3b5bfb3";
const baseBlob = (path) => execFileSync("git", ["show", `${baseRef}:${path}`], { cwd: root, maxBuffer: 1 << 28 });
const readCurrent = (path) => readFileSync(join(root, path));
const banks = ["ib-economics-hl", "ib-economics-sl"];
const errors = [];
const stable = (value) => JSON.stringify(value);

const untouched = [
  "src/data/ib-economics-taxonomy.json",
  "docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt.json",
  "docs/ib-economics-storage-receipts/ib-economics-representative-get-report.json",
  "docs/ib-economics-downstream-rights-attestation.json",
];
for (const path of untouched) if (!baseBlob(path).equals(readCurrent(path))) errors.push(`${path} differs from ${baseRef}`);

const proof = {};
for (const bank of banks) {
  const row = {};
  for (const [label, path] of [["production", `src/data/production/${bank}.json`], ["local-preview", `src/data/local-preview/${bank}.json`], ["private-index", `src/data/private-index/${bank}.json`]]) {
    const base = JSON.parse(baseBlob(path));
    const current = JSON.parse(readCurrent(path));
    const key = label === "private-index" ? ["questions"] : ["papers", "questions"];
    for (const field of key) {
      const prefix = current[field].slice(0, base[field].length);
      if (stable(prefix) !== stable(base[field])) errors.push(`${path}: ${field} prefix changed`);
      if (field === "questions") row[label] = { baseRows: base[field].length, addedRows: current[field].length - base[field].length };
    }
    const skip = new Set(["papers", "questions", "years", "runtimeArtifact"]);
    for (const field of Object.keys(base)) if (!skip.has(field) && stable(base[field]) !== stable(current[field])) errors.push(`${path}: header ${field} changed`);
  }
  const baseManifest = JSON.parse(baseBlob(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`));
  const currentManifest = JSON.parse(readCurrent(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`));
  const byKey = new Map(currentManifest.assets.map((asset) => [asset.objectKey, asset]));
  for (const asset of baseManifest.assets) if (stable(byKey.get(asset.objectKey)) !== stable(asset)) errors.push(`${bank}: sealed asset entry changed: ${asset.objectKey}`);
  row.assets = { base: baseManifest.assets.length, added: currentManifest.assets.length - baseManifest.assets.length };
  const baseArchive = JSON.parse(baseBlob(`src/data/paper-archives/${bank}.json`));
  const archive = JSON.parse(readCurrent(`src/data/paper-archives/${bank}.json`));
  const isNew = (paper) => paper.summary.id.includes("-2026-");
  const old = archive.papers.filter((paper) => !isNew(paper));
  if (stable(old) !== stable(baseArchive.papers)) errors.push(`${bank}: existing Full past papers entries changed`);
  row.archive = { existing: baseArchive.papers.length, added: archive.papers.filter(isNew).length };
  proof[bank] = row;
}

const log = readCurrent("docs/ib-economics-2026-may-r2-upload-log.jsonl").toString().split("\n").filter(Boolean).map((line) => JSON.parse(line));
if (log.length !== 287 || log.some((entry) => entry.status !== "verified" || entry.existedBefore !== false)) errors.push("upload log is not 287 verified create-only rows");

console.log(JSON.stringify({ baseRef, identical: errors.length === 0, proof, uploadedVerified: log.length, errors }, null, 2));
process.exit(errors.length ? 1 : 0);
