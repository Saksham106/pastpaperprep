// Originality check for a course-notes lesson against its private source pack.
//
//   node scripts/notes/originality.mjs <lesson.json> <pack.json>
//
// Flags every run of RUN_LENGTH (8) or more consecutive words that a lesson string shares with the pack's guide
// text, booklet labels, or bank question text / mark schemes / marked steps / explanation mistakes.
// Words are compared as lowercase word tokens. Maths is ignored: `$…$` spans are dropped, and so are pure-maths
// tokens (numbers, single-letter variables other than the word "a", and function names such as sin or ln).
// "a" is kept as a word. Glossary markup `[[id|label]]` counts as its label; lesson links count as nothing.
// Exit 0: no shared run. Exit 1: at least one shared run (printed). Exit 2: usage or file error.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RUN_LENGTH = 8;

const MATH_WORDS = new Set([
  "sin", "cos", "tan", "sec", "csc", "cosec", "cot", "arcsin", "arccos", "arctan", "ln", "log", "exp", "lim", "dx", "dy", "dt", "du", "dv", "dθ",
  "cis", "max", "min", "mod", "arg", "re", "im", "det", "var", "sd", "mathrm", "frac", "dfrac", "tfrac", "sqrt", "int", "sum", "infty",
]);

/** Lowercase word tokens of prose, with maths and markup removed. */
export function words(text) {
  const prose = String(text)
    .replace(/\\\$/g, " ")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\[\[[a-z0-9-]+\|([^\]|]+)\]\]/g, " $1 ")
    .replace(/\{\{lesson:[^}]*\}\}/g, " ")
    .replace(/\b[MARNBE]\d+\b|\bAG\b/g, " ") // mark codes such as M1, A1, AG
    .toLowerCase()
    .replace(/[’‘`]/g, "'");
  return (prose.match(/[a-zα-ωθ][a-zα-ωθ']*/g) ?? [])
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token && (token.length > 1 || token === "a") && !MATH_WORDS.has(token));
}

/** Every string in a value, with its JSON path. */
function strings(value, path = "") {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((entry, i) => strings(entry, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, entry]) => strings(entry, path ? `${path}.${key}` : key));
  return [];
}

/** The pack text a lesson must not reuse, labelled by where it came from. */
export function packSources(pack) {
  const sources = [];
  const add = (label, text) => {
    if (text) sources.push({ label, text: String(text) });
  };
  for (const key of ["content", "guidance"]) (pack.guide?.[key] ?? []).forEach((line, i) => add(`guide.${key}[${i}]`, line));
  add("guide.notes", pack.guide?.notes);
  for (const entry of [...(pack.booklet?.entries ?? []), ...(pack.booklet?.priorLearning ?? [])]) add(`booklet ${entry.id}`, entry.label);
  for (const [level, block] of Object.entries(pack.questions ?? {})) {
    for (const question of block?.questions ?? []) {
      add(`${level} ${question.id} text`, question.text);
      add(`${level} ${question.id} mark scheme`, question.markScheme);
      for (const part of question.markedSteps ?? []) {
        part.steps.forEach((step, i) => add(`${level} ${question.id} (${part.part}) step ${i + 1}`, step));
        add(`${level} ${question.id} (${part.part}) answer`, part.answer);
      }
    }
  }
  (pack.mistakes?.entries ?? []).forEach((entry, i) => add(`mistakes[${i}] (${entry.from?.[0] ?? "?"})`, entry.text));
  return sources;
}

/** Shared runs of at least `n` words between the lesson's strings and the pack's text, merged to maximal runs. */
export function findOverlaps(lesson, pack, n = RUN_LENGTH) {
  const index = new Map();
  for (const source of packSources(pack)) {
    const tokens = words(source.text);
    for (let i = 0; i + n <= tokens.length; i++) {
      const key = tokens.slice(i, i + n).join(" ");
      if (!index.has(key)) index.set(key, source.label);
    }
  }
  const hits = [];
  for (const { path, text } of strings(lesson)) {
    const tokens = words(text);
    let i = 0;
    while (i + n <= tokens.length) {
      const source = index.get(tokens.slice(i, i + n).join(" "));
      if (!source) {
        i++;
        continue;
      }
      let end = i + n;
      while (end < tokens.length && index.has(tokens.slice(end - n + 1, end + 1).join(" "))) end++;
      hits.push({ path, source, words: end - i, phrase: tokens.slice(i, end).join(" ") });
      i = end;
    }
  }
  return hits;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [lessonFile, packFile] = process.argv.slice(2);
  if (!lessonFile || !packFile) {
    console.error("Usage: node scripts/notes/originality.mjs <lesson.json> <pack.json>");
    process.exit(2);
  }
  let lesson, pack;
  try {
    lesson = JSON.parse(readFileSync(lessonFile, "utf8"));
    pack = JSON.parse(readFileSync(packFile, "utf8"));
  } catch (error) {
    console.error(`originality: ${error instanceof Error ? error.message : error}`);
    process.exit(2);
  }
  const hits = findOverlaps(lesson, pack);
  for (const hit of hits) console.log(`HIT ${hit.path}: ${hit.words} words shared with ${hit.source}: "${hit.phrase}"`);
  console.log(hits.length ? `${hits.length} shared run(s) of ${RUN_LENGTH}+ words: rewrite them in your own words.` : `OK: no run of ${RUN_LENGTH}+ words shared with the source pack.`);
  process.exit(hits.length ? 1 : 0);
}
