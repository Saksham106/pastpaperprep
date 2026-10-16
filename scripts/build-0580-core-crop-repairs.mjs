#!/usr/bin/env node
// Reviewed crop-boundary repairs for the live 0580 Core 2021-2025 question crops.
//
// Reads, read-only, the 0580 source worktree's repair receipt
// (data/core-2021-2025/crop-repair-receipt-2026-10-14.json) and its repaired question crops,
// and writes three app files:
//   src/data/reviewed-0580-core-crop-repairs.json          old path -> new immutable key overlay
//   src/data/print-geometry-0580-core-crop-repairs.json    print geometry of the new images
//   docs/igcse-0580-core-crop-repairs-r2-upload-plan.json  create-only R2 upload plan
//
// Every repaired image gets a new content-addressed key under its own namespace, so no
// uploaded key is ever reused. The raw bank, the historical print geometry and every storage
// receipt stay byte-identical. Mark-scheme repairs in the receipt are lane-only (the app
// already serves the reviewed maths-source grid repair for those rows) and are verified, not
// mapped.
//
//   node scripts/build-0580-core-crop-repairs.mjs --source <0580 source worktree> [--check]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { buildGeometry } from "./generate-print-geometry-0580.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RECEIPT = "data/core-2021-2025/crop-repair-receipt-2026-10-14.json";
const REGISTRY = "data/core-2021-2025/question-images.json";
const OVERLAY = join(ROOT, "src/data/reviewed-0580-core-crop-repairs.json");
const GEOMETRY = join(ROOT, "src/data/print-geometry-0580-core-crop-repairs.json");
const PLAN = join(ROOT, "docs/igcse-0580-core-crop-repairs-r2-upload-plan.json");
const LOG = "docs/igcse-0580-core-crop-repairs-r2-upload-log.jsonl";
const BUCKET = "pastpaperprep-assets";

