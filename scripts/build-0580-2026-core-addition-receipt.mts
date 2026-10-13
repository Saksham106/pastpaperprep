#!/usr/bin/env tsx
// Reviewed receipt and dry-run R2 upload plan for the 0580 Core 2026 addition.
//
//   npx tsx scripts/build-0580-2026-core-addition-receipt.mts --source <0580 source worktree> [--check]
//
// Read-only against the source repository. It never creates an R2/S3 client and needs no
// credentials: the plan reuses localManifest() from scripts/sync-r2-assets.mjs, which only hashes
// local files, and keeps the 414 keys the 207 added rows reference.
//
// Import rule (same as the 2021-2025 Core import): only route == "Core" && year == 2026 rows and
// papers come from the source runtime. Extended rows and extendedRuntimeSha256 stay app-owned.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { isPreviewQuestion } from "@/lib/access";
import { normalizeBankQuestions } from "@/lib/questions";
import { stableSha256 } from "@/lib/stable-sha256.mjs";
import { localManifest, SOURCES } from "./sync-r2-assets.mjs";
import { withUploadStatus } from "./r2-upload-2026-log.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RECEIPT = join(ROOT, "docs/igcse-0580-2026-core-addition.json");
const PLAN = join(ROOT, "docs/igcse-0580-2026-core-r2-upload-plan.json");
const BASE_RAW_SHA256 = "74f919b57dfba129a6c523da09148e3cd3347f7972aa5b7b4808630f5abe814b";
const CLASSIFICATION = "data/core-2026/core-classification-final.json";
const CLASSIFICATION_SHA256 = "f42912e2c9c070d3f319903226d4a206d8544ce9346b6a54fe73c7f427fe1def";
const MODEL = "manual-two-pass-review-v1";
// Existing convention (every Core year 2021-2025): within a year, Extended February/March papers,
// then Core May/June 11-33 and Core February/March 12/32, then Extended May/June.
const PAPERS = ["0580-2026-june-11", "0580-2026-june-12", "0580-2026-june-13", "0580-2026-june-31", "0580-2026-june-32", "0580-2026-june-33", "0580-2026-march-12", "0580-2026-march-32"];
const QUESTIONS_BEFORE = "0580-2026-june-21-q1";
const PAPERS_BEFORE = "0580-2026-june-21";
const HEADER_KEY = "coreClassificationArtifacts";
const HEADER_BEFORE = "excludedQuestionIds";

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path: string) => sha256(readFileSync(path));
const fail = (message: string): never => { throw new Error(`0580 Core 2026 receipt: ${message}`); };
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
type Row = Record<string, unknown> & { id: string; paperId: string; marks: number; year: number; route?: string; accessibleText: string; questionImages: string[]; markschemeImages: string[]; classificationEvidence: { model: string; artifactSha256: string } };
type Paper = Record<string, unknown> & { id: string; route?: string; year: number };

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourceRoot = sourceIndex >= 0 ? resolve(args[sourceIndex + 1]) : fail("--source <0580 source worktree> is required");
const git = (...command: string[]) => execFileSync("git", ["-C", sourceRoot, ...command], { encoding: "utf8" }).trim();

const rawPath = join(ROOT, "src/data/raw/igcse.json");
const rawBytes = readFileSync(rawPath);
const rawText = rawBytes.toString("utf8");
const raw = JSON.parse(rawText) as Record<string, unknown> & { papers: Paper[]; questions: Row[] };
const sourceRuntimePath = join(sourceRoot, "site/data/questions.json");
const sourceRuntime = JSON.parse(readFileSync(sourceRuntimePath, "utf8")) as Record<string, unknown> & { papers: Paper[]; questions: Row[] };
if (fileSha(join(sourceRoot, CLASSIFICATION)) !== CLASSIFICATION_SHA256) fail("classification artifact hash drift");

// The delivered addition: exactly the source runtime's Core 2026 rows and papers.
const delivered = sourceRuntime.questions.filter((row) => row.route === "Core" && row.year === 2026);
const deliveredPapers = sourceRuntime.papers.filter((paper) => paper.route === "Core" && paper.year === 2026);
const deliveredById = new Map(delivered.map((row) => [row.id, row]));
if (deliveredPapers.length !== 8 || [...deliveredPapers.map((paper) => paper.id)].sort().join() !== [...PAPERS].sort().join()) fail("delivered paper inventory drift");
const ids = PAPERS.flatMap((paper) => delivered.filter((row) => row.paperId === paper).map((row) => row.id));
if (ids.length !== 207 || delivered.length !== 207) fail("delivered row inventory drift");
for (const row of delivered) {
  if (row.classificationEvidence.model !== MODEL || row.classificationEvidence.artifactSha256 !== CLASSIFICATION_SHA256) fail(`${row.id} provenance is not ${MODEL}`);
}

