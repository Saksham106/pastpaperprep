#!/usr/bin/env node
// Rebuilds a bank's verification ledger from one or more workflow journals, merging with any existing
// ledger, and lists what is still to do.
// Usage: node scripts/explanations/ledger-from-journal.mjs --bank ib-hl --manifest <manifest.json> <journal.jsonl> [...]
//        [--single-bank-journal <journal.jsonl>]  an early run that only ever processed this bank, from before
//        labels carried the bank: its unlabelled results count for --bank. Refused if any label names another
//        bank or any result ID is missing from this bank's manifest.
// Writes <research>/explanations/<bank>/_ledger.json and _todo.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BANKS, outputPathFor, researchRoot } from "./prepare-batch.mjs";

const argv = process.argv.slice(2);
const flag = (name) => argv[argv.indexOf(name) + 1];
const bank = flag("--bank");
if (!Object.hasOwn(BANKS, bank)) throw new Error("Pass --bank <known slug>");
const manifest = JSON.parse(readFileSync(flag("--manifest"), "utf8"));
if (manifest.bank !== bank || !Array.isArray(manifest.tasks) || manifest.tasks.some(t => t.bank !== bank || typeof t.questionId !== "string" || !/^[A-Za-z0-9._-]+$/.test(t.questionId) || [".", ".."].includes(t.questionId))) throw new Error("Manifest bank/IDs do not match requested bank");
if (new Set(manifest.tasks.map(t => t.questionId)).size !== manifest.tasks.length) throw new Error("Duplicate manifest question IDs");
const journals = argv.filter((arg, i) => arg.endsWith(".jsonl") && argv[i - 1] !== "--manifest");
const singleBank = new Set(argv.filter((arg, i) => argv[i - 1] === "--single-bank-journal"));
const manifestIds = new Set(manifest.tasks.map((t) => t.questionId));
for (const file of singleBank) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    const named = /^(?:generate|verify|fix|re-verify)\s+((?:ib|igcse)[a-z0-9-]*)(?:\s|$)/.exec(entry.label ?? "")?.[1];
    if (named && named !== bank) throw new Error(`${file} is not single-bank: label names ${named}`);
    for (const r of entry.result?.results ?? []) if (!manifestIds.has(r.questionId)) throw new Error(`${file} has ${r.questionId}, not in ${bank}`);
  }
}

const critical = (v) => v.verdict === "fail" || v.issues.some((i) => i.severity === "critical");
const needsFix = (v) => v.verdict !== "pass" || v.issues.some((i) => i.severity === "critical");

// Latest outcome per question, by stage.
const verify = new Map();
const fixed = new Map();
const reverify = new Map();
for (const file of journals) {
  const labels = new Map();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.type === "started") labels.set(entry.agentId, entry.label ?? "");
    if (entry.type !== "result" || !entry.result?.results) continue;
    const label = labels.get(entry.agentId) ?? "";
    // Multi-bank workflows reuse question IDs. Never borrow another bank's verdict.
    const labelledBank = /^(?:generate|verify|fix|re-verify)\s+((?:ib|igcse)[a-z0-9-]*)(?:\s|$)/.exec(label)?.[1] ?? (singleBank.has(file) ? bank : undefined);
    if (labelledBank && labelledBank !== bank) continue;
    for (const r of entry.result.results) {
      // Missing scope is not evidence. If both scopes exist they must agree.
      if (Object.hasOwn(r, "bank") && r.bank !== bank) continue;
      if (labelledBank !== bank && r.bank !== bank) continue;
      if (label.startsWith("re-verify")) reverify.set(r.questionId, r);
      else if (label.startsWith("verify")) {
        verify.set(r.questionId, r);
        fixed.delete(r.questionId);
        reverify.delete(r.questionId);
      } else if (label.startsWith("fix")) {
        fixed.set(r.questionId, r);
        reverify.delete(r.questionId);
      }
    }
  }
}

