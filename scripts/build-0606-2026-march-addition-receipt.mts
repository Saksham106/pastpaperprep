#!/usr/bin/env tsx
// Reviewed receipt and dry-run R2 upload plan for the 0606 Feb/March 2026 addition.
//
//   npx tsx scripts/build-0606-2026-march-addition-receipt.mts --source <0606 source worktree> [--check]
//
// Read-only against the source repository. It never creates an R2/S3 client and needs no
// credentials: the plan reuses localManifest() from scripts/sync-r2-assets.mjs, which only hashes
// local files, and keeps the 46 keys the 23 added rows reference.
//
// The served rows are the delivered rows with one reviewed overlay applied: accessibleText comes
// from docs/igcse-0606-2026-march-transcripts.json (transcribed from the question crops), because
// the delivered text is PDF extraction with flattened maths and barcode control characters. Without
// --check the builder writes the 23 rows into the raw bank in place; the historical rows are never
// rewritten (the base must still reconstruct byte-exactly).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { isPreviewQuestion } from "@/lib/access";
import { stableSha256 } from "@/lib/stable-sha256.mjs";
import { localManifest, SOURCES } from "./sync-r2-assets.mjs";
import { withUploadStatus } from "./r2-upload-2026-log.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RECEIPT = join(ROOT, "docs/igcse-0606-2026-march-addition.json");
const PLAN = join(ROOT, "docs/igcse-0606-2026-march-r2-upload-plan.json");
const ADDITION_FILE = "site/data/app-additions/igcse-additional-2026-march.json";
const ADDITION_FILE_SHA256 = "890ab91dc2868ad11081809d8958635b29ad9f30282e62b4f3ab625b48f8b091";
const BASE_RAW_SHA256 = "4d385d4ee951a313608075415b95e5e7fb63805823760328b1853c3e145ce87f";
const PAPERS = ["0606-2026-march-12", "0606-2026-march-22"];
const TRANSCRIPTS = join(ROOT, "docs/igcse-0606-2026-march-transcripts.json");

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path: string) => sha256(readFileSync(path));
const fail = (message: string): never => { throw new Error(`0606 March 2026 receipt: ${message}`); };
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
type Row = Record<string, unknown> & { id: string; paperId: string; marks: number; accessibleText: string; questionImages: string[]; markschemeImages: string[] };
type Paper = Record<string, unknown> & { id: string };

