#!/usr/bin/env node
// Writes docs/ib-business-management-archive/archive-inventory.json: the whole-paper inventory for the IB Business
// Management banks, the input of
//   npx tsx scripts/build-whole-paper-archives.mts --inventory docs/ib-business-management-archive/archive-inventory.json
//
// Pairs come from the source workspace's pinned acquisition manifest
// (ib-business-management-topic-practice/data/acquisition-manifest.json); every PDF is re-hashed here. Runtime ids
// come from src/data/production, so the inventory always equals the runtime it is built for. No network, no uploads.
//
// Old-guide Paper 1 (Nov 2020 to Nov 2023) needs the separate pre-seen case study booklet: it is listed with that
// booklet as the archive's optional insert (one booklet per session serves HL, SL and both time zones).
//
// Left out, on purpose:
// - Nov 2025 Paper 2 SL TZ1: no question paper exists on any host (unpaired).
// - The "More Papers" supplementary uploads (supplementary_held in the manifest): never in `papers`.
//
//   node scripts/build-ib-business-management-archive-inventory.mjs [--check]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const WORKSPACE_NAME = "ib-business-management-topic-practice";
// Sibling of the main checkout; worktrees sit one or two levels deeper, so walk up until it is found.
function findWorkspace() {
  for (let dir = root; dir !== dirname(dir); dir = dirname(dir)) if (existsSync(join(dir, WORKSPACE_NAME, "data/acquisition-manifest.json"))) return join(dir, WORKSPACE_NAME);
  throw new Error(`${WORKSPACE_NAME} not found above ${root}`);
}
const workspace = findWorkspace();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(join(workspace, "data/acquisition-manifest.json"));

const OLD_P1_NOTE = "Old-guide Paper 1 (Nov 2020 to Nov 2023) is listed with its pre-seen case study booklet as the insert; the booklet's hash is pinned in the acquisition manifest, which also checked its session against the paper (case_link_check).";
const INSERT_LABEL = "Case study";
const SOURCE_NOTE = "Sources: IB Docs (ibdocs.re) to Nov 2025, papers.xtremepape.rs for May 2026; SHA-256 pinned in ib-business-management-topic-practice/data/acquisition-manifest.json; identity-checked; watermark scan flags only exam-text domains (statista.com, smartg.com, robustbeans.com). Supplementary 'More Papers' uploads excluded.";

/** Source PDF path, checked against its pinned bytes. */
function pinned(doc, label) {
  const path = join(workspace, doc.path);
  if (sha(readFileSync(path)) !== doc.sha256) throw new Error(`Source hash drift: ${label} ${doc.path}`);
  return path;
}
const session = (paper) => (paper.month === "May" ? "may" : paper.month === "November" ? "nov" : null);
const zone = (paper) => (paper.tz ? paper.tz.toLowerCase() : "tz0");

const banks = [];
for (const level of ["hl", "sl"]) {
  const slug = `ib-business-management-${level}`;
  const runtimeFile = join(root, `src/data/production/${slug}.json`);
  const runtime = readJson(runtimeFile);
  const idsByPaper = new Map();
  for (const q of runtime.questions) {
    const paperId = q.id.replace(/-q\d+$/, "");
    if (!idsByPaper.has(paperId)) idsByPaper.set(paperId, []);
    idsByPaper.get(paperId).push(q.id);
  }
  const pairs = [], unpaired = [];
  for (const paper of manifest.papers.filter((entry) => entry.serves_banks.includes(level.toUpperCase()))) {
    const sessionCode = session(paper);
    if (!sessionCode) throw new Error(`Unknown session ${paper.month} for ${paper.id}`);
    const paperLevel = paper.level.toLowerCase();
    const runtimePaperId = `ibbm-${paper.year}-${sessionCode}-${paperLevel}-p${paper.paper}-${zone(paper)}`;
    const booklet = paper.guide === "old" && paper.paper === 1;
    if (paper.status !== "complete") { unpaired.push({ id: paper.id, runtimePaperId, status: paper.status, reason: "No question paper on any host; the mark scheme alone is not listed." }); continue; }
    if (paper.qp.identity !== "pass" || paper.ms.identity !== "pass") throw new Error(`Identity not passed: ${paper.id}`);
    if (booklet && (paper.case_booklet?.identity !== "pass" || paper.case_link_check?.ok !== true)) throw new Error(`Case booklet not checked: ${paper.id}`);
    if (!booklet && paper.case_booklet) throw new Error(`Unexpected case booklet: ${paper.id}`);
    const runtimeQuestionIds = idsByPaper.get(runtimePaperId);
    if (!runtimeQuestionIds?.length) throw new Error(`${slug}: no runtime questions for ${runtimePaperId}`);
    pairs.push({
      id: `business-management-${paper.year}-${sessionCode}-${zone(paper)}-${paperLevel}-p${paper.paper}`,
      runtimePaperId,
      questionPath: pinned(paper.qp, paper.id),
      markschemePath: pinned(paper.ms, paper.id),
      ...(booklet ? { insertPath: pinned(paper.case_booklet, paper.id), insertLabel: INSERT_LABEL } : {}),
      runtimeQuestionIds,
      metadata: { sourceHost: paper.qp.host, guide: paper.guide, acquisitionId: paper.id },
    });
  }
  pairs.sort((a, b) => a.id.localeCompare(b.id));
  const paired = new Set(pairs.map((pair) => pair.runtimePaperId));
  const runtimeWithoutPair = [...idsByPaper.keys()].filter((id) => !paired.has(id)).sort();
  // Every runtime paper is paired.
  if (runtimeWithoutPair.length) throw new Error(`${slug}: runtime papers without a pair: ${runtimeWithoutPair.join(", ")}`);
  if (pairs.length !== runtime.paperCount) throw new Error(`${slug}: ${pairs.length} pairs for ${runtime.paperCount} runtime papers`);
  banks.push({ slug, runtimeFile, pairs, unpaired, runtimeWithoutPair: [], notes: [SOURCE_NOTE, OLD_P1_NOTE] });
}

const text = `${JSON.stringify({ banks }, null, 2)}\n`;
const target = join(root, "docs/ib-business-management-archive/archive-inventory.json");
if (check) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== text) { console.error("DRIFT archive-inventory.json"); process.exit(1); }
} else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); }
console.log(`${check ? "checked" : "wrote"} inventory: ${banks.map((bank) => `${bank.slug}=${bank.pairs.length} (${bank.pairs.filter((pair) => pair.insertPath).length} with case study, ${bank.unpaired.length} unpaired)`).join(" ")}`);
