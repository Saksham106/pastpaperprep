#!/usr/bin/env node
/**
 * Proves the May 2026 Economics addition is a pure, gated insertion: every sealed 2021-2025 Economics artifact is
 * byte-identical to the base ref, the Full past papers candidate is the committed manifest plus the 2026 entries only,
 * and nothing was uploaded.
 *
 *   node scripts/verify-ib-economics-2026-may-addition.mjs [--base-ref origin/main]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const refIndex = process.argv.indexOf("--base-ref");
const baseRef = refIndex > -1 ? process.argv[refIndex + 1] : process.env.BASE_REF ?? "origin/main";
const git = (args) => execFileSync("git", args, { cwd: root, maxBuffer: 1 << 28 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const banks = ["ib-economics-hl", "ib-economics-sl"];

const frozen = [
  ...banks.flatMap((bank) => [
    `src/data/production/${bank}.json`,
    `src/data/private-index/${bank}.json`,
    `src/data/local-preview/${bank}.json`,
    `docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`,
    `src/data/paper-archives/${bank}.json`,
  ]),
  "src/data/ib-economics-runtime-manifest.json",
  "src/data/ib-economics-taxonomy.json",
  "src/data/paper-archive-readback.json",
  ...readdirSync(join(root, "docs/ib-economics-storage-receipts")).map((name) => `docs/ib-economics-storage-receipts/${name}`),
];

const errors = [];
const identical = {};
for (const path of frozen) {
  const base = git(["show", `${baseRef}:${path}`]);
  const current = readFileSync(join(root, path));
  identical[path] = sha(base);
  if (!base.equals(current)) errors.push(`${path} differs from ${baseRef}`);
}

const archive = {};
for (const bank of banks) {
  const committed = JSON.parse(git(["show", `${baseRef}:src/data/paper-archives/${bank}.json`]));
  const candidate = JSON.parse(readFileSync(join(root, `docs/ib-economics-2026-may-papers/candidate-archives/${bank}.json`), "utf8"));
  const isNew = (paper) => paper.summary.id.includes("-2026-");
  const old = candidate.papers.filter((paper) => !isNew(paper));
  if (JSON.stringify(old) !== JSON.stringify(committed.papers)) errors.push(`${bank}: candidate archive changes existing entries`);
  if (candidate.runtimeSha256 !== committed.runtimeSha256 || candidate.version !== committed.version) errors.push(`${bank}: candidate archive header drifted`);
  archive[bank] = { existing: committed.papers.length, added: candidate.papers.filter(isNew).length };
}

for (const path of ["docs/ib-economics-2026-may-r2-upload-plan.json", "docs/ib-economics-2026-may-free-papers-upload-plan.json"]) {
  if (JSON.parse(readFileSync(join(root, path), "utf8")).executed !== false) errors.push(`${path} claims to be executed`);
}

console.log(JSON.stringify({ baseRef, frozenFiles: frozen.length, identical: errors.length === 0, archive, errors }, null, 2));
process.exit(errors.length ? 1 : 0);