/** Why a reviewed transcription is unusable for this row, or null. */
function transcriptProblem(text: string, row: Row): string | null {
  if (/[\u0000-\u001f\u007f-\u009f]/.test(text)) return "control character in transcript";
  if (text !== text.trim() || /\s{2,}/.test(text)) return "transcript whitespace is not normalized";
  if (!text.startsWith(`${row.number} `)) return "transcript does not start with the question number";
  const marks = [...text.matchAll(/\[(\d+)\]/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  if (marks !== row.marks) return `mark brackets total ${marks}, row has ${row.marks}`;
  return null;
}

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourceRoot = sourceIndex >= 0 ? resolve(args[sourceIndex + 1]) : fail("--source <0606 source worktree> is required");
const git = (...command: string[]) => execFileSync("git", ["-C", sourceRoot, ...command], { encoding: "utf8" }).trim();

const rawPath = join(ROOT, "src/data/raw/igcse-additional.json");
const raw = JSON.parse(readFileSync(rawPath, "utf8")) as { papers: Paper[]; questions: Row[] };
const addition = JSON.parse(readFileSync(join(sourceRoot, ADDITION_FILE), "utf8")) as { papers: Paper[]; questions: Row[] };
if (fileSha(join(sourceRoot, ADDITION_FILE)) !== ADDITION_FILE_SHA256) fail("delivered additions file hash drift");
const ids = addition.questions.map((row) => row.id);
const paperIds = addition.papers.map((paper) => paper.id);
if (JSON.stringify(paperIds) !== JSON.stringify(PAPERS) || ids.length !== 23) fail("delivered addition inventory drift");

const registries = Object.fromEntries((["question", "markscheme"] as const).map((kind) => [kind,
  new Map((JSON.parse(readFileSync(join(sourceRoot, `data/${kind}-images.json`), "utf8")).images as Array<{ id: string; sha256: string; path: string }>).map((r) => [r.id, r]))]));

// Reviewed accessible-text overlay: one transcription per delivered row, bound to the delivered
// text and the crop it was read from.
const transcriptsBytes = readFileSync(TRANSCRIPTS);
const transcripts = JSON.parse(transcriptsBytes.toString("utf8")) as {
  addition: string; field: string; status: string; supersedes: { path: string; sha256: string };
  rows: Array<{ id: string; questionImage: string; questionImageSha256: string; deliveredTextSha256: string; accessibleText: string }>;
};
if (transcripts.addition !== "0606-2026-march" || transcripts.field !== "accessibleText" || transcripts.status !== "reviewed") fail("transcript overlay identity drift");
if (transcripts.supersedes.path !== ADDITION_FILE || transcripts.supersedes.sha256 !== ADDITION_FILE_SHA256) fail("transcript overlay supersedes a different delivery");
if (JSON.stringify(transcripts.rows.map((row) => row.id)) !== JSON.stringify(ids)) fail("transcript overlay IDs differ from delivery");
const servedRows = addition.questions.map((row, index) => {
  const transcript = transcripts.rows[index];
  const registry = registries.question.get(row.id) ?? fail(`${row.id}/question missing from source registry`);
  if (transcript.deliveredTextSha256 !== sha256(row.accessibleText)) fail(`${row.id}: transcript is bound to different delivered text`);
  if (transcript.questionImage !== registry.path || transcript.questionImageSha256 !== registry.sha256) fail(`${row.id}: transcript is bound to a different crop`);
  const problem = transcriptProblem(transcript.accessibleText, row);
  if (problem) fail(`${row.id}: ${problem}`);
  return { ...row, accessibleText: transcript.accessibleText };
});

// The merged bank must be exactly: the pinned historical bytes plus the delivered rows with only
// the reviewed accessibleText overlay applied, in place.
const base = { ...raw, papers: raw.papers.filter((p) => !paperIds.includes(p.id)), questions: raw.questions.filter((q) => !ids.includes(q.id)) };
if (sha256(json(base)) !== BASE_RAW_SHA256) fail("historical 1,633-row bank does not reconstruct");
const servedById = new Map(servedRows.map((row) => [row.id, row]));
const merged = { ...raw, questions: raw.questions.map((row) => servedById.get(row.id) ?? row) };
const rawBytes = Buffer.from(json(merged));
const addedRows = merged.questions.filter((row) => ids.includes(row.id));
const addedPapers = merged.papers.filter((paper) => paperIds.includes(paper.id));
if (JSON.stringify(addedRows) !== JSON.stringify(servedRows)) fail("merged rows are not the delivered rows in delivery order");
if (JSON.stringify(addedPapers) !== JSON.stringify(addition.papers)) fail("merged papers differ from delivery");
const rawChanged = !readFileSync(rawPath).equals(rawBytes);
if (rawChanged && args.includes("--check")) fail("raw bank differs from base + delivery + reviewed transcripts");
// Written before the plan is built: localManifest() reads the raw bank from disk.
if (rawChanged) writeFileSync(rawPath, rawBytes);
const sourceReceipt = "audit/0606-2026-march-addition.json";
const sourceTarget = "audit/0606-2026-march-addition/addition-target.json";

// Dry-run R2 plan: every referenced key, filtered to the added rows.
const source = { ...SOURCES.find((entry) => entry.bank === "igcse-additional")!, root: join(sourceRoot, "site"), raw: rawPath };
const local = await localManifest([source]);
// Keys are the sync tool's own keys for the added rows' crop paths. The plan does not normalize the
// rows through the app: that would load the section-retrieval overlay, whose input fingerprints are
// rebuilt from this raw bank afterwards (scripts/build-0606-direct-source-v4.py). Parity with the
// app's questionAssetPaths/markschemeAssetPaths is asserted in igcse-0606-2026-march-addition.test.ts.
const expectedKeys = new Map<string, { id: string; kind: "question" | "markscheme" }>();
for (const row of addedRows) {
  if (isPreviewQuestion("igcse-additional", row.id)) fail(`${row.id} would be a free preview asset`);
  for (const [kind, paths] of [["question", row.questionImages], ["markscheme", row.markschemeImages]] as const) {
    for (const path of paths) {
      const entry = local.find((item: { path: string }) => item.path === join(sourceRoot, "site", path)) ?? fail(`${row.id}: ${path} missing from the local manifest`);
      if (entry.key !== `igcse-additional/${path}`) fail(`${row.id}: unexpected object key ${entry.key}`);
      expectedKeys.set(entry.key, { id: row.id, kind });
    }
  }
}
const objects = local.filter((entry: { key: string }) => expectedKeys.has(entry.key)).map((entry: { key: string; path: string; size: number; etag: string }) => {
  const { id, kind } = expectedKeys.get(entry.key)!;
  const digest = fileSha(entry.path);
  const registry = registries[kind].get(id) ?? fail(`${id}/${kind} missing from source registry`);
  if (registry.sha256 !== digest || join(sourceRoot, registry.path) !== entry.path) fail(`${entry.key} differs from the source crop registry`);
  return { key: entry.key, questionId: id, kind, sourcePath: relative(sourceRoot, entry.path), sha256: digest, md5: entry.etag, bytes: entry.size };
});
if (objects.length !== 46 || expectedKeys.size !== 46) fail(`expected 46 objects, found ${objects.length}`);
// Marked executed only when the committed readback log verifies every planned object.
const plan = withUploadStatus({
  schemaVersion: 1,
  addition: "0606-2026-march",
  mode: "dry-run-plan-only",
  status: "NOT UPLOADED",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-assets",
  storageClass: "premium (2026 is not a free-preview year for igcse-additional; no Supabase preview objects)",
  method: "localManifest() from scripts/sync-r2-assets.mjs over the merged runtime JSON with the source worktree's site/ root; keys are its keys for the added rows' crop paths, and the test suite asserts they equal the app's normalized questionAssetPaths/markschemeAssetPaths. No client was created and no credentials were read.",
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
});

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
  accessibleTextOverlay: {
    path: relative(ROOT, TRANSCRIPTS),
    sha256: sha256(transcriptsBytes),
    rowCount: transcripts.rows.length,
    note: "The served accessibleText of all 23 rows is the reviewed transcription in this overlay, read from the question crops. It supersedes the delivered source text (PDF extraction with flattened maths and barcode control characters); the source repository's app-additions file is unchanged and still pinned by appAdditionsSha256. Every other field is served exactly as delivered.",
  },
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
    // Hash of the served (reviewed) text; deliveredTextSha256 is the source repository's text it replaces.
    sourceTextSha256: sha256(row.accessibleText),
    deliveredTextSha256: sha256(addition.questions.find((delivered) => delivered.id === row.id)!.accessibleText),
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
  console.log("raw bank, receipt and R2 plan match a rebuild");
} else {
  writeFileSync(PLAN, planBytes);
  writeFileSync(RECEIPT, json(receipt));
  console.log(`wrote ${relative(ROOT, RECEIPT)} and ${relative(ROOT, PLAN)} (${objects.length} objects)${rawChanged ? `; applied the reviewed transcripts to ${relative(ROOT, rawPath)}` : ""}`);
}
