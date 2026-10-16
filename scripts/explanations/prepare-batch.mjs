#!/usr/bin/env node
// Builds a task manifest for explanation generation: question/mark-scheme PNGs, extracted text and output paths.
// Usage:
//   node scripts/explanations/prepare-batch.mjs --bank ib-hl --sample 12 [--seed calib1]
//   node scripts/explanations/prepare-batch.mjs --bank ib-hl --ids id1,id2
//   node scripts/explanations/prepare-batch.mjs --bank ib-hl --all [--pending] [--years 2026,2025]
// Images come from the bank's source workspace; any that are missing locally are fetched from R2
// (read-only, owner's Wrangler login; set WRANGLER to a local binary) into research/explanations/_r2src.
// Writes <research>/explanations/<bank>/_manifests/<name>.json and prints its path.
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  "igcse-additional": { data: "src/data/raw/igcse-additional.json", imageRoot: join(projectsRoot, "igcse-additional-mathematics-0606-topic-practice/.worktrees/pr1/site"), calculator: calculator("igcse-additional") },
  "ib-chemistry-hl": { data: "src/data/raw/ib-chemistry-hl.json", imageRoot: site("ib-chemistry-topic-practice"), calculator: calculator("ib-chemistry-hl") },
  "ib-chemistry-sl": { data: "src/data/raw/ib-chemistry-sl.json", imageRoot: site("ib-chemistry-topic-practice"), calculator: calculator("ib-chemistry-sl") },
  "ib-physics-sl": { data: "src/data/raw/ib-physics-sl.json", imageRoot: site("ib-physics-topic-practice"), calculator: calculator("ib-physics-sl") },
  "ib-biology-hl": { data: "src/data/raw/ib-biology-hl.json", imageRoot: site("ib-biology-topic-practice"), calculator: calculator("ib-biology-hl") },
  "ib-biology-sl": { data: "src/data/raw/ib-biology-sl.json", imageRoot: site("ib-biology-topic-practice"), calculator: calculator("ib-biology-sl") },
  "ib-economics-hl": { data: "src/data/production/ib-economics-hl.json", imageRoot: join(projectsRoot, "ib-economics-topic-practice/site/assets/ib-economics"), calculator: calculator("ib-economics-hl"), r2Prefix: "ib-economics-hl/" },
  "ib-economics-sl": { data: "src/data/production/ib-economics-sl.json", imageRoot: join(projectsRoot, "ib-economics-topic-practice/site/assets/ib-economics"), calculator: calculator("ib-economics-sl"), r2Prefix: "ib-economics-sl/" },
  // IGCSE release banks: images live only under their R2 release prefix (src/lib/private-runtime-mapping.ts).
  "igcse-physics-0625": { data: "src/data/production/igcse-physics-0625.json", calculator: calculator("igcse-physics-0625"), r2Prefix: "igcse-physics-0625/releases/repaired-v2-d95657a79bfc/" },
  "igcse-chemistry-0620": { data: "src/data/production/igcse-chemistry-0620.json", calculator: calculator("igcse-chemistry-0620"), r2Prefix: "igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/" },
  "igcse-biology-0610": { data: "src/data/production/igcse-biology-0610.json", calculator: calculator("igcse-biology-0610"), r2Prefix: "igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/" },
  "igcse-coordinated-sciences-0654": { data: "src/data/production/igcse-coordinated-sciences-0654.json", calculator: calculator("igcse-coordinated-sciences-0654"), r2Prefix: "igcse-coordinated-sciences-0654/releases/full4721-v1-6b161eb9e580/" },
  "igcse-economics-0455": { data: "src/data/production/igcse-economics-0455.json", calculator: calculator("igcse-economics-0455"), r2Prefix: "igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/" },
};
const r2Cache = (bank) => join(researchRoot, "_r2src", bank);
// A failed or throttled download can leave an empty file behind; it is not an image.
export const present = (file) => existsSync(file) && statSync(file).size > 0;

