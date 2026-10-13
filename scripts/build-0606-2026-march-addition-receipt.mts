#!/usr/bin/env tsx
// Reviewed receipt and dry-run R2 upload plan for the 0606 Feb/March 2026 addition.
//
//   npx tsx scripts/build-0606-2026-march-addition-receipt.mts --source <0606 source worktree> [--check]
//
// Read-only against the source repository. It never creates an R2/S3 client and needs no
// credentials: the plan reuses localManifest() from scripts/sync-r2-assets.mjs, which only hashes
// local files, and keeps the 46 keys the 23 added rows reference.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { isPreviewQuestion } from "@/lib/access";
import { normalizeBankQuestions } from "@/lib/questions";
import { stableSha256 } from "@/lib/stable-sha256.mjs";
import { localManifest, SOURCES } from "./sync-r2-assets.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RECEIPT = join(ROOT, "docs/igcse-0606-2026-march-addition.json");
const PLAN = join(ROOT, "docs/igcse-0606-2026-march-r2-upload-plan.json");
const ADDITION_FILE = "site/data/app-additions/igcse-additional-2026-march.json";
const ADDITION_FILE_SHA256 = "890ab91dc2868ad11081809d8958635b29ad9f30282e62b4f3ab625b48f8b091";
const BASE_RAW_SHA256 = "4d385d4ee951a313608075415b95e5e7fb63805823760328b1853c3e145ce87f";
const PAPERS = ["0606-2026-march-12", "0606-2026-march-22"];

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path: string) => sha256(readFileSync(path));
const fail = (message: string): never => { throw new Error(`0606 March 2026 receipt: ${message}`); };
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
type Row = Record<string, unknown> & { id: string; paperId: string; marks: number; accessibleText: string; questionImages: string[]; markschemeImages: string[] };
type Paper = Record<string, unknown> & { id: string };

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourceRoot = sourceIndex >= 0 ? resolve(args[sourceIndex + 1]) : fail("--source <0606 source worktree> is required");
const git = (...command: string[]) => execFileSync("git", ["-C", sourceRoot, ...command], { encoding: "utf8" }).trim();

const rawPath = join(ROOT, "src/data/raw/igcse-additional.json");
const rawBytes = readFileSync(rawPath);
const raw = JSON.parse(rawBytes.toString("utf8")) as { papers: Paper[]; questions: Row[] };
const addition = JSON.parse(readFileSync(join(sourceRoot, ADDITION_FILE), "utf8")) as { papers: Paper[]; questions: Row[] };
if (fileSha(join(sourceRoot, ADDITION_FILE)) !== ADDITION_FILE_SHA256) fail("delivered additions file hash drift");
const ids = addition.questions.map((row) => row.id);
const paperIds = addition.papers.map((paper) => paper.id);
if (JSON.stringify(paperIds) !== JSON.stringify(PAPERS) || ids.length !== 23) fail("delivered addition inventory drift");

// The merged bank must be exactly: the pinned historical bytes plus the delivered rows, verbatim.
const addedRows = raw.questions.filter((row) => ids.includes(row.id));
const addedPapers = raw.papers.filter((paper) => paperIds.includes(paper.id));
if (stableSha256(addedRows) !== stableSha256(addition.questions) || JSON.stringify(addedRows) !== JSON.stringify(addition.questions)) fail("merged rows differ from delivery");
if (JSON.stringify(addedPapers) !== JSON.stringify(addition.papers)) fail("merged papers differ from delivery");
const base = { ...raw, papers: raw.papers.filter((p) => !paperIds.includes(p.id)), questions: raw.questions.filter((q) => !ids.includes(q.id)) };
if (sha256(json(base)) !== BASE_RAW_SHA256) fail("historical 1,633-row bank does not reconstruct");

const registries = Object.fromEntries((["question", "markscheme"] as const).map((kind) => [kind,
  new Map((JSON.parse(readFileSync(join(sourceRoot, `data/${kind}-images.json`), "utf8")).images as Array<{ id: string; sha256: string; path: string }>).map((r) => [r.id, r]))]));
const sourceReceipt = "audit/0606-2026-march-addition.json";
const sourceTarget = "audit/0606-2026-march-addition/addition-target.json";

// Dry-run R2 plan: every referenced key, filtered to the added rows.
const source = { ...SOURCES.find((entry) => entry.bank === "igcse-additional")!, root: join(sourceRoot, "site"), raw: rawPath };
const local = await localManifest([source]);
const normalized = normalizeBankQuestions("igcse-additional", addedRows as never);
const expectedKeys = new Map<string, { id: string; kind: "question" | "markscheme" }>();
for (const question of normalized) {
  if (isPreviewQuestion("igcse-additional", question.id)) fail(`${question.id} would be a free preview asset`);
  for (const key of question.questionAssetPaths) expectedKeys.set(key, { id: question.id, kind: "question" });
  for (const key of question.markschemeAssetPaths) expectedKeys.set(key, { id: question.id, kind: "markscheme" });
}
const objects = local.filter((entry: { key: string }) => expectedKeys.has(entry.key)).map((entry: { key: string; path: string; size: number; etag: string }) => {
  const { id, kind } = expectedKeys.get(entry.key)!;
  const digest = fileSha(entry.path);
  const registry = registries[kind].get(id) ?? fail(`${id}/${kind} missing from source registry`);
  if (registry.sha256 !== digest || join(sourceRoot, registry.path) !== entry.path) fail(`${entry.key} differs from the source crop registry`);
  return { key: entry.key, questionId: id, kind, sourcePath: relative(sourceRoot, entry.path), sha256: digest, md5: entry.etag, bytes: entry.size };
});
if (objects.length !== 46 || expectedKeys.size !== 46) fail(`expected 46 objects, found ${objects.length}`);
const plan = {
  schemaVersion: 1,
  addition: "0606-2026-march",
  mode: "dry-run-plan-only",
  status: "NOT UPLOADED",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-assets",
  storageClass: "premium (2026 is not a free-preview year for igcse-additional; no Supabase preview objects)",
  method: "localManifest() from scripts/sync-r2-assets.mjs over the merged runtime JSON with the source worktree's site/ root; keys equal normalized questionAssetPaths/markschemeAssetPaths. No client was created and no credentials were read.",
  source: { repository: "Saksham106/igcse-additional-mathematics-0606-topic-practice", branch: git("rev-parse", "--abbrev-ref", "HEAD"), commit: git("rev-parse", "HEAD") },
  runtimeRawSha256: sha256(rawBytes),
  objectCount: objects.length,
  totalBytes: objects.reduce((sum: number, item: { bytes: number }) => sum + item.bytes, 0),
  operatorNotes: [
    "Owner approval is required before any upload.",
    "scripts/sync-r2-assets.mjs resolves igcse-additional from the sibling main checkout's site/; those 46 files must exist there (merge the source branch) or the sync will fail on missing references.",
    "After upload, run npm run r2:verify and open one added question and answer through the signed-URL API.",
  ],
  objects,
};