// The merged bank must be exactly: the pinned historical bytes plus the delivered rows, verbatim.
const start = raw.questions.findIndex((row) => row.id === ids[0]);
const addedRows = raw.questions.slice(start, start + ids.length);
const paperStart = raw.papers.findIndex((paper) => paper.id === PAPERS[0]);
const addedPapers = raw.papers.slice(paperStart, paperStart + PAPERS.length);
if (JSON.stringify(addedRows.map((row) => row.id)) !== JSON.stringify(ids) || addedRows.some((row) => JSON.stringify(row) !== JSON.stringify(deliveredById.get(row.id)))) fail("merged rows differ from delivery");
if (JSON.stringify(addedPapers.map((paper) => paper.id)) !== JSON.stringify(PAPERS) || addedPapers.some((paper) => JSON.stringify(paper) !== JSON.stringify(deliveredPapers.find((p) => p.id === paper.id)))) fail("merged papers differ from delivery");
if (raw.questions[start + ids.length]?.id !== QUESTIONS_BEFORE || raw.papers[paperStart + PAPERS.length]?.id !== PAPERS_BEFORE) fail("addition is not at its conventional position");
if (JSON.stringify(raw[HEADER_KEY]) !== JSON.stringify(sourceRuntime[HEADER_KEY])) fail("header lane list differs from delivery");
const headerKeys = Object.keys(raw);
if (headerKeys[headerKeys.indexOf(HEADER_KEY) + 1] !== HEADER_BEFORE) fail("header lane list is not where the receipt expects it");
const base = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== HEADER_KEY).map(([key, value]) => [key,
  key === "questions" ? raw.questions.filter((row) => !ids.includes(row.id)) : key === "papers" ? raw.papers.filter((paper) => !PAPERS.includes(paper.id)) : value]));

// Byte-level proof without re-serialization: cut the three contiguous blocks out of the text.
// Added rows and papers start with "id"; historical Extended rows may not, so the block ends at the
// next array element after the last added "id", which must be the receipt's "before" row.
const cutRows = (text: string, firstId: string, lastId: string, nextId: string) => {
  const begin = text.indexOf(`\n    {\n      "id": "${firstId}",\n`);
  const last = text.indexOf(`\n      "id": "${lastId}",\n`, begin);
  const end = last < 0 ? -1 : text.indexOf("\n    {\n", last);
  if (begin < 0 || end < 0 || !text.slice(end, text.indexOf("\n    }", end + 1)).includes(`\n      "id": "${nextId}",\n`)) fail(`block ${firstId}..${lastId} not found before ${nextId}`);
  return text.slice(0, begin) + text.slice(end);
};
const cutHeader = (text: string) => {
  const begin = text.indexOf(`\n  "${HEADER_KEY}": `);
  const end = text.indexOf(`\n  "${HEADER_BEFORE}": `, begin);
  if (begin < 0 || end < 0) fail("header block not found");
  return text.slice(0, begin) + text.slice(end);
};
const baseText = cutHeader(cutRows(cutRows(rawText, ids[0], ids.at(-1)!, QUESTIONS_BEFORE), PAPERS[0], PAPERS.at(-1)!, PAPERS_BEFORE));
if (sha256(baseText) !== BASE_RAW_SHA256) fail("historical 3,967-row bank does not reconstruct byte-for-byte");
if (stableSha256(JSON.parse(baseText)) !== stableSha256(base)) fail("parsed base differs from the reconstructed bytes");

const registries = Object.fromEntries((["question", "markscheme"] as const).map((kind) => [kind,
  new Map((JSON.parse(readFileSync(join(sourceRoot, `data/core-2026/${kind}-images.json`), "utf8")).images as Array<{ id: string; sha256: string; path: string }>).map((r) => [r.id, r]))]));

