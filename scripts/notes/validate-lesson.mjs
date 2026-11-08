// One-lesson gate for writers: everything the batch checks for a single lesson, read straight from files.
//
//   node scripts/notes/validate-lesson.mjs [--course <slug>] [--fix] <item>   (e.g. 5.16 or 5-16; default course ib-math-aa)
//
// --fix first rewrites the lesson file's mechanical parts, then checks it: readingMinutes set to the computed value, and
// each plain first use of a planned glossary term wrapped in [[id|…]]. Everything else is still the writer's to fix.
//
// Runs, for that lesson only:
//   validator    validateLesson (src/lib/course-notes/validate.ts, loaded through tsx, KaTeX in Node as in vitest)
//                with items.json, every glossary/<item>.json merged, and every syllabus item as a link target
//                (the same context content.test.ts uses, so links to lessons not yet written still pass).
//                Plus the per-lesson parts of content.test.ts: file name matches item, figure SVGs exist and are
//                safe, glossary entries point at real items, slug unique in the topic, no prerequisite cycle.
//   check-math   scripts/notes/check-math.py <item> with the SymPy venv (AA_NOTES_PYTHON or ../research venv)
//   originality  scripts/notes/originality.mjs against ../research/<gate.packs>/<item>.json (AA: aa-course-notes/packs),
//                plus number sets: no example or check reuses 3+ distinctive numbers from one part of a pack question
//   lints        scripts/notes/lints.mjs: reading time (computed value printed; must match readingMinutes +/- 1; --fix sets it),
//                no formula or fact flagged for the cheat sheet twice, and, when the course has a glossary plan
//                (course.json gate.glossaryPlan), first use of each planned term underlined and glossary/<item>.json
//                holding only terms the plan gives this item. course.json gate.exempt switches lints off (AA predates them).
// It never touches the generated index, the receipts or any shared file, so parallel writers can run it safely.
// AA_NOTES_LESSONS_DIR / AA_NOTES_SIDECARS_DIR point at another lessons / sidecars folder (used by the tests).
// Exit 0: every check passed. Exit 1: a check failed. Exit 2: usage error or unknown item.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register as registerCjs } from "tsx/cjs/api";
import { register } from "tsx/esm/api";
import { findResearchDir } from "./build-source-pack.mjs";
import { courseFiles, parseCourseArg } from "./course.mjs";
import { duplicateCheatSheetErrors, fixGlossaryFirstUse, glossaryFirstUseErrors, glossaryOwnershipErrors, numberSetErrors, readingMinutes } from "./lints.mjs";
import { findOverlaps } from "./originality.mjs";

