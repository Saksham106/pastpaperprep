#!/usr/bin/env node
/**
 * Local dry run of a planned private-R2 upload (no network, no R2 writes): re-hashes every file the bank's upload manifest
 * (data/storage/<bank>.manifest.json, from `igcse-release.mjs --dry-run <bank>`) names, checks it against the manifest and
 * the source segmentation record, and writes data/storage/<bank>.dry-run.json.
 *
 *   node scripts/release-dry-run.mjs <bank> <source-root> <source-commit> [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [bank, sourceRoot, sourceCommit, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!bank || !sourceRoot || !sourceCommit) throw new Error("Usage: release-dry-run.mjs <bank> <source-root> <source-commit> [date]");
const repo = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(repo, "data/storage", `${bank}.manifest.json`), "utf8"));
const segmentation = JSON.parse(readFileSync(path.join(sourceRoot, "data/segmentation/full/segmentation.json"), "utf8"));
const recorded = new Map(segmentation.papers.flatMap((paper) => paper.questions.flatMap((question) => [...question.question_images, ...question.markscheme_images].map((asset) => [asset.path.replace(/^assets\//, ""), asset.sha256]))));
const assetsRoot = `${path.join(sourceRoot, "data/segmentation/full/assets")}${path.sep}`;
let rehashed = 0, matchesRecord = 0, mismatches = 0, bytes = 0;
for (const asset of manifest.assets) {
  if (!asset.sourcePath.startsWith(assetsRoot)) throw new Error(`Asset outside the source assets folder: ${asset.sourcePath}`);
  const content = readFileSync(asset.sourcePath);
  const sha = createHash("sha256").update(content).digest("hex");
  rehashed += 1;
  if (sha !== asset.sha256 || content.length !== asset.size) mismatches += 1;
  if (recorded.get(asset.sourcePath.slice(assetsRoot.length)) === sha) matchesRecord += 1;
  bytes += asset.size;
}
const keys = new Set(manifest.assets.map((asset) => asset.objectKey));
const receipt = {
  schemaVersion: "igcse-upload-dry-run-v1",
  bank,
  date,
  mode: "dry_run_local_only",
  r2Writes: 0,
  bucket: "pastpaperprep-assets",
  objectPrefix: manifest.objectPrefix,
  objects: manifest.assets.length,
  bytes,
  uniqueKeys: keys.size,
  allKeysUnderNewPrefix: manifest.assets.every((asset) => asset.objectKey.startsWith(manifest.objectPrefix)),
  localSha256ReHashed: rehashed,
  sha256MatchesSegmentationRecord: matchesRecord,
  mismatches,
  originalCandidateRuntimeSha256: manifest.originalCandidateRuntimeSha256,
  sourceCommit,
  nextStep: `Owner approval in the session that runs it, then the create-only R2 Worker upload (scripts/r2-upload-worker) against data/storage/${bank}.manifest.json, then generate-igcse-release.mjs --finalize ${bank}. The free year goes to the free bucket with scripts/free-copy after the upload is read back.`,
};
writeFileSync(path.join(repo, "data/storage", `${bank}.dry-run.json`), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
if (mismatches || matchesRecord !== rehashed || keys.size !== manifest.assets.length) process.exitCode = 1;
