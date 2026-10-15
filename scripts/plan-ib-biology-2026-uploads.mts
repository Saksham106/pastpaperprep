#!/usr/bin/env tsx
// Writes the two exact, reviewable upload records for the IB Biology May 2026 papers. Local only: it hashes
// files, reads no credentials, makes no network or storage call and uploads nothing. The uploads were
// owner-approved and are DONE and read back (docs/ib-biology-may-2026/r2-upload-log-assets.jsonl and
// src/data/paper-archive-readback.json); this script only re-derives and checks the plans against the app.
//
//   npx tsx scripts/plan-ib-biology-2026-uploads.mts [--check] <free-papers-plan.json>
//
// - Crops -> pastpaperprep-assets: key `<bank>/<servedPath>` for each of the 678 official question and
//   mark-scheme crops, from the source lane's asset inventory. Every file is re-hashed, and the key set must
//   equal the app's own asset paths for the 2026 rows (buildAssetRetentionPlan) plus the crops of any question
//   withheld from practice (their crops were uploaded before the withhold and stay in storage), so nothing is
//   missing or extra.
// - PDFs -> pastpaperprep-free: the 36 PDFs the whole-paper manifests newly approve, from
//   `publish-added-free-papers.mts plan <base> <source-bindings> <work-dir>` (its plan.json, passed in).
//   The input is not trusted: its membership is re-derived from the base and head manifests and every key,
//   hash, size and download name is compared (scripts/lib/approved-free-plan.ts) before it is called approved.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";
import type { WholePaperManifest } from "@/lib/whole-paper-types";
import { assertPlanIsApprovedMembership, type FreePlanInput } from "./lib/approved-free-plan";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const freePlanPath = args.find((arg) => !arg.startsWith("--"));
if (!freePlanPath) throw new Error("Usage: plan-ib-biology-2026-uploads.mts [--check] <free-papers-plan.json>");
const sourceRoot = join(resolve(root, "../../.."), "ib-biology-topic-practice/.worktrees/may-2026");
const BASE_COMMIT = "18d8b98df165fad17c4f632e8a156214c27227fa";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const md5 = (bytes: Buffer) => createHash("md5").update(bytes).digest("hex");

type Asset = { bank: string; bytes: number; height: number; width: number; kind: "question" | "markscheme"; questionId: string; servedPath: string; sha256: string; sourcePath: string };
const inventoryBytes = readFileSync(join(sourceRoot, "data/release-2026/asset-inventory.json"));
const inventory = JSON.parse(inventoryBytes.toString("utf8")) as { schema: string; assets: Asset[] };
if (inventory.schema !== "ib-biology-2026-asset-inventory-v1") throw new Error("Unexpected asset inventory schema");

const objects = inventory.assets.map((asset) => {
  const bytes = readFileSync(join(sourceRoot, asset.sourcePath));
  if (bytes.length !== asset.bytes || sha(bytes) !== asset.sha256) throw new Error(`Source crop differs from the inventory: ${asset.sourcePath}`);
  if (!/^(questions|markschemes)\/2026-may-tz[123]-(hl|sl)-p(1a|1b|2)-q\d+-page-\d+\.webp$/.test(asset.servedPath)) throw new Error(`Unexpected key: ${asset.servedPath}`);
  if (!asset.servedPath.startsWith(asset.kind === "question" ? "questions/" : "markschemes/")) throw new Error(`Kind and key disagree: ${asset.servedPath}`);
  return { key: `${asset.bank}/${asset.servedPath}`, questionId: asset.questionId, kind: asset.kind, sourcePath: asset.sourcePath, sha256: asset.sha256, md5: md5(bytes), bytes: asset.bytes };
}).sort((a, b) => a.key.localeCompare(b.key));
if (new Set(objects.map((object) => object.key)).size !== objects.length) throw new Error("Duplicate object keys");

// The keys must be exactly the app's own paths for the 2026 rows, plus the crops of withheld questions.
const withheldIds = new Set<string>();
for (const slug of ["ib-biology-hl", "ib-biology-sl"]) {
  const header = JSON.parse(readFileSync(join(root, `src/data/raw/${slug}.json`), "utf8")) as { may2026Release: { excludedFromPractice: { id: string }[] } };
  for (const row of header.may2026Release.excludedFromPractice) withheldIds.add(row.id);
}
const withheldKeys = new Set(objects.filter((object) => withheldIds.has(object.questionId)).map((object) => object.key));
if (withheldKeys.size === 0 && withheldIds.size > 0) throw new Error("A withheld question has no planned crops");
const appKeys = new Set<string>();
for (const slug of ["ib-biology-hl", "ib-biology-sl"] as const) {
  const rows = loadBankQuestions(slug).filter((question) => question.year === 2026);
  for (const path of buildAssetRetentionPlan([{ slug, questions: rows }]).allPaths) appKeys.add(path);
}
const planned = new Set(objects.map((object) => object.key));
for (const key of withheldKeys) if (appKeys.has(key)) throw new Error(`A withheld question's crop is still served: ${key}`);
const missing = [...appKeys].filter((key) => !planned.has(key));
const extra = [...planned].filter((key) => !appKeys.has(key) && !withheldKeys.has(key));
if (missing.length || extra.length) throw new Error(`Plan and app disagree: ${missing.length} missing, ${extra.length} extra`);