register();
registerCjs(); // the repo is CommonJS by default, so .ts files load through require
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let parsed;
try {
  parsed = parseCourseArg(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
const course = courseFiles(parsed.slug);
const courseRoot = course.root;
const lessonsDir = process.env.AA_NOTES_LESSONS_DIR ? resolve(process.env.AA_NOTES_LESSONS_DIR) : course.lessonsDir;
/** The research folder (sibling of the main checkout): AA's finder first, else any ../research. */
const researchDir = () => findResearchDir() ?? ["../research", "../../../research"].map((rel) => resolve(repoRoot, rel)).find((dir) => existsSync(dir)) ?? null;
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")).sort() : []);
const UNSAFE_SVG = /<script|\son\w+\s*=|javascript:|<foreignObject/i;

const fix = parsed.rest.includes("--fix");
const arg = parsed.rest.find((entry) => entry !== "--fix");
const items = readJson(course.itemsFile);
const item = arg?.replace("-", ".");
if (!item || !items.items.some((entry) => entry.item === item)) {
  console.error(`Usage: node scripts/notes/validate-lesson.mjs [--course <slug>] <item>  (unknown item ${arg ?? "(none)"} in ${parsed.slug})`);
  process.exit(2);
}
const dashed = item.replace(".", "-");
const results = [];
const record = (name, errors, note) => results.push({ name, errors, note });
const exempt = new Set(course.config.gate.exempt ?? []);
const calculatorIds = (course.config.calculators ?? []).map((model) => model.id);
const calculatorFile = join(courseRoot, "calculator.json");
const calculatorSnippets = existsSync(calculatorFile) ? readJson(calculatorFile).snippets ?? {} : {};
const { calculatorSteps } = await import(pathToFileURL(join(repoRoot, "src/lib/course-notes/calculators.ts")).href);
const glossaryPlan = () => {
  const planPath = course.config.gate.glossaryPlan;
  const research = planPath && researchDir();
  const planFile = research && join(research, planPath);
  return planFile && existsSync(planFile) ? readJson(planFile) : null;
};

// 0. --fix: the mechanical parts, written back before anything is checked.
if (fix) {
  const lessonFile = join(lessonsDir, `${dashed}.json`);
  try {
    const lesson = readJson(lessonFile);
    const plan = glossaryPlan();
    const fixes = plan ? fixGlossaryFirstUse(lesson, plan) : [];
    const { minutes } = readingMinutes(lesson, (block) => calculatorSteps(block, calculatorSnippets));
    if (!exempt.has("readingMinutes") && lesson.readingMinutes !== minutes) {
      fixes.push(`readingMinutes ${lesson.readingMinutes} -> ${minutes}`);
      lesson.readingMinutes = minutes;
    }
    if (fixes.length) writeFileSync(lessonFile, `${JSON.stringify(lesson, null, 2)}\n`);
    for (const line of fixes) console.log(`FIXED ${line}`);
  } catch (error) {
    console.log(`FIX skipped: ${error instanceof Error ? error.message : error}`);
  }
}

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
    errors.push(...validateLesson(lesson, { items, glossary, lessonItems, levels: course.config.levels, calculators: calculatorIds, calculatorSnippets }));
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
  const research = researchDir();
  const python = [process.env.AA_NOTES_PYTHON, research && join(research, "aa-course-notes/.venv/bin/python")].find((p) => p && existsSync(p));
  if (!python) record("check-math", ["no SymPy python: set AA_NOTES_PYTHON or create ../research/aa-course-notes/.venv"]);
  else {
    const run = spawnSync(python, [join(repoRoot, "scripts/notes/check-math.py"), "--course", parsed.slug, item], { encoding: "utf8", env: process.env });
    const lines = `${run.stdout}${run.stderr}`.split("\n").filter((line) => line.trim());
    const passed = lines.some((line) => line.startsWith("PASS"));
    record("check-math", run.status === 0 && passed ? [] : lines.filter((line) => !line.startsWith("PASS")).concat(passed ? [] : ["check-math.py printed no PASS line"]));
  }
}

// 3. Originality against the private pack.
{
  const research = researchDir();
  const pack = research && join(research, course.packsDir, `${dashed}.json`);
  const lessonFile = join(lessonsDir, `${dashed}.json`);
  if (!pack || !existsSync(pack)) record("originality", [`no source pack for ${item} at ${pack ?? `../research/${course.packsDir}`}${parsed.slug === "ib-math-aa" ? `: run node scripts/notes/build-source-pack.mjs ${item}` : ""}`]);
  else if (!existsSync(lessonFile)) record("originality", [`no lesson file ${lessonFile}`]);
  else {
    try {
      const lesson = readJson(lessonFile);
      const packJson = readJson(pack);
      const phrases = findOverlaps(lesson, packJson).map((hit) => `${hit.path}: ${hit.words} words shared with ${hit.source}: "${hit.phrase}"`);
      const numbers = exempt.has("numberSets") ? [] : numberSetErrors(lesson, packJson);
      record("originality", [...phrases, ...numbers], exempt.has("numberSets") ? "number sets not enforced for this course" : undefined);
    } catch (error) {
      record("originality", [error instanceof Error ? error.message : String(error)]);
    }
  }
}

// 4. Deterministic lints.
{
  let lesson = null;
  try {
    lesson = readJson(join(lessonsDir, `${dashed}.json`));
  } catch {
    // reported by the validator
  }
  if (lesson) {
    const reading = readingMinutes(lesson, (block) => calculatorSteps(block, calculatorSnippets));
    const off = Math.abs(reading.minutes - lesson.readingMinutes) > 1;
    const readingNote = `computed ${reading.minutes} min (${reading.words} words / 150 + ${reading.examples} example${reading.examples === 1 ? "" : "s"}), lesson says ${lesson.readingMinutes}`;
    if (exempt.has("readingMinutes")) record("reading-time", [], `${readingNote}; not enforced for this course`);
    else record("reading-time", off ? [`readingMinutes is ${lesson.readingMinutes}, but the lesson reads in about ${reading.minutes}: run with --fix to set it`] : [], readingNote);

    record("cheat-sheet", exempt.has("duplicateCheatSheetFlags") ? [] : duplicateCheatSheetErrors(lesson), exempt.has("duplicateCheatSheetFlags") ? "duplicate flags not enforced for this course" : undefined);

    const planPath = course.config.gate.glossaryPlan;
    if (!planPath) record("glossary", [], "no glossary plan for this course: first-use and ownership lints skipped");
    else {
      const research = researchDir();
      const planFile = research && join(research, planPath);
      if (!planFile || !existsSync(planFile)) record("glossary", [`no glossary plan at ${planFile ?? `../research/${planPath}`}`]);
      else {
        const plan = readJson(planFile);
        const ownFile = join(courseRoot, "glossary", `${dashed}.json`);
        const own = existsSync(ownFile) ? readJson(ownFile) : [];
        record("glossary", [...glossaryOwnershipErrors(own, plan, item), ...glossaryFirstUseErrors(lesson, plan)]);
      }
    }
  }
}

for (const { name, errors, note } of results) {
  console.log(`${errors.length ? "FAIL" : "PASS"} ${name}${errors.length ? ` (${errors.length})` : ""}${note ? `: ${note}` : ""}`);
  for (const error of errors) console.log(`  ${error}`);
}
const failed = results.some(({ errors }) => errors.length);
console.log(`${failed ? "FAIL" : "PASS"} ${item}`);
process.exit(failed ? 1 : 0);
