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
import { calculatorAllowed } from "../../src/lib/calculator-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Sibling workspaces sit next to the main checkout; resolve through Git so this works from a worktree too.
function workspaceRoot() {
  try {
    const commonDir = execFileSync("git", ["-C", repoRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return resolve(dirname(commonDir), "..");
  } catch {
    return resolve(repoRoot, "..");
  }
}
const projectsRoot = process.env.PPP_PROJECTS_ROOT ?? workspaceRoot();
export const researchRoot = join(projectsRoot, "research/explanations");

const site = (repository) => join(projectsRoot, repository, "site");
const calculator = (bank) => (q) => calculatorAllowed(bank, { paper: q.paper, year: q.year });

// Image roots match scripts/sync-r2-assets.mjs SOURCES.
export const BANKS = {
  "ib-hl": { data: "src/data/raw/ib-hl.json", imageRoot: site("ib-maths-aa-hl-topic-practice"), calculator: calculator("ib-hl") },
  "ib-sl": { data: "src/data/raw/ib-sl.json", imageRoot: site("ib-maths-aa-topic-finder-audit"), calculator: calculator("ib-sl") },
  "ib-ai-hl": { data: "src/data/raw/ib-ai-hl.json", imageRoot: site("ib-maths-ai-hl-topic-practice-full-audit-final"), calculator: calculator("ib-ai-hl") },
  "ib-ai-sl": { data: "src/data/raw/ib-ai-sl.json", imageRoot: site("ib-maths-ai-sl-topic-practice-audit-fix-ai-sl"), calculator: calculator("ib-ai-sl") },
  "ib-physics-hl": {
    data: "src/data/raw/ib-physics-hl.json",
    imageRoot: site("ib-physics-topic-practice"),
    calculator: calculator("ib-physics-hl"),
    // 2016-2019 extension rows reference images by public URL; the committed manifest maps them to source files.
    extension: { publicRoot: "https://saksham106.github.io/ib-physics-topic-practice/", repositoryRoot: join(projectsRoot, "ib-physics-topic-practice"), manifest: "docs/ib-science-storage/ib-physics-hl.pending-upload-manifest.json" },
  },
  "igcse": { data: "src/data/raw/igcse.json", imageRoot: site("igcse-0580-topic-practice"), calculator: calculator("igcse") },
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

const extensionSources = new Map();
function sourceFile(bank, config, rel) {
  if (!/^https?:/.test(rel)) return join(config.imageRoot, rel);
  const ext = config.extension;
  if (!ext || !rel.startsWith(ext.publicRoot)) throw new Error(`Unmapped image URL ${rel}`);
  if (!extensionSources.has(bank)) {
    const manifest = JSON.parse(readFileSync(join(repoRoot, ext.manifest), "utf8"));
    extensionSources.set(bank, new Map(manifest.assets.map((asset) => [asset.objectKey, join(ext.repositoryRoot, asset.sourcePath)])));
  }
  const key = rel.slice(ext.publicRoot.length);
  const file = extensionSources.get(bank).get(key);
  if (!file) throw new Error(`No extension source for ${rel}`);
  return file;
}

function toPng(bank, config, rel) {
  const src = sourceFile(bank, config, rel);
  rel = rel.replace(/^https?:\/\/[^/]+\/[^/]+\//, "");
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

  const msImagesOf = (q) => q.officialMarkscheme?.images ?? q.markschemeImages ?? [];
  const skipped = chosen.filter((q) => !msImagesOf(q).length).map((q) => q.id);
  if (skipped.length && !a.all) throw new Error(`No mark scheme images for ${skipped.join(", ")}`);
  const tasks = chosen.filter((q) => msImagesOf(q).length).map((q) => {
    const msImages = msImagesOf(q);
    return {
      bank,
      questionId: q.id,
      number: q.number,
      paper: q.paper,
      year: q.year,
      session: q.session,
      marks: q.marks ?? q.maxMarks ?? q.maximumMarks,
      calculator: config.calculator(q),
      questionImages: (q.questionImages ?? []).map((p) => toPng(bank, config, p)),
      markschemeImages: msImages.map((p) => toPng(bank, config, p)),
      questionText: q.accessibleText ?? q.summary ?? "",
      markschemeText: q.markschemeTranscript ?? "",
      outputPath: outputPathFor(bank, q.id),
    };
  });

  const manifestPath = join(researchRoot, bank, "_manifests", `${name}.json`);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({ bank, name, count: tasks.length, tasks }, null, 2)}\n`);
  console.log(manifestPath);
  if (skipped.length) console.log(`Skipped ${skipped.length} without a mark scheme: ${skipped.join(", ")}`);
  console.log(`${tasks.length} tasks: ${tasks.map((t) => `${t.questionId} [${t.marks}]`).join(", ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