const perBank = Object.fromEntries(["ib-biology-hl", "ib-biology-sl"].map((bank) => {
  const rows = objects.filter((object) => object.key.startsWith(`${bank}/`));
  return [bank, { objects: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0) }];
}));
const assetsPlan = {
  schemaVersion: 1,
  addition: "ib-biology-may-2026",
  mode: "dry-run-upload-plan",
  status: "UPLOADED AND READ BACK (owner-approved, 2026-10-15): 678 of 678 crops, see r2-upload-log-assets.jsonl",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-assets",
  storageClass: "premium (2026 is not a free-preview year for IB Biology: FREE_QUESTION_YEARS is [2020]; no Supabase preview objects)",
  method: "Keys are `<bank>/<servedPath>` from the source lane's data/release-2026/asset-inventory.json; every source file was re-hashed, and the key set equals the app's asset paths for the 2026 rows (buildAssetRetentionPlan) plus the crops of withheld questions. Upload, serialized: check each key absent, put with Content-Type image/webp and Cache-Control private, max-age=31536000, immutable, then read back and compare SHA-256 and size. This is not an atomic create: wrangler has no conditional put, so a concurrent writer between the check and the put cannot be ruled out.",
  source: { repository: "Saksham106/ib-biology-topic-practice", branch: "feat/may-2026-official", inventorySha256: sha(inventoryBytes), inventoryPath: "data/release-2026/asset-inventory.json" },
  appBaseCommit: BASE_COMMIT,
  runtimeRawSha256: { "ib-biology-hl": sha(readFileSync(join(root, "src/data/raw/ib-biology-hl.json"))), "ib-biology-sl": sha(readFileSync(join(root, "src/data/raw/ib-biology-sl.json"))) },
  objectCount: objects.length,
  servedObjectCount: objects.length - withheldKeys.size,
  withheldFromPractice: { questionIds: [...withheldIds].sort(), objectCount: withheldKeys.size, note: "Uploaded before the question was withheld; left in storage and not served. Nothing was deleted or overwritten." },
  totalBytes: objects.reduce((sum, object) => sum + object.bytes, 0),
  perBank,
  operatorNotes: ["Uploaded with owner approval; every key was new (2026 file names) and read back by SHA-256 and size.", "Re-uploading, replacing or deleting any object needs fresh owner approval."],
  objects: objects.map((object) => (withheldKeys.has(object.key) ? { ...object, withheldFromPractice: true } : object)),
};

const freeRaw = JSON.parse(readFileSync(resolve(freePlanPath), "utf8")) as FreePlanInput;
if (freeRaw.base !== BASE_COMMIT) throw new Error("Free-papers plan was made against another base");
// Do not trust `added`: derive the newly approved PDFs from the base and head manifests and compare exactly.
const MANIFEST_DIR = "src/data/paper-archives";
const headManifests = readdirSync(join(root, MANIFEST_DIR)).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(root, MANIFEST_DIR, f), "utf8")) as WholePaperManifest);
const baseManifests = execFileSync("git", ["-C", root, "ls-tree", "--name-only", `${BASE_COMMIT}:${MANIFEST_DIR}`], { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(execFileSync("git", ["-C", root, "show", `${BASE_COMMIT}:${MANIFEST_DIR}/${f}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })) as WholePaperManifest);
assertPlanIsApprovedMembership(freeRaw, baseManifests, headManifests);
const freePlan = {
  schemaVersion: 1,
  addition: "ib-biology-may-2026",
  mode: "dry-run-upload-plan",
  status: "UPLOADED AND READ BACK (owner-approved, 2026-10-15): 36 of 36 PDFs; `verify` re-read all 5,020 approved PDFs",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-free",
  method: "Output of `scripts/publish-added-free-papers.mts plan` against the pinned base, re-derived here from the base and head manifests (the PDFs the committed whole-paper manifests approve and the base manifests do not; keys, hashes, sizes and names compared exactly). Every source was hash-checked against its binding. Uploaded with `publish-added-free-papers.mts upload`, serialized: key checked absent, put with application/pdf, `public, max-age=604800` and an attachment download name, read back by SHA-256 and size; then `verify`. Not an atomic create: wrangler has no conditional put.",
  sourceDirectory: "ib-biology-topic-practice/.worktrees/may-2026/data/raw-2026 (36 official IB originals, SHA-256 pinned in data/source-manifest-2026.json)",
  appBaseCommit: BASE_COMMIT,
  approvedObjectsAfter: freeRaw.approvedObjects,
  objectCount: freeRaw.added.length,
  totalBytes: freeRaw.added.reduce((sum, row) => sum + row.bytes, 0),
  operatorNotes: ["Uploaded with owner approval and verified; src/data/paper-archive-readback.json records the readback.", "Report holds (data/paper-archives/report-holds.json) never change which PDFs are approved or downloadable."],
  objects: freeRaw.added,
};

const outputs: Record<string, unknown> = {
  "docs/ib-biology-may-2026/r2-upload-plan-assets.json": assetsPlan,
  "docs/ib-biology-may-2026/r2-upload-plan-free-papers.json": freePlan,
};
let drift = 0;
for (const [path, value] of Object.entries(outputs)) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const target = join(root, path);
  if (check) { if (!existsSync(target) || readFileSync(target, "utf8") !== text) { drift++; console.error(`DRIFT ${path}`); } } else writeFileSync(target, text);
}
if (drift) process.exit(1);
console.log(`${check ? "checked" : "wrote"} plans: assets ${objects.length} objects ${assetsPlan.totalBytes} bytes (${JSON.stringify(perBank)}); free papers ${freePlan.objectCount} PDFs ${freePlan.totalBytes} bytes`);
