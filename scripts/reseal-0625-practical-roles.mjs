#!/usr/bin/env node
/** Metadata-only Physics practical-role reseal. Does not upload or alter source provenance. */
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";

const BANK = "igcse-physics-0625";
const BASELINE_RUNTIME_SHA = "1c397a5473e858b283b1748db8891e9296cd1776b550c363ea6952b94d5f80b1";
const BASELINE_CONTENT_SHA = "14b6756ed65b6f264f601519a4dba5b5a43ef0f0480bc849924cc037644c79e8";
const MANIFEST_SHA = "82a09dc72b46895d6840b23dc65c88f5a0c839fb928f230e60184d01de97ea95";
const RECEIPT_SHA = "0a7823e1b04caa03c34a88dd4cdaa1adf3ed7238c5b4e3025d9c44a514cd018f";
const TARGET_SHA = "1b4e4d76a05afa82df7ef51f94f66e5bf6c0255ec6b7b49ba5aabf982e8140a3";
const SOURCE_SHA = "53dc1b3154fe3ffaa1ec872d3d6efa54c98bfff3cb7863c58cfb6b9cc1793da0";
const BASELINE_COMMIT = "b4dac6427191232ae9bd62ce9908b37d7318f92d";
const fail = (message) => { throw new Error(`0625 practical role reseal: ${message}`); };
const need = (ok, message) => { if (!ok) fail(message); };

export function deriveTargets(runtime, frozen) {
  need(frozen.sourceQueueSha256 === SOURCE_SHA && frozen.targetIdsSha256 === TARGET_SHA, "frozen target provenance mismatch");
  need(Array.isArray(frozen.ids) && frozen.ids.length === 144 && new Set(frozen.ids).size === 144, "frozen target ID count mismatch");
  const queueSet = new Set(frozen.ids);
  const targets = runtime.questions.filter((q) => queueSet.has(q.id) && ["51", "52", "53", "61", "62", "63"].includes(q.component));
  const ids = targets.map((q) => q.id).sort();
  need(ids.length === 144 && ids.every((id, i) => id === [...frozen.ids].sort()[i]), "paper component 5/6 target set mismatch");
  need(sha256(ids.join("\n")) === TARGET_SHA, "exact sorted target-ID digest mismatch");
  return ids;
}

export function reseal({ baseline, frozen, manifestText, receiptText }) {
  need(runtimeSha256(baseline) === BASELINE_RUNTIME_SHA && baseline.runtimeArtifact?.runtimeSha256 === BASELINE_RUNTIME_SHA, "finalized baseline runtime hash mismatch");
  need(baseline.runtimeArtifact?.contentSha256 === BASELINE_CONTENT_SHA, "baseline source content pin mismatch");
  need(baseline.releaseStatus === "production" && baseline.publicationStatus === "production" && baseline.assetVerification === "verified_readback", "baseline not finalized");
  need(sha256(JSON.stringify(JSON.parse(manifestText))) === MANIFEST_SHA, "manifest canonical hash changed");
  need(sha256(receiptText) === RECEIPT_SHA, "receipt bytes changed");
  const ids = deriveTargets(baseline, frozen);
  need(baseline.questions.length === 5789 && baseline.questionCount === 5789, "question count changed");
  need(baseline.questions.filter((q) => !ids.includes(q.id)).length === 5645, "unmodified row count mismatch");
  const targetSet = new Set(ids);
  const output = structuredClone(baseline);
  const title = "Experimental skills and investigations";
  for (const q of output.questions) {
    if (!targetSet.has(q.id)) continue;
    need(q.classificationReviewStatus === "unresolved_taxonomy_gap", `target ${q.id} is not an unresolved taxonomy gap`);
    need(q.primaryTopic === null && q.primaryTopicId === null, `target ${q.id} has existing topic classification`);
    // Broad deterministic role only: retain all original gaps, status, and provenance.
    q.primaryTopic = title;
    q.primaryTopicId = "practical-skills";
    q.subtopics = [title];
    q.detailedSubtopics = [title];
  }
  const newContentSha = sha256(JSON.stringify(output.questions));
  output.runtimeArtifact.practicalRoleRepair = {
    baselineRuntimeSha256: BASELINE_RUNTIME_SHA,
    baselineContentSha256: BASELINE_CONTENT_SHA,
    targetIdsSha256: TARGET_SHA,
    changedCount: 144,
    targetIds: ids,
    method: "frozen-other-queue-intersected-with-paper-components-51-53-and-61-63; broad practical role only; no semantic detail promotion",
    annotation: "Retains unresolved_taxonomy_gap and original classification provenance/gaps; assigns only the broad practical assessment role.",
  };
  output.runtimeArtifact.finalizedContentSha256 = newContentSha;
  output.runtimeArtifact.runtimeSha256 = null;
  output.runtimeArtifact.runtimeSha256 = runtimeSha256(output);
  return output;
}

async function main() {
  need(process.argv[2] === "--write", "explicit --write required");
  const root = path.resolve(import.meta.dirname, "..");
  const frozenText = await readFile(path.join(root, "scripts/data/0625-practical-retrieval-targets.json"), "utf8");
  const frozen = JSON.parse(frozenText);
  const fromBaseline = (filename) => execFileSync("git", ["show", `${BASELINE_COMMIT}:${filename}`], { cwd: root, maxBuffer: 40_000_000 }).toString("utf8");
  const runtimeText = fromBaseline(`src/data/production/${BANK}.json`);
  const [manifestText, receiptText] = await Promise.all([
    readFile(path.join(root, `data/storage/${BANK}.manifest.json`), "utf8"),
    readFile(path.join(root, `data/storage/${BANK}.receipt.json`), "utf8"),
  ]);
  const baseline = JSON.parse(runtimeText);
  const output = reseal({ baseline, frozen, manifestText, receiptText });
  const indexPath = path.join(root, `src/data/private-index/${BANK}.json`);
  const privateIndex = JSON.parse(fromBaseline(`src/data/private-index/${BANK}.json`));
  need(Array.isArray(privateIndex.questions) && privateIndex.questions.length === 5789, "private index count mismatch");
  const byId = new Map(output.questions.map((q) => [q.id, q]));
  const targetSet = new Set(output.runtimeArtifact.practicalRoleRepair.targetIds);
  for (const q of privateIndex.questions) {
    if (!targetSet.has(q.id)) continue;
    const updated = byId.get(q.id);
    if (!updated) fail(`private index row missing in runtime: ${q.id}`);
    Object.assign(q, { primaryTopic: updated.primaryTopic, primaryTopicId: updated.primaryTopicId, subtopics: updated.subtopics, detailedSubtopics: updated.detailedSubtopics });
  }
  await writeFile(path.join(root, `src/data/production/${BANK}.json`), `${JSON.stringify(output)}\n`);
  await writeFile(indexPath, `${JSON.stringify(privateIndex)}\n`);
  console.log(JSON.stringify({ changed: 144, unchanged: 5645, targetIdsSha256: TARGET_SHA, runtimeSha256: output.runtimeArtifact.runtimeSha256, contentSha256: output.runtimeArtifact.finalizedContentSha256 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
