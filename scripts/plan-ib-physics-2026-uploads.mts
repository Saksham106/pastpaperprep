#!/usr/bin/env tsx
// Writes the two exact, reviewable upload plans for the IB Physics May 2026 papers. Local only: it hashes
// files, reads no credentials, makes no network or storage call and uploads nothing. Uploading needs the
// owner's approval (AGENTS.md); the plans are `status: PLANNED, NOT UPLOADED`.
//
//   npx tsx scripts/plan-ib-physics-2026-uploads.mts [--check] <free-papers-plan.json>
//
// - Crops -> pastpaperprep-assets: key `<bank>/<servedPath>` for each of the 678 official question and
//   mark-scheme crops, from the source lane's asset inventory. Every file is re-hashed, and the key set must
//   equal the app's own asset paths for the 2026 rows (buildAssetRetentionPlan), so nothing is missing or extra.
// - PDFs -> pastpaperprep-free: the 36 PDFs the whole-paper manifests newly approve, from
//   `publish-added-free-papers.mts plan <base> <source-bindings> <work-dir>` (its plan.json, passed in).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const freePlanPath = args.find((arg) => !arg.startsWith("--"));
if (!freePlanPath) throw new Error("Usage: plan-ib-physics-2026-uploads.mts [--check] <free-papers-plan.json>");
const sourceRoot = join(resolve(root, "../../.."), "ib-physics-topic-practice/.worktrees/may-2026");
const BASE_COMMIT = "5d0f243624e449a7b589d83708145102e3b5bfb3";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const md5 = (bytes: Buffer) => createHash("md5").update(bytes).digest("hex");

type Asset = { bank: string; bytes: number; height: number; width: number; kind: "question" | "markscheme"; questionId: string; servedPath: string; sha256: string; sourcePath: string };
const inventoryBytes = readFileSync(join(sourceRoot, "data/may-2026/asset-inventory.json"));
const inventory = JSON.parse(inventoryBytes.toString("utf8")) as { schema: string; assets: Asset[] };
if (inventory.schema !== "ib-physics-2026-asset-inventory-v1") throw new Error("Unexpected asset inventory schema");

const objects = inventory.assets.map((asset) => {
  const bytes = readFileSync(join(sourceRoot, asset.sourcePath));
  if (bytes.length !== asset.bytes || sha(bytes) !== asset.sha256) throw new Error(`Source crop differs from the inventory: ${asset.sourcePath}`);
  if (!/^(questions|markschemes)\/2026-may-tz[123]-(hl|sl)-p(1a|1b|2)-q\d+-page-\d+\.webp$/.test(asset.servedPath)) throw new Error(`Unexpected key: ${asset.servedPath}`);
  if (!asset.servedPath.startsWith(asset.kind === "question" ? "questions/" : "markschemes/")) throw new Error(`Kind and key disagree: ${asset.servedPath}`);
  return { key: `${asset.bank}/${asset.servedPath}`, questionId: asset.questionId, kind: asset.kind, sourcePath: asset.sourcePath, sha256: asset.sha256, md5: md5(bytes), bytes: asset.bytes };
}).sort((a, b) => a.key.localeCompare(b.key));
if (new Set(objects.map((object) => object.key)).size !== objects.length) throw new Error("Duplicate object keys");

// The keys must be exactly the app's own paths for the 2026 rows.
const appKeys = new Set<string>();
for (const slug of ["ib-physics-hl", "ib-physics-sl"] as const) {
  const rows = loadBankQuestions(slug).filter((question) => question.year === 2026);
  for (const path of buildAssetRetentionPlan([{ slug, questions: rows }]).allPaths) appKeys.add(path);
}
const planned = new Set(objects.map((object) => object.key));
const missing = [...appKeys].filter((key) => !planned.has(key));
const extra = [...planned].filter((key) => !appKeys.has(key));
if (missing.length || extra.length) throw new Error(`Plan and app disagree: ${missing.length} missing, ${extra.length} extra`);

