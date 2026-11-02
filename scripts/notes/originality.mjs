// Originality check for a course-notes lesson against its private source pack.
//
//   node scripts/notes/originality.mjs <lesson.json> <pack.json>
//
// Flags every run of RUN_LENGTH (8) or more consecutive words that a lesson string shares with the pack's guide
// text, booklet labels, or bank question text / mark schemes / marked steps / explanation mistakes.
// Words are compared as lowercase word tokens. Maths is ignored: `$…$` spans are dropped, and so are pure-maths
// tokens (numbers, single-letter variables other than the word "a", and function names such as sin or ln).
// "a" is kept as a word. Glossary markup `[[id|label]]` counts as its label; lesson links count as nothing.
// Stock IB exam phrases (STOCK_PHRASES) are cut out of both sides first, so a lesson may use the standard wording.
// Arrays of strings (example steps, calculator steps) are also checked joined, so a run split across steps is caught.
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

/** Standard IB question wording a lesson may reuse: removed from both sides before comparing. */
export const STOCK_PHRASES = [
  "give your answer correct to three significant figures",
  "give your answer correct to significant figures",
  "give your answer correct to one decimal place",
  "find the equation of the tangent to the curve at the point",
  "find the equation of the normal to the curve at the point",
  "find the equation of the tangent to the graph of at the point",
  "find the equation of the normal to the graph of at the point",
  "find the area of the region enclosed by the curve",
  "find the area of the region enclosed by the graph of",
  "find the coordinates of the point of intersection of",
  "use mathematical induction to prove that for all",
  "the volume of the solid formed when the region is rotated through about the x-axis",
  "write down the value of",
  "show that the equation has no real solutions",
  "find the probability that",
].map((phrase) => words(phrase));

/** Token runs of a text with stock phrases cut out (each run is matched separately). */
export function segments(text) {
  const tokens = words(text);
  const runs = [];
  let start = 0;
  for (let i = 0; i < tokens.length; ) {
    const stock = STOCK_PHRASES.filter((phrase) => phrase.length && phrase.every((token, k) => tokens[i + k] === token)).sort((a, b) => b.length - a.length)[0];
    if (stock) {
      runs.push(tokens.slice(start, i));
      i += stock.length;
      start = i;
    } else i++;
  }
  runs.push(tokens.slice(start));
  return runs.filter((run) => run.length);
}

/** Every string in a value, with its JSON path, plus each array of strings joined (marked `joined`). */
function strings(value, path = "") {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) {
    const own = value.flatMap((entry, i) => strings(entry, `${path}[${i}]`));
    const texts = value.filter((entry) => typeof entry === "string");
    return texts.length > 1 ? [...own, { path: `${path} (joined)`, text: texts.join(" "), parts: texts }] : own;
  }
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
    for (const tokens of segments(source.text)) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const key = tokens.slice(i, i + n).join(" ");
        if (!index.has(key)) index.set(key, source.label);
      }
    }
  }
  const hits = [];
  for (const { path, text, parts } of strings(lesson)) {
    // A joined array only reports runs that no single element already holds.
    const singles = parts ? parts.flatMap((part) => segments(part).map((run) => ` ${run.join(" ")} `)) : [];
    for (const tokens of segments(text)) {
      let i = 0;
      while (i + n <= tokens.length) {
        const source = index.get(tokens.slice(i, i + n).join(" "));
        if (!source) {
          i++;
          continue;
        }
        let end = i + n;
        while (end < tokens.length && index.has(tokens.slice(end - n + 1, end + 1).join(" "))) end++;
        const phrase = tokens.slice(i, end).join(" ");
        if (!singles.some((single) => single.includes(` ${phrase} `))) hits.push({ path, source, words: end - i, phrase });
        i = end;
      }
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
