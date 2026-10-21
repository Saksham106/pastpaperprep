#!/usr/bin/env node
// Writes docs/ib-hl-nov2020-p3/archive-inventory.json: the whole-paper inventory for IB Math AA HL
// (every published paper plus the three November 2020 Paper 3 options the 2026-10-19 build left
// unpaired), the input of
//   npx tsx scripts/build-whole-paper-archives.mts --inventory docs/ib-hl-nov2020-p3/archive-inventory.json --bank ib-hl
//
// Published pairs come from the private build receipt (paper-archive-state-2026-10-19/receipt.json); each
// is re-hashed against the committed manifest at BASE_COMMIT. The three new pairs come from
// docs/ib-hl-nov2020-p3/acquisition.json, which pins every PDF by SHA-256. Runtime ids come from
// src/data/raw/ib-hl.json, so the inventory equals the runtime it is built for. No network, no uploads.
//
//   node scripts/build-ib-hl-nov2020-p3-archive-inventory.mjs [--check]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const workspace = resolve(root, "../../..");
const stateDir = join(workspace, "research/official-sources-20261013/paper-archive-state-2026-10-19");
const acquiredDir = join(workspace, "research/official-sources-20261013/ib-hl-nov2020-p3");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const SLUG = "ib-hl";
const BASE_COMMIT = "10299fe52951cd1976d0e19cf4881f934a9f1b67";
const baseManifest = JSON.parse(execFileSync("git", ["-C", root, "show", `${BASE_COMMIT}:src/data/paper-archives/${SLUG}.json`], { maxBuffer: 200_000_000, encoding: "utf8" }));
const receipt = readJson(join(stateDir, "receipt.json"));
const acquisition = readJson(join(root, "docs/ib-hl-nov2020-p3/acquisition.json"));

function pinned(path, expectedSha) {
  if (!existsSync(path) || sha(readFileSync(path)) !== expectedSha) throw new Error(`No file with SHA-256 ${expectedSha} at ${path}`);
  return path;
}

const runtimeFile = join(root, `src/data/raw/${SLUG}.json`);
const runtime = readJson(runtimeFile);
const idsByPaper = new Map();
for (const q of runtime.questions) {
  const paperId = q.id.replace(/-q\d+$/, "");
  if (!idsByPaper.has(paperId)) idsByPaper.set(paperId, []);
  idsByPaper.get(paperId).push(q.id);
}

const state = receipt.banks.find((entry) => entry.slug === SLUG);
const published = new Map(baseManifest.papers.map((paper) => [paper.summary.id, paper.documents]));
const pairs = [];
for (const doc of state.sourceDocuments) {
  const documents = published.get(doc.id);
  if (!documents) throw new Error(`${doc.id} is not in the committed manifest`);
  pairs.push({
    id: doc.id,
    runtimePaperId: doc.id,
    questionPath: pinned(doc.question.path, documents.question.sha256),
    markschemePath: pinned(doc.markscheme.path, documents.markscheme.sha256),
    runtimeQuestionIds: idsByPaper.get(doc.id) ?? [],
  });
}
const added = new Map();
for (const file of acquisition.files) {
  const entry = added.get(file.runtimePaperId) ?? {};
  entry[file.kind] = pinned(join(acquiredDir, `${file.sha256}.pdf`), file.sha256);
  added.set(file.runtimePaperId, entry);
}
for (const [paperId, { question, markscheme }] of added) {
  if (published.has(paperId)) throw new Error(`${paperId} is already published`);
  if (!question || !markscheme) throw new Error(`${paperId} needs a question paper and a mark scheme`);
  pairs.push({ id: paperId, runtimePaperId: paperId, questionPath: question, markschemePath: markscheme, runtimeQuestionIds: idsByPaper.get(paperId) ?? [] });
}
pairs.sort((a, b) => a.id.localeCompare(b.id));

const paired = new Set(pairs.map((pair) => pair.runtimePaperId));
const runtimeWithoutPair = [...idsByPaper.keys()].filter((id) => !paired.has(id));
if (runtimeWithoutPair.length) throw new Error(`${SLUG}: runtime papers without a pair: ${runtimeWithoutPair.join(", ")}`);
if (pairs.length !== runtime.papers.length) throw new Error(`${SLUG}: ${pairs.length} pairs for ${runtime.papers.length} runtime papers`);

const text = `${JSON.stringify({ banks: [{ slug: SLUG, runtimeFile, pairs, unpaired: [], runtimeWithoutPair: [], notes: [] }] }, null, 2)}\n`;
const target = join(root, "docs/ib-hl-nov2020-p3/archive-inventory.json");
if (check) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== text) { console.error("DRIFT archive-inventory.json"); process.exit(1); }
} else writeFileSync(target, text);
console.log(`${SLUG}: ${pairs.length} pairs (${added.size} added)`);