const perBank = Object.fromEntries(["ib-physics-hl", "ib-physics-sl"].map((bank) => {
  const rows = objects.filter((object) => object.key.startsWith(`${bank}/`));
  return [bank, { objects: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0) }];
}));
const assetsPlan = {
  schemaVersion: 1,
  addition: "ib-physics-may-2026",
  mode: "dry-run-upload-plan",
  status: "PLANNED, NOT UPLOADED (owner approval required)",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-assets",
  storageClass: "premium (2026 is not a free-preview year for IB Physics: FREE_QUESTION_YEARS is [2020]; no Supabase preview objects)",
  method: "Keys are `<bank>/<servedPath>` from the source lane's data/may-2026/asset-inventory.json; every source file was re-hashed, and the key set equals the app's asset paths for the 2026 rows (buildAssetRetentionPlan). Upload create-only: check each key absent, put with Content-Type image/webp and Cache-Control private, max-age=31536000, immutable, read back and compare SHA-256 and size.",
  source: { repository: "Saksham106/ib-physics-topic-practice", branch: "feat/may-2026-official", inventorySha256: sha(inventoryBytes), inventoryPath: "data/may-2026/asset-inventory.json" },
  appBaseCommit: BASE_COMMIT,
  runtimeRawSha256: { "ib-physics-hl": sha(readFileSync(join(root, "src/data/raw/ib-physics-hl.json"))), "ib-physics-sl": sha(readFileSync(join(root, "src/data/raw/ib-physics-sl.json"))) },
  objectCount: objects.length,
  totalBytes: objects.reduce((sum, object) => sum + object.bytes, 0),
  perBank,
  operatorNotes: ["Owner approval is required before any upload.", "No existing key is touched: every key is new (2026 file names)."],
  objects,
};

const freeRaw = JSON.parse(readFileSync(resolve(freePlanPath), "utf8")) as { base: string; approvedObjects: number; added: { sha256: string; bytes: number; name: string; relativePath: string; key: string }[] };
if (freeRaw.base !== BASE_COMMIT) throw new Error("Free-papers plan was made against another base");
const freePlan = {
  schemaVersion: 1,
  addition: "ib-physics-may-2026",
  mode: "dry-run-upload-plan",
  status: "PLANNED, NOT UPLOADED (owner approval required)",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-free",
  method: "Output of `scripts/publish-added-free-papers.mts plan` against the pinned base: the PDFs the committed whole-paper manifests approve and the base manifests do not. Every source was hash-checked against its binding. Upload with `publish-added-free-papers.mts upload` (key checked absent, put with application/pdf, `public, max-age=604800` and an attachment download name, read back by SHA-256 and size), then `verify`.",
  sourceDirectory: "ib-physics-topic-practice/.worktrees/may-2026/data/raw (36 official IB originals, SHA-256 pinned in data/may-2026/source-manifest.json)",
  appBaseCommit: BASE_COMMIT,
  approvedObjectsAfter: freeRaw.approvedObjects,
  objectCount: freeRaw.added.length,
  totalBytes: freeRaw.added.reduce((sum, row) => sum + row.bytes, 0),
  operatorNotes: ["Owner approval is required before any upload.", "Run `verify` afterwards: it rewrites src/data/paper-archive-readback.json only if every approved PDF matches."],
  objects: freeRaw.added,
};

const outputs: Record<string, unknown> = {
  "docs/ib-physics-may-2026/r2-upload-plan-assets.json": assetsPlan,
  "docs/ib-physics-may-2026/r2-upload-plan-free-papers.json": freePlan,
};
let drift = 0;
for (const [path, value] of Object.entries(outputs)) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const target = join(root, path);
  if (check) { if (!existsSync(target) || readFileSync(target, "utf8") !== text) { drift++; console.error(`DRIFT ${path}`); } } else writeFileSync(target, text);
}
if (drift) process.exit(1);
console.log(`${check ? "checked" : "wrote"} plans: assets ${objects.length} objects ${assetsPlan.totalBytes} bytes (${JSON.stringify(perBank)}); free papers ${freePlan.objectCount} PDFs ${freePlan.totalBytes} bytes`);
