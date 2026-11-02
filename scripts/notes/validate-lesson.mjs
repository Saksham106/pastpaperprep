// One-lesson gate for writers: everything the batch checks for a single lesson, read straight from files.
//
//   node scripts/notes/validate-lesson.mjs <item>        (e.g. 5.16 or 5-16)
//
// Runs, for that lesson only:
//   validator    validateLesson (src/lib/course-notes/validate.ts, loaded through tsx, KaTeX in Node as in vitest)
//                with items.json, every glossary/<item>.json merged, and every syllabus item as a link target
//                (the same context content.test.ts uses, so links to lessons not yet written still pass).
//                Plus the per-lesson parts of content.test.ts: file name matches item, figure SVGs exist and are
//                safe, glossary entries point at real items, slug unique in the topic, no prerequisite cycle.
//   check-math   scripts/notes/check-math.py <item> with the SymPy venv (AA_NOTES_PYTHON or ../research venv)
//   originality  scripts/notes/originality.mjs against ../research/aa-course-notes/packs/<item>.json
// It never touches the generated index, the receipts or any shared file, so parallel writers can run it safely.
// AA_NOTES_LESSONS_DIR / AA_NOTES_SIDECARS_DIR point at another lessons / sidecars folder (used by the tests).
// Exit 0: every check passed. Exit 1: a check failed. Exit 2: usage error or unknown item.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register as registerCjs } from "tsx/cjs/api";
import { register } from "tsx/esm/api";
import { findResearchDir, packPath } from "./build-source-pack.mjs";
import { findOverlaps } from "./originality.mjs";

register();
registerCjs(); // the repo is CommonJS by default, so .ts files load through require
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const courseRoot = join(repoRoot, "src/content/notes/ib-math-aa");
const lessonsDir = process.env.AA_NOTES_LESSONS_DIR ? resolve(process.env.AA_NOTES_LESSONS_DIR) : join(courseRoot, "lessons");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")).sort() : []);
const UNSAFE_SVG = /<script|\son\w+\s*=|javascript:|<foreignObject/i;

const arg = process.argv[2];
const items = readJson(join(repoRoot, "src/data/aa-official-subtopics/items.json"));
const item = arg?.replace("-", ".");
if (!item || !items.items.some((entry) => entry.item === item)) {
  console.error(`Usage: node scripts/notes/validate-lesson.mjs <item>  (unknown item ${arg ?? "(none)"})`);
  process.exit(2);
}
const dashed = item.replace(".", "-");
const results = [];
const record = (name, errors) => results.push({ name, errors });

// 1. Validator and per-lesson content checks.
{
  const errors = [];
  const lessonFile = join(lessonsDir, `${dashed}.json`);
  let lesson = null;
  try {
    lesson = readJson(lessonFile);
  } catch (error) {
    errors.push(`cannot read ${lessonFile}: ${error instanceof Error ? error.message : error}`);
  }
  if (lesson) {
    const { validateLesson } = await import(pathToFileURL(join(repoRoot, "src/lib/course-notes/validate.ts")).href);
    const { mergeGlossary } = await import(pathToFileURL(join(repoRoot, "src/lib/course-notes/glossary.ts")).href);
    const glossaryDir = join(courseRoot, "glossary");
    let glossary = [];
    try {
      glossary = mergeGlossary(Object.fromEntries(listJson(glossaryDir).map((file) => [file.replace(/\.json$/, ""), readJson(join(glossaryDir, file))])));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    const lessonItems = new Set(items.items.map((entry) => entry.item));
    errors.push(...validateLesson(lesson, { items, glossary, lessonItems }));
    if (lesson.item !== item) errors.push(`${dashed}.json holds item ${lesson.item}`);
    for (const term of glossary) if (!lessonItems.has(term.lesson)) errors.push(`glossary term ${term.id} points at unknown lesson ${term.lesson}`);
    const figures = lesson.sections.flatMap((section) => section.blocks.filter((block) => block.type === "figure"));
    for (const figure of figures) {
      if (!figure.id.startsWith(`${dashed}-`)) errors.push(`figure ${figure.id} must be named ${dashed}-<what>`);
      const svg = join(courseRoot, "figures", `${figure.id}.svg`);
      if (!existsSync(svg)) errors.push(`figure ${figure.id} has no file figures/${figure.id}.svg`);
      else if (UNSAFE_SVG.test(readFileSync(svg, "utf8"))) errors.push(`figures/${figure.id}.svg contains script, an event handler, javascript: or foreignObject`);
      else if (!readFileSync(svg, "utf8").trim().startsWith("<svg")) errors.push(`figures/${figure.id}.svg must start with <svg`);
    }
    // Other lessons on disk: slug clash in the topic, and prerequisite cycles through this lesson.
    const others = new Map();
    for (const file of listJson(lessonsDir)) {
      try {
        const other = readJson(join(lessonsDir, file));
        if (other.item !== item) others.set(other.item, other);
      } catch {
        // another writer's half-written file: not this lesson's problem
      }
    }
    for (const other of others.values()) if (other.topic === lesson.topic && other.slug === lesson.slug) errors.push(`slug ${lesson.slug} is already used by ${other.item}`);
    const graph = new Map([...[...others.values()].map((other) => [other.item, other.prerequisites ?? []]), [item, lesson.prerequisites]]);
    const reaches = (from, target, seen = new Set()) => (graph.get(from) ?? []).some((next) => next === target || (!seen.has(next) && (seen.add(next), reaches(next, target, seen))));
    if (reaches(item, item)) errors.push(`prerequisite cycle through ${item}`);
  }
  record("validator", errors);
}

// 2. SymPy gate.
{
  const research = findResearchDir();
  const python = [process.env.AA_NOTES_PYTHON, research && join(research, "aa-course-notes/.venv/bin/python")].find((p) => p && existsSync(p));
  if (!python) record("check-math", ["no SymPy python: set AA_NOTES_PYTHON or create ../research/aa-course-notes/.venv"]);
  else {
    const run = spawnSync(python, [join(repoRoot, "scripts/notes/check-math.py"), item], { encoding: "utf8", env: process.env });
    const lines = `${run.stdout}${run.stderr}`.split("\n").filter((line) => line.trim());
    const passed = lines.some((line) => line.startsWith("PASS"));
    record("check-math", run.status === 0 && passed ? [] : lines.filter((line) => !line.startsWith("PASS")).concat(passed ? [] : ["check-math.py printed no PASS line"]));
  }
}

// 3. Originality against the private pack.
{
  const research = findResearchDir();
  const pack = research && packPath(research, item);
  const lessonFile = join(lessonsDir, `${dashed}.json`);
  if (!pack || !existsSync(pack)) record("originality", [`no source pack for ${item}: run node scripts/notes/build-source-pack.mjs ${item}`]);
  else if (!existsSync(lessonFile)) record("originality", [`no lesson file ${lessonFile}`]);
  else {
    try {
      record("originality", findOverlaps(readJson(lessonFile), readJson(pack)).map((hit) => `${hit.path}: ${hit.words} words shared with ${hit.source}: "${hit.phrase}"`));
    } catch (error) {
      record("originality", [error instanceof Error ? error.message : String(error)]);
    }
  }
}

for (const { name, errors } of results) {
  console.log(`${errors.length ? "FAIL" : "PASS"} ${name}${errors.length ? ` (${errors.length})` : ""}`);
  for (const error of errors) console.log(`  ${error}`);
}
const failed = results.some(({ errors }) => errors.length);
console.log(`${failed ? "FAIL" : "PASS"} ${item}`);
process.exit(failed ? 1 : 0);