const ledgerPath = join(researchRoot, bank, "_ledger.json");
const priorLedger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : null;
if (priorLedger && (priorLedger.bank !== bank || !Array.isArray(priorLedger.rows))) throw new Error("Invalid prior bank ledger");
const previous = new Map((priorLedger?.rows ?? []).map((row) => [row.questionId, row]));
const scopedPrior = (row) => priorLedger?.bankEvidenceVersion === 1 && row.bankEvidenceVersion === 1 && row.bank === bank;
const done = new Set(["pass", "pass-after-fix", "pass-after-minor-fix", "review"]);
const rows = [];
const todo = { generate: [], verify: [], fix: [], reverify: [] };

for (const task of manifest.tasks) {
  const id = task.questionId;
  const v = verify.get(id);
  const rv = reverify.get(id);
  const fx = fixed.get(id);
  let row;
  if (rv) {
    const ok = rv.verdict === "pass" && !rv.issues.some((i) => i.severity === "critical");
    row = { questionId: id, status: ok ? "pass-after-fix" : "review", verdict: v?.verdict ?? null, quality: rv.quality, issues: rv.issues.filter((i) => i.severity === "critical").map((i) => `${i.part}: ${i.problem}`) };
  } else if (v && !needsFix(v)) {
    row = { questionId: id, status: "pass", verdict: v.verdict, quality: v.quality, issues: [] };
  } else if (v && fx && !critical(v)) {
    row = { questionId: id, status: fx.fixed === true && fx.validatorPassed === true ? "pass-after-minor-fix" : "review", verdict: v.verdict, quality: v.quality, issues: [] };
  } else if (v && fx) {
    row = { questionId: id, status: "needs-reverify", verdict: v.verdict, quality: v.quality, issues: v.issues.filter((i) => i.severity === "critical").map((i) => `${i.part}: ${i.problem}`) };
    todo.reverify.push(id);
  } else if (v) {
    row = { questionId: id, status: "needs-fix", verdict: v.verdict, quality: v.quality, issues: v.issues.map((i) => `${i.severity} ${i.part}: ${i.problem}`) };
    todo.fix.push({ questionId: id, verdict: v.verdict, issues: v.issues });
  } else if (existsSync(outputPathFor(bank, id))) {
    row = { questionId: id, status: "needs-verify", issues: [] };
    todo.verify.push(id);
  } else {
    row = { questionId: id, status: "needs-generate", issues: [] };
    todo.generate.push(id);
  }
  // This marker asserts scoped reducer evidence, not hash-bound content review.
  if (v || rv || fx) row = { ...row, bank, bankEvidenceVersion: 1 };
  const prior = previous.get(id);
  // Legacy rows need explicit journal rematerialization; never bless them by fallback.
  if (prior && scopedPrior(prior) && !v && !rv && !fx && done.has(prior.status)) row = prior;
  rows.push(row);
}

// Keep rows outside a bounded continuation/calibration manifest.
const included = new Set(rows.map(row => row.questionId));
for (const [id, row] of previous) if (!included.has(id)) {
  // A new header must not upgrade untrusted rows outside a subset manifest.
  if (scopedPrior(row)) rows.push(row);
  else {
    const legacy = { ...row };
    delete legacy.bankEvidenceVersion;
    rows.push(legacy);
  }
}

// Remove todo entries that an earlier ledger already settled.
const settled = new Set(rows.filter((row) => done.has(row.status)).map((row) => row.questionId));
todo.generate = todo.generate.filter((id) => !settled.has(id));
todo.verify = todo.verify.filter((id) => !settled.has(id));
todo.fix = todo.fix.filter((item) => !settled.has(item.questionId));
todo.reverify = todo.reverify.filter((id) => !settled.has(id));

writeFileSync(ledgerPath, `${JSON.stringify({ bank, bankEvidenceVersion: 1, updated: new Date().toISOString(), rows }, null, 2)}\n`);
writeFileSync(join(researchRoot, bank, "_todo.json"), `${JSON.stringify(todo, null, 2)}\n`);
const counts = rows.reduce((acc, row) => ((acc[row.status] = (acc[row.status] ?? 0) + 1), acc), {});
console.log(JSON.stringify({ bank, total: rows.length, counts, todo: Object.fromEntries(Object.entries(todo).map(([k, v]) => [k, v.length])) }));
