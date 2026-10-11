#!/usr/bin/env node
// Builds a task manifest for explanation generation: question/mark-scheme PNGs, extracted text and output paths.
// Usage:
//   node scripts/explanations/prepare-batch.mjs --bank ib-hl --sample 12 [--seed calib1]
//   node scripts/explanations/prepare-batch.mjs --bank ib-hl --ids id1,id2
//   node scripts/explanations/prepare-batch.mjs --bank ib-hl --all [--pending]
// Writes <research>/explanations/<bank>/_manifests/<name>.json and prints its path.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectsRoot = process.env.PPP_PROJECTS_ROOT ?? "/Users/sakshamgoel/Documents/ProjectsInternships";
export const researchRoot = join(projectsRoot, "research/explanations");

export const BANKS = {
  "ib-hl": {
    data: "src/data/raw/ib-hl.json",
    imageRoot: join(projectsRoot, "ib-maths-aa-hl-topic-practice/site"),
    calculator: (q) => q.paper !== 1,
  },
};

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

const hash = (s) => createHash("sha256").update(s).digest("hex");
export const outputPathFor = (bank, id) => join(researchRoot, bank, `${id}.json`);

function toPng(bank, imageRoot, rel) {
  const src = join(imageRoot, rel);
  if (!existsSync(src)) throw new Error(`Missing image ${src}`);
  const dest = join(researchRoot, "_png", bank, rel.replace(/\.webp$/i, ".png"));
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    execFileSync("sips", ["-s", "format", "png", src, "--out", dest], { stdio: "ignore" });
  }
  return dest;
}

function marksBand(m) {
  if (m <= 5) return "short";
  if (m <= 9) return "medium";
  return "long";
}

function sample(questions, n, seed) {
  const strata = new Map();
  for (const q of questions) {
    const key = `${q.paper}|${q.courseEra ?? ""}|${marksBand(q.marks)}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(q);
  }
  for (const list of strata.values()) list.sort((a, b) => hash(seed + a.id).localeCompare(hash(seed + b.id)));
  const keys = [...strata.keys()].sort((a, b) => hash(seed + a).localeCompare(hash(seed + b)));
  const picked = [];
  for (let round = 0; picked.length < n; round += 1) {
    let added = false;
    for (const key of keys) {
      const q = strata.get(key)[round];
      if (q && picked.length < n) { picked.push(q); added = true; }
    }
    if (!added) break;
  }
  return picked;
}

function main() {
  const a = args(process.argv.slice(2));
  const bank = a.bank;
  const config = BANKS[bank];
  if (!config) throw new Error(`Unknown bank ${bank}. Known: ${Object.keys(BANKS).join(", ")}`);
  const raw = JSON.parse(readFileSync(join(repoRoot, config.data), "utf8"));
  let questions = raw.questions ?? raw;
  if (a.pending) questions = questions.filter((q) => !existsSync(outputPathFor(bank, q.id)));

  let chosen;
  let name;
  if (a.ids) {
    const ids = String(a.ids).split(",");
    chosen = ids.map((id) => questions.find((q) => q.id === id) ?? (() => { throw new Error(`Unknown id ${id}`); })());
    name = a.name ?? `ids-${hash(ids.join()).slice(0, 8)}`;
  } else if (a.sample) {
    chosen = sample(questions, Number(a.sample), String(a.seed ?? "calibration"));
    name = a.name ?? `sample-${a.seed ?? "calibration"}-${a.sample}`;
  } else if (a.all) {
    chosen = questions;
    name = a.name ?? (a.pending ? "pending" : "all");
  } else {
    throw new Error("Pass --ids, --sample N or --all");
  }

  const tasks = chosen.map((q) => {
    const msImages = q.officialMarkscheme?.images ?? q.markschemeImages ?? [];
    if (!msImages.length) throw new Error(`No mark scheme images for ${q.id}`);
    return {
      bank,
      questionId: q.id,
      number: q.number,
      paper: q.paper,
      year: q.year,
      session: q.session,
      marks: q.marks ?? q.maxMarks ?? q.maximumMarks,
      calculator: config.calculator(q),
      questionImages: (q.questionImages ?? []).map((p) => toPng(bank, config.imageRoot, p)),
      markschemeImages: msImages.map((p) => toPng(bank, config.imageRoot, p)),
      questionText: q.accessibleText ?? q.summary ?? "",
      markschemeText: q.markschemeTranscript ?? "",
      outputPath: outputPathFor(bank, q.id),
    };
  });

  const manifestPath = join(researchRoot, bank, "_manifests", `${name}.json`);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({ bank, name, count: tasks.length, tasks }, null, 2)}\n`);
  console.log(manifestPath);
  console.log(`${tasks.length} tasks: ${tasks.map((t) => `${t.questionId} [${t.marks}]`).join(", ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