const fail = (message) => { throw new Error(`0580 Core crop repairs: ${message}`); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
if (sourceIndex < 0 || !args[sourceIndex + 1]) fail("--source <0580 source worktree> is required");
const source = resolve(args[sourceIndex + 1]);

const receiptBytes = readFileSync(join(source, RECEIPT));
const receipt = JSON.parse(receiptBytes);
const receiptSha256 = sha256(receiptBytes);
const namespace = `repairs/0580-core-crops-v1-${receiptSha256.slice(0, 16)}`;

const raw = JSON.parse(readFileSync(join(ROOT, "src/data/raw/igcse.json"), "utf8"));
const rawById = new Map(raw.questions.map((row) => [row.id, row]));
const historical = JSON.parse(readFileSync(join(ROOT, "src/data/print-geometry-0580.json"), "utf8")).entries;
const maths = JSON.parse(readFileSync(join(ROOT, "src/data/reviewed-maths-source-answer-repairs.json"), "utf8")).igcse;
const registry = new Map(JSON.parse(readFileSync(join(source, REGISTRY), "utf8")).images.map((image) => [image.id, image]));

const questions = {};
const images = [];
const objects = [];
for (const row of receipt.repaired_crops.rows) {
  const live = rawById.get(row.id);
  if (row.kind === "markscheme") {
    // Lane-only: the live answer image is the reviewed maths-source grid repair.
    if (!maths[row.id] || !live) fail(`${row.id} mark-scheme repair is not covered by the live grid repair`);
    continue;
  }
  if (!live) fail(`${row.id} is not a served row`);
  const oldPath = `core-questions/${row.id}.webp`;
  if (JSON.stringify(live.questionImages) !== JSON.stringify([oldPath])) fail(`${row.id} live question paths differ`);
  const released = historical[row.id]?.[0];
  if (!released || released[0] !== oldPath || released[1] !== row.before.sha256) fail(`${row.id} before-hash is not the released crop`);
  const image = registry.get(row.id);
  if (!image || image.sha256 !== row.after.sha256) fail(`${row.id} registry differs from the receipt`);
  const bytes = readFileSync(join(source, image.path));
  if (sha256(bytes) !== image.sha256 || bytes.length !== row.after.bytes) fail(`${image.path} bytes differ from the receipt`);
  const { width, height, format } = await sharp(bytes).metadata();
  if (format !== "webp" || width !== image.width || height !== image.height) fail(`${image.path} is not the registered WebP`);
  const newPath = `${namespace}/${image.sha256}.webp`;
  questions[row.id] = {
    oldPaths: [oldPath], oldSha256: [row.before.sha256], newPaths: [newPath], sha256: [image.sha256], defects: row.defects,
  };
  images.push({ ...image, path: newPath });
  objects.push({
    key: `igcse/${newPath}`, questionId: row.id, kind: "question", sourcePath: image.path,
    sha256: image.sha256, bytes: bytes.length, contentType: "image/webp",
    replacesKey: `igcse/${oldPath}`, replacesSha256: row.before.sha256, replacesBytes: row.before.bytes,
  });
}
if (new Set(objects.map((object) => object.key)).size !== objects.length) fail("duplicate repair keys");

const overlay = {
  schema: "reviewed-0580-core-crop-repairs-v1",
  bank: "igcse",
  namespace,
  source: { repository: "Saksham106/igcse-0580-topic-practice", receipt: RECEIPT, receiptSha256 },
  count: Object.keys(questions).length,
  questions: Object.fromEntries(Object.entries(questions).sort(([a], [b]) => a.localeCompare(b))),
};
const geometry = { ...buildGeometry([["question", images]], []), repairs: namespace };

let upload = null;
if (existsSync(join(ROOT, LOG))) {
  const text = readFileSync(join(ROOT, LOG), "utf8");
  const rows = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const byKey = new Map(rows.map((entry) => [entry.key, entry]));
  const covered = objects.every((object) => {
    const entry = byKey.get(object.key);
    return entry && entry.status === "verified" && entry.existedBefore === false && entry.sha256 === object.sha256 && entry.bytes === object.bytes;
  });
  if (!covered || rows.length !== objects.length) fail("upload log does not cover exactly the planned objects");
  const at = rows.map((entry) => entry.at).sort();
  upload = {
    method: "wrangler r2 object put/get --remote (logged-in CLI, no API keys): each key checked absent, uploaded with image/webp and private, max-age=31536000, immutable, then read back and compared by SHA-256 and size",
    objects: objects.length, createdNew: objects.length, overwritten: 0, supersededObjectsLeftUnreferenced: objects.length,
    firstVerifiedAt: at[0], lastVerifiedAt: at.at(-1), readbackLog: LOG, readbackLogSha256: sha256(text),
    receipt: "docs/igcse-0580-core-crop-repairs.md",
  };
}
const plan = {
  schemaVersion: 1,
  addition: "0580-core-2021-2025-crop-boundary-repair",
  mode: upload ? "executed-upload-plan" : "dry-run-upload-plan",
  status: upload ? "UPLOADED AND VERIFIED" : "PLANNED",
  ...(upload ? { upload } : {}),
  provider: "cloudflare-r2",
  bucket: BUCKET,
  storageClass: "premium (2021-2025 is not a free-preview year for igcse; free years are 2016-2018; production premium delivery is R2)",
  method: "Create-only. Each key is new and content-addressed; the replaced objects stay in the bucket, unreferenced (deleting them needs owner approval).",
  objectPrefix: `igcse/${namespace}/`,
  source: { repository: "Saksham106/igcse-0580-topic-practice", receipt: RECEIPT, receiptSha256 },
  objectCount: objects.length,
  totalBytes: objects.reduce((sum, object) => sum + object.bytes, 0),
  objects,
};

const outputs = [[OVERLAY, overlay], [GEOMETRY, geometry], [PLAN, plan]].map(([path, value]) => [path, `${JSON.stringify(value, null, 1)}\n`]);
if (args.includes("--check")) {
  for (const [path, text] of outputs) if (!existsSync(path) || readFileSync(path, "utf8") !== text) fail(`${path} is stale`);
  console.log(`${objects.length} repaired question crops are current (${namespace})`);
} else {
  for (const [path, text] of outputs) writeFileSync(path, text);
  console.log(`wrote ${objects.length} repaired question crops (${namespace}); upload ${plan.status}`);
}