// The site serves repaired crops for some questions, so build from exactly what students see:
// the generated asset manifest's object keys. Release banks need their production flags.
const RELEASE_FLAGS = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true", PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true", PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true" };
// The file name only records the runtime mode, not the data it was built from, so never reuse one:
// rebuild from the current bank data every time and read exactly the file the generator reports.
const generateManifest = (bank) => execFileSync("npx", ["tsx", "scripts/generate-asset-manifest.mts", "--bank", bank], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, ...RELEASE_FLAGS } });
export function servedManifest(bank, { dir = join(repoRoot, "generated", "asset-manifest"), generate = generateManifest } = {}) {
  mkdirSync(dir, { recursive: true });
  const out = generate(bank);
  const name = new RegExp(`^${bank}: .* -> (\\S+\\.json)$`, "m").exec(out)?.[1];
  if (!name) throw new Error(`${bank}: asset manifest was not generated (${out.trim()})`);
  const manifest = JSON.parse(readFileSync(join(dir, name), "utf8"));
  // Without the production flags the manifest points at local preview routes, not served objects.
  if (JSON.stringify(manifest).includes("/api/local-preview-assets/")) throw new Error(`${bank}: production asset manifest unavailable`);
  return manifest;
}
// An object key like "ib-hl/questions/x.webp" maps to "questions/x.webp" in the source workspace.
const relOfKey = (bank, key) => key.startsWith(`${bank}/`) ? key.slice(bank.length + 1) : key;

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
  if (!/^https?:/.test(rel)) {
    const local = config.imageRoot && join(config.imageRoot, relOfKey(bank, rel));
    return local && present(local) ? local : join(r2Cache(bank), rel);
  }
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
  if (!present(src)) throw new Error(`Missing or empty image ${src}`);
  const dest = join(researchRoot, "_png", bank, rel.replace(/\.webp$/i, ".png"));
  if (!present(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    execFileSync("sips", ["-s", "format", "png", src, "--out", dest], { stdio: "ignore" });
    // sips reports a bad source only as a warning, so check that the image was written.
    if (!present(dest)) throw new Error(`Could not convert ${src} to PNG`);
  }
  return dest;
}

// Download any images missing locally from R2 (read-only), a few at a time.
async function fetchMissing(bank, config, rels) {
  const missing = [...new Set(rels)].filter((rel) => !/^https?:/.test(rel) && !present(sourceFile(bank, config, rel)));
  if (!missing.length) return;
  const run = promisify(execFile);
  const [bin, ...prefix] = process.env.WRANGLER ? [process.env.WRANGLER] : ["npx", "-y", "wrangler@4"];
  const bucket = process.env.R2_BUCKET_NAME ?? "pastpaperprep-assets";
  console.error(`${bank}: fetching ${missing.length} images from R2`);
  // Cloudflare's API allows about 4 requests/second per account (shared with any other job), so
  // keep this small and back off on 429. Only "does not exist" counts as missing.
  const queue = [...missing];
  const failed = [];
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let rel = queue.shift(); rel; rel = queue.shift()) {
      const target = join(r2Cache(bank), rel);
      const partial = `${target}.partial`;
      mkdirSync(dirname(target), { recursive: true });
      for (let attempt = 1; ; attempt += 1) {
        try {
          rmSync(partial, { force: true });
          await run(bin, [...prefix, "r2", "object", "get", `${bucket}/${rel}`, "--file", partial, "--remote"], { maxBuffer: 1 << 24 });
          // Only a non-empty download replaces the cached image.
          if (!present(partial)) throw Object.assign(new Error("empty download"), { stderr: "empty download" });
          renameSync(partial, target);
          break;
        } catch (error) {
          rmSync(partial, { force: true });
          const text = `${error?.stderr ?? ""} ${error?.stdout ?? ""}`;
          if (/does not exist|NoSuchKey/i.test(text) || attempt >= 8) { failed.push(rel); break; }
          await sleep((/429|Too Many Requests|throttl/i.test(text) ? 5000 : 1500) * attempt);
        }
      }
    }
  }));
  if (failed.length) throw new Error(`${bank}: ${failed.length} images not in R2, e.g. ${failed.slice(0, 3).join(", ")}`);
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

async function main() {
  const a = args(process.argv.slice(2));
  const bank = a.bank;
  const config = BANKS[bank];
  if (!config) throw new Error(`Unknown bank ${bank}. Known: ${Object.keys(BANKS).join(", ")}`);
  const raw = JSON.parse(readFileSync(join(repoRoot, config.data), "utf8"));
  let questions = raw.questions ?? raw;
  if (a.pending) questions = questions.filter((q) => !existsSync(outputPathFor(bank, q.id)));
  if (a.years) {
    const years = new Set(String(a.years).split(",").map(Number));
    questions = questions.filter((q) => years.has(q.year));
  }

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

  const served = servedManifest(bank);
  const questionImagesOf = (q) => served[q.id]?.questionAssetPaths ?? [];
  const msImagesOf = (q) => served[q.id]?.markschemeAssetPaths ?? [];
  const skipped = chosen.filter((q) => !msImagesOf(q).length).map((q) => q.id);
  if (skipped.length && !a.all) throw new Error(`No mark scheme images for ${skipped.join(", ")}`);
  const usable = chosen.filter((q) => msImagesOf(q).length);
  await fetchMissing(bank, config, usable.flatMap((q) => [...questionImagesOf(q), ...msImagesOf(q)]));
  const tasks = usable.map((q) => {
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
      questionImages: questionImagesOf(q).map((p) => toPng(bank, config, p)),
      markschemeImages: msImages.map((p) => toPng(bank, config, p)),
      questionText: q.accessibleText ?? q.summary ?? "",
      markschemeText: q.markschemeTranscript ?? q.markschemeText ?? "",
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

if (import.meta.url === `file://${process.argv[1]}`) await main();