const reviewPath = "docs/0606-2026-march-addition-sections-v4.json";
const geometryPath = "src/data/print-geometry-0606-2026-march.json";
const planBytes = json(plan);
const receipt = {
  schemaVersion: 1,
  addition: "0606-2026-march",
  bank: "igcse-additional",
  status: "reviewed-addition",
  reviewStatus: "source-structured-draft",
  reviewStatusNote: "Rows keep the delivered reviewStatus; the owner chose not to label them independently-reviewed.",
  source: {
    repository: "Saksham106/igcse-additional-mathematics-0606-topic-practice",
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    commit: git("rev-parse", "HEAD"),
    appAdditionsPath: ADDITION_FILE,
    appAdditionsSha256: ADDITION_FILE_SHA256,
    receiptPath: sourceReceipt,
    receiptSha256: fileSha(join(sourceRoot, sourceReceipt)),
    additionTargetPath: sourceTarget,
    additionTargetSha256: fileSha(join(sourceRoot, sourceTarget)),
    classificationManualReviewsSha256: fileSha(join(sourceRoot, "data/classification-manual-reviews.json")),
  },
  base: { rawSha256: BASE_RAW_SHA256, paperCount: base.papers.length, questionCount: base.questions.length },
  merged: { rawSha256: sha256(rawBytes), paperCount: raw.papers.length, questionCount: raw.questions.length },
  insertion: {
    questionsBefore: "0606-2026-june-11-q1",
    questionStartIndex: raw.questions.findIndex((row) => row.id === ids[0]),
    papersAfter: "0606-2026-june-22",
    paperStartIndex: raw.papers.findIndex((paper) => paper.id === paperIds[0]),
  },
  paperIds,
  addedQuestionIds: ids,
  addedQuestionCount: ids.length,
  questionsByPaper: Object.fromEntries(paperIds.map((paper) => [paper, addedRows.filter((row) => row.paperId === paper).length])),
  marksByPaper: Object.fromEntries(paperIds.map((paper) => [paper, addedRows.filter((row) => row.paperId === paper).reduce((sum, row) => sum + row.marks, 0)])),
  addedPapersSha256: stableSha256(addedPapers),
  addedRowsSha256: stableSha256(addedRows),
  rows: addedRows.map((row) => ({
    id: row.id,
    sourceTextSha256: sha256(row.accessibleText),
    questionImageSha256: registries.question.get(row.id)!.sha256,
    markschemeImageSha256: registries.markscheme.get(row.id)!.sha256,
  })),
  currentEraTopicReviews: {
    "0606-2026-march-12-q10": {
      sourceLabels: ["Logarithmic and exponential functions", "Indices and surds"],
      projectedTopics: ["Logarithmic and exponential functions", "Equations, inequalities and graphs"],
      evidence: "QP p14: (a) log5(x^2) - log5 x - 3 log_x 5 = 2; (b) 2x8^(2x+1) - 3x2^(3x+4) - 64 = 0. MS: change of base and a quadratic in log5 x; B1 for 16(2^(3x))^2 - 48x2^(3x) - 64 = 0, then 2^(3x) = 4. Index laws are assumed 0580 knowledge (syllabus p.11); assessed operations are §6.2, §4.3 and §6.3. See docs/igcse-0606-current-era-review.md.",
    },
  },
  numberedStatementReview: { path: reviewPath, sha256: fileSha(join(ROOT, reviewPath)) },
  printGeometry: { path: geometryPath, sha256: fileSha(join(ROOT, geometryPath)) },
  r2UploadPlan: { path: "docs/igcse-0606-2026-march-r2-upload-plan.json", sha256: sha256(planBytes), objectCount: objects.length },
};

if (args.includes("--check")) {
  if (readFileSync(PLAN, "utf8") !== planBytes) fail("committed R2 plan differs from a rebuild");
  if (readFileSync(RECEIPT, "utf8") !== json(receipt)) fail("committed receipt differs from a rebuild");
  console.log("receipt and R2 plan match a rebuild");
} else {
  writeFileSync(PLAN, planBytes);
  writeFileSync(RECEIPT, json(receipt));
  console.log(`wrote ${relative(ROOT, RECEIPT)} and ${relative(ROOT, PLAN)} (${objects.length} objects)`);
}