// Dry-run R2 plan: every referenced key, filtered to the added rows.
const igcse = { ...SOURCES.find((entry: { bank: string }) => entry.bank === "igcse")!, root: join(sourceRoot, "site"), raw: rawPath };
const local = await localManifest([igcse]);
const normalized = normalizeBankQuestions("igcse", addedRows as never);
const expectedKeys = new Map<string, { id: string; kind: "question" | "markscheme" }>();
for (const question of normalized) {
  if (isPreviewQuestion("igcse", question.id)) fail(`${question.id} would be a free preview asset`);
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
if (objects.length !== 414 || expectedKeys.size !== 414) fail(`expected 414 objects, found ${objects.length}`);
// Marked executed only when the committed readback log verifies every planned object.
const plan = withUploadStatus({
  schemaVersion: 1,
  addition: "0580-2026-core",
  mode: "dry-run-plan-only",
  status: "NOT UPLOADED",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-assets",
  storageClass: "premium (2026 is not a free-preview year for igcse; free years are 2016-2018; no Supabase preview objects)",
  method: "localManifest() from scripts/sync-r2-assets.mjs over the merged runtime JSON with the source worktree's site/ root; keys equal normalized questionAssetPaths/markschemeAssetPaths. No client was created and no credentials were read.",
  source: { repository: "Saksham106/igcse-0580-topic-practice", branch: git("rev-parse", "--abbrev-ref", "HEAD"), commit: git("rev-parse", "HEAD") },
  runtimeRawSha256: sha256(rawBytes),
  objectCount: objects.length,
  totalBytes: objects.reduce((sum: number, item: { bytes: number }) => sum + item.bytes, 0),
  operatorNotes: [
    "Owner approval is required before any upload.",
    "npm run r2:sync resolves igcse files from the sibling main source checkout (igcse-0580-topic-practice/site next to the pastpaperprep main checkout) unless PASTPAPERPREP_IGCSE_0580_SOURCE_ROOT is set. That checkout does not have these 414 crops until the source branch lands there; until then the sync fails on missing references. Setting PASTPAPERPREP_IGCSE_0580_SOURCE_ROOT to the source worktree's site/ is the alternative.",
    "After upload, run npm run r2:verify and open one added question and answer through the signed-URL API.",
  ],
  objects,
});

const reviewPath = "docs/0580-2026-core-addition-sections-v4.json";
const geometryPath = "src/data/print-geometry-0580-2026-core.json";
const artifact = (path: string) => existsSync(join(ROOT, path)) ? { path, sha256: fileSha(join(ROOT, path)) } : (args.includes("--check") ? fail(`${path} missing`) : null);
const planBytes = json(plan);
const sourceFile = (path: string) => ({ path, sha256: fileSha(join(sourceRoot, path)) });
const receipt = {
  schemaVersion: 1,
  addition: "0580-2026-core",
  bank: "igcse",
  status: "reviewed-addition",
  reviewStatus: "manually-classified-mvp",
  classification: {
    model: MODEL,
    artifact: { path: CLASSIFICATION, sha256: CLASSIFICATION_SHA256 },
    note: "Jev could not run (TypeSafe HTTP 402, no credits). Rows were classified by a manual first pass, an independent blind second pass and written adjudication, and are labelled manual-two-pass-review-v1, never Jev. The owner kept these labels.",
  },
  source: {
    repository: "Saksham106/igcse-0580-topic-practice",
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    commit: git("rev-parse", "HEAD"),
    runtime: sourceFile("site/data/questions.json"),
    importRule: "route == \"Core\" && year == 2026 rows and papers only; Extended rows and extendedRuntimeSha256 keep the app's values",
    pipelineReceipt: sourceFile("data/core-2026/pipeline-receipt-2026-10-13.json"),
    adjudications: sourceFile("data/core-2026/classification-adjudications.json"),
    questionImages: sourceFile("data/core-2026/question-images.json"),
    markschemeImages: sourceFile("data/core-2026/markscheme-images.json"),
  },
  base: { rawSha256: BASE_RAW_SHA256, stableSha256: stableSha256(base), paperCount: (base.papers as Paper[]).length, questionCount: (base.questions as Row[]).length },
  merged: { rawSha256: sha256(rawBytes), paperCount: raw.papers.length, questionCount: raw.questions.length },
  insertion: {
    convention: "Within 2026: Extended February/March 22 and 42, then Core May/June 11-33 and Core February/March 12/32, then Extended May/June (as every Core year 2021-2025).",
    questionsBefore: QUESTIONS_BEFORE,
    questionStartIndex: start,
    papersBefore: PAPERS_BEFORE,
    paperStartIndex: paperStart,
  },
  headerAddition: {
    key: HEADER_KEY,
    before: HEADER_BEFORE,
    valueSha256: stableSha256(raw[HEADER_KEY]),
    note: "Lists both Core classification lanes. coreClassificationArtifact/coreClassificationSha256 are unchanged and still name the 2021-2025 Jev lane, so existing readers keep working.",
  },
  paperIds: PAPERS,
  addedQuestionIds: ids,
  addedQuestionCount: ids.length,
  questionsByPaper: Object.fromEntries(PAPERS.map((paper) => [paper, addedRows.filter((row) => row.paperId === paper).length])),
  marksByPaper: Object.fromEntries(PAPERS.map((paper) => [paper, addedRows.filter((row) => row.paperId === paper).reduce((sum, row) => sum + row.marks, 0)])),
  addedPapersSha256: stableSha256(addedPapers),
  addedRowsSha256: stableSha256(addedRows),
  rows: addedRows.map((row) => ({
    id: row.id,
    sourceTextSha256: sha256(row.accessibleText),
    questionImageSha256: registries.question.get(row.id)!.sha256,
    markschemeImageSha256: registries.markscheme.get(row.id)!.sha256,
  })),
  numberedStatementReview: artifact(reviewPath),
  printGeometry: artifact(geometryPath),
  r2UploadPlan: { path: "docs/igcse-0580-2026-core-r2-upload-plan.json", sha256: sha256(planBytes), objectCount: objects.length },
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
