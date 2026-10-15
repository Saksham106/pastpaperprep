#!/usr/bin/env node
// Writes docs/ib-chemistry-may-2026/archive-inventory.json: the whole-paper inventory for the IB Chemistry
// banks (every earlier paper plus the 18 official May 2026 papers), the input of
//   npx tsx scripts/build-whole-paper-archives.mts --inventory docs/ib-chemistry-may-2026/archive-inventory.json \
//     --identity-review private/paper-archives/identity-review.json --bank ib-chemistry-hl   (and -sl)
//
// Earlier pairs come from the private build receipt (paper-archive-state-2026-10-15/receipt.json), which
// pins the source PDFs by SHA-256; every path is re-hashed here. The 2026 pairs come from the source lane's
// pinned manifest (data/source-manifest-2026.json). Runtime ids come from src/data/raw, so the inventory
// always equals the runtime it is built for. No network, no uploads.
//
//   node scripts/build-ib-chemistry-2026-archive-inventory.mjs [--check]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const workspace = resolve(root, "../../..");
const stateDir = join(workspace, "research/official-sources-20261013/paper-archive-state-2026-10-15");
const sourceRoot = join(workspace, "ib-chemistry-topic-practice/.worktrees/may-2026");
const fallbackDirs = [];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// The committed manifests (pinned base commit) say which PDF bytes each earlier paper was built from.
const BASE_COMMIT = "18d8b98df165fad17c4f632e8a156214c27227fa";
const baseManifest = (slug) => JSON.parse(execFileSync("git", ["-C", root, "show", `${BASE_COMMIT}:src/data/paper-archives/${slug}.json`], { maxBuffer: 200_000_000, encoding: "utf8" }));
const receipt = readJson(join(stateDir, "receipt.json"));
const manifest2026 = readJson(join(sourceRoot, "data/source-manifest-2026.json"));
// The 2026 PDFs are pinned by the lane's append-only acquisition receipt (one JSON object per line).
const receipt2026 = new Map(readFileSync(join(sourceRoot, "data/acquisition-2026/receipt.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => { const row = JSON.parse(line); return [row.local_path, row.sha256]; }));
const fallbackFiles = fallbackDirs.flatMap((dir) => (existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)) : []));

// Resolve a pinned source PDF: the recorded path when it still holds the pinned bytes, else a surviving copy.
function resolvePdf(recordedPath, expectedSha) {
  if (existsSync(recordedPath) && sha(readFileSync(recordedPath)) === expectedSha) return recordedPath;
  for (const candidate of fallbackFiles) if (candidate.endsWith(".pdf") && statSync(candidate).isFile() && sha(readFileSync(candidate)) === expectedSha) return candidate;
  throw new Error(`No file with SHA-256 ${expectedSha} for ${recordedPath}`);
}

const banks = [];
for (const level of ["hl", "sl"]) {
  const slug = `ib-chemistry-${level}`;
  const runtimeFile = join(root, `src/data/raw/${slug}.json`);
  const runtime = readJson(runtimeFile);
  const idsByPaper = new Map();
  for (const q of runtime.questions) {
    const paperId = q.id.replace(/-q\d+$/, "");
    if (!idsByPaper.has(paperId)) idsByPaper.set(paperId, []);
    idsByPaper.get(paperId).push(q.id);
  }
  const state = receipt.banks.find((entry) => entry.slug === slug);
  const published = new Map(baseManifest(slug).papers.map((paper) => [paper.summary.id, paper.documents]));
  const pairs = [];
  for (const doc of state.sourceDocuments) {
    const runtimePaperId = doc.id.replace(/^chemistry-/, "").replace(/-english$/, "");
    const documents = published.get(doc.id);
    if (!documents) throw new Error(`${doc.id} is not in the committed manifest`);
    pairs.push({
      id: doc.id,
      runtimePaperId,
      questionPath: resolvePdf(doc.question.path, documents.question.sha256),
      markschemePath: resolvePdf(doc.markscheme.path, documents.markscheme.sha256),
      runtimeQuestionIds: idsByPaper.get(runtimePaperId) ?? [],
    });
  }
  for (const paper of manifest2026.papers.filter((entry) => entry.level.toLowerCase() === level)) {
    const runtimePaperId = paper.id;
    const stem = join(sourceRoot, "data/raw", paper.id);
    const questionPath = `${stem}-question.pdf`;
    const markschemePath = `${stem}-markscheme.pdf`;
    if (sha(readFileSync(questionPath)) !== receipt2026.get(`data/raw/${paper.id}-question.pdf`) || sha(readFileSync(markschemePath)) !== receipt2026.get(`data/raw/${paper.id}-markscheme.pdf`)) throw new Error(`Source hash drift: ${paper.id}`);
    pairs.push({ id: `chemistry-${paper.id}-english`, runtimePaperId, questionPath, markschemePath, runtimeQuestionIds: idsByPaper.get(runtimePaperId) ?? [] });
  }
  pairs.sort((a, b) => a.id.localeCompare(b.id));
  const paired = new Set(pairs.map((pair) => pair.runtimePaperId));
  const runtimeWithoutPair = [...idsByPaper.keys()].filter((id) => !paired.has(id));
  if (runtimeWithoutPair.length) throw new Error(`${slug}: runtime papers without a pair: ${runtimeWithoutPair.join(", ")}`);
  if (pairs.length !== runtime.papers.length) throw new Error(`${slug}: ${pairs.length} pairs for ${runtime.papers.length} runtime papers`);
  banks.push({ slug, runtimeFile, pairs, unpaired: [], runtimeWithoutPair: [], notes: [] });
}

const text = `${JSON.stringify({ banks }, null, 2)}\n`;
const target = join(root, "docs/ib-chemistry-may-2026/archive-inventory.json");
if (check) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== text) { console.error("DRIFT archive-inventory.json"); process.exit(1); }
} else writeFileSync(target, text);
console.log(`${check ? "checked" : "wrote"} inventory: ${banks.map((bank) => `${bank.slug}=${bank.pairs.length}`).join(" ")}`);
