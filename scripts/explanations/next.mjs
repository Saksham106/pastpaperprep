#!/usr/bin/env node
// One command to resume explanation work after a pause, from any session.
//   node scripts/explanations/next.mjs [--wave wave1] [--banks a,b] [--budget 900]
// For every bank with research/explanations/<bank>/_manifests/<wave>.json it:
//   1. rebuilds the bank ledger from every workflow journal on disk (all sessions, oldest run first),
//   2. writes a new, uniquely named <wave>.next-<time>-<id>.plan.json (created exclusively, never rewritten): fix chunks, then verify chunks (unchecked or re-fixed files), then write chunks
//      (missing files, or files that no longer validate),
//   3. writes _next-jobs.json and prints the Workflow args for continue.workflow.js, capped near --budget agents,
//   4. lists banks with verified explanations not yet live, with their publish command.
// Run it once no explanation workflow is running, or it re-plans their in-flight chunks.
// A new wave is a new manifest: prepare-batch.mjs --bank <b> --all --years 2024 --name wave2, then --wave wave2.
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExplanation } from "./validate.mjs";
import { BANKS, researchRoot } from "./prepare-batch.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const SIZES = { generate: 8, verify: 10, fix: 10 };
// Expected agents per chunk: each chunk is verified in the same run, and some need a fix and a re-check.
const COST = { fix: 1.3, verify: 1.7, generate: 2.7 };
const PASSED = new Set(["pass", "pass-after-fix", "pass-after-minor-fix"]);

// A running workflow reads its plan by path, so every plan gets its own name and is never rewritten.
export function writePlan(dir, wave, plan) {
  const file = join(dir, `${wave}.next-${new Date().toISOString().replace(/[-:.]/g, "")}-${randomUUID().slice(0, 8)}.plan.json`);
  writeFileSync(file, `${JSON.stringify(plan, null, 1)}\n`, { flag: "wx" });
  return file;
}

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// Chunk counts per bank and stage, finishing near-shippable work first (fix, verify, then write), within budget.
export function planJobs(plans, budget) {
  const take = new Map(plans.map((p) => [p.bank, { generate: 0, verify: 0, fix: 0 }]));
  let spent = 0;
  for (const stage of ["fix", "verify", "generate"]) {
    for (const p of plans) {
      for (let k = 0; k < p.plan[stage].length && spent + COST[stage] <= budget; k += 1) {
        take.get(p.bank)[stage] += 1;
        spent += COST[stage];
      }
    }
  }
  return { spent: Math.round(spent), counts: take };
}

function journals() {
  const root = join(homedir(), ".claude/projects", repoRoot.split("/.worktrees/")[0].replace(/[/.]/g, "-"));
  const files = [];
  for (const session of existsSync(root) ? readdirSync(root) : []) {
    const dir = join(root, session, "subagents/workflows");
    if (!existsSync(dir)) continue;
    for (const run of readdirSync(dir)) {
      const file = join(dir, run, "journal.jsonl");
      if (existsSync(file)) files.push(file);
    }
  }
  // Order does not matter: the ledger replays every result by when its agent finished.
  return files;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const wave = flag("--wave", "wave1");
  const budget = Number(flag("--budget", 900));
  const only = flag("--banks") ? new Set(flag("--banks").split(",")) : null;
  const banks = Object.keys(BANKS).filter((b) => (!only || only.has(b)) && existsSync(join(researchRoot, b, "_manifests", `${wave}.json`)));
  const runJournals = journals();
  const available = JSON.parse(readFileSync(join(repoRoot, "src/data/explanations/available.json"), "utf8"));

  const plans = [];
  const publish = [];
  for (const bank of banks) {
    const manifest = join(researchRoot, bank, "_manifests", `${wave}.json`);
    execFileSync("node", [join(here, "ledger-from-journal.mjs"), "--bank", bank, "--manifest", manifest, ...runJournals], { stdio: ["ignore", "ignore", "inherit"] });
    const tasks = new Map(JSON.parse(readFileSync(manifest, "utf8")).tasks.map((t) => [t.questionId, t]));
    const todo = JSON.parse(readFileSync(join(researchRoot, bank, "_todo.json"), "utf8"));
    const ledger = JSON.parse(readFileSync(join(researchRoot, bank, "_ledger.json"), "utf8"));

    // An unchecked file that no longer validates (for example a writer stopped mid-run) is rewritten, not checked.
    const valid = (id) => {
      const t = tasks.get(id);
      try { return validateExplanation(JSON.parse(readFileSync(t.outputPath, "utf8")), { bank, questionId: id, marks: t.marks }).length === 0; }
      catch { return false; }
    };
    const unchecked = [...todo.verify, ...todo.reverify].filter((id) => tasks.has(id));
    const plan = {
      generate: chunk([...todo.generate.filter((id) => tasks.has(id)), ...unchecked.filter((id) => !valid(id))], SIZES.generate),
      verify: chunk(unchecked.filter(valid), SIZES.verify),
      fix: chunk(todo.fix.filter((f) => tasks.has(f.questionId)), SIZES.fix),
    };
    const planFile = writePlan(join(researchRoot, bank, "_manifests"), wave, plan);
    plans.push({ bank, manifest, planFile, plan });

    const waveRows = ledger.rows.filter((r) => tasks.has(r.questionId));
    const count = (status) => waveRows.filter((r) => r.status === status).length;
    const passed = waveRows.filter((r) => PASSED.has(r.status)).length;
    const live = new Set(available[bank] ?? []);
    const unpublished = waveRows.filter((r) => PASSED.has(r.status) && !live.has(r.questionId)).length;
    if (unpublished) publish.push({ bank, unpublished });
    console.log(`${bank.padEnd(32)} ${String(tasks.size).padStart(4)} questions | passed ${passed}, review ${count("review")} | to write ${plan.generate.flat().length}, check ${plan.verify.flat().length}, fix ${plan.fix.flat().length}`);
  }

  const { spent, counts } = planJobs(plans, budget);
  const jobs = plans
    .map((p) => ({ bank: p.bank, manifest: p.manifest, planFile: p.planFile, ...counts.get(p.bank), genModel: "sonnet", genEffort: "medium", fixEffort: "medium", verifyEffort: "high" }))
    .filter((j) => j.generate + j.verify + j.fix > 0);
  const remaining = plans.reduce((n, p) => n + p.plan.generate.length + p.plan.verify.length + p.plan.fix.length, 0) - jobs.reduce((n, j) => n + j.generate + j.verify + j.fix, 0);
  writeFileSync(join(researchRoot, "_next-jobs.json"), `${JSON.stringify({ wave, jobs }, null, 1)}\n`);

  console.log("");
  for (const { bank, unpublished } of publish) console.log(`publish ${bank}: ${unpublished} verified, not live -> WRANGLER=/tmp/wrangler-cli/node_modules/.bin/wrangler node scripts/explanations/publish.mjs --bank ${bank} --apply --via-wrangler`);
  if (!jobs.length) { console.log(`Nothing left to run for ${wave}.`); return; }
  console.log(`\nWorkflow: scriptPath scripts/explanations/continue.workflow.js, about ${spent} agents${remaining ? `, ${remaining} chunks left for the next run` : ""}. args:`);
  console.log(JSON.stringify({ jobs }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
