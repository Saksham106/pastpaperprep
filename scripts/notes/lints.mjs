// Deterministic lints for one course-notes lesson, run by scripts/notes/validate-lesson.mjs. Each returns a list of
// error strings (empty when the lesson passes); none reads files, so they are unit-tested directly (lints.test.ts).
//
//   glossaryFirstUseErrors   the first prose use of each glossary-plan term the lesson owns or uses is inside [[id|…]]
//   glossaryOwnershipErrors  glossary/<item>.json holds only terms the plan gives to this item
//   readingMinutes           prose words / 150 + 1 per worked example, rounded (a $maths$ span is one word)
//   duplicateCheatSheetErrors the same formula TeX or fact text is not flagged for the cheat sheet twice
//   numberSetErrors          no example or check shares 3+ distinctive numbers with one part of a source-pack question

// ------------------------------------------------------------------------------------------------ inline text

/** Inline text as tokens: { kind: "text" | "math" | "term" | "lesson", value, id? }. `\$` is a literal dollar. */
export function tokens(text) {
  const out = [];
  const pattern = /\\\$|\$(?:[^$\\]|\\.)*\$|\[\[([a-z0-9-]+)\|([^\]|]+)\]\]|\{\{lesson:([^}]*)\}\}/g;
  let last = 0;
  for (const match of String(text).matchAll(pattern)) {
    if (match.index > last) out.push({ kind: "text", value: text.slice(last, match.index) });
    if (match[0] === "\\$") out.push({ kind: "text", value: "$" });
    else if (match[0].startsWith("$")) out.push({ kind: "math", value: match[0].slice(1, -1) });
    else if (match[1]) out.push({ kind: "term", id: match[1], value: match[2] });
    else out.push({ kind: "lesson", value: match[3] });
    last = match.index + match[0].length;
  }
  if (last < String(text).length) out.push({ kind: "text", value: String(text).slice(last) });
  return out;
}

const checkProse = (check, path) => [
  { path: `${path}.prompt`, text: check.prompt },
  { path: `${path}.hint`, text: check.hint },
  { path: `${path}.explain`, text: check.explain },
];

/**
 * Prose a student reads, in page order, with JSON paths. Options (no markup allowed), formulas, calculator keystrokes,
 * headings and alt text are left out. A definition's `term` is marked `defines`.
 */
export function proseInOrder(lesson) {
  const out = [{ path: "summary", text: lesson.summary }, ...lesson.goals.map((goal, g) => ({ path: `goals[${g}]`, text: goal.text }))];
  lesson.before.forEach((check, c) => out.push(...checkProse(check, `before[${c}]`)));
  lesson.sections.forEach((section, s) =>
    section.blocks.forEach((block, b) => {
      const path = `sections[${s}].blocks[${b}]`;
      switch (block.type) {
        case "text": case "hlNote": case "examTip": case "mistake": case "fact": out.push({ path, text: block.text }); break;
        case "definition": out.push({ path: `${path}.term`, text: block.term, defines: true }, { path: `${path}.statement`, text: block.statement }, { path: `${path}.plain`, text: block.plain }); break;
        case "result": out.push({ path: `${path}.statement`, text: block.statement }, { path: `${path}.why`, text: block.why }); break;
        case "figure": if (block.caption) out.push({ path: `${path}.caption`, text: block.caption }); break;
        case "example":
          out.push({ path: `${path}.question`, text: block.question }, ...block.steps.map((text, i) => ({ path: `${path}.steps[${i}]`, text })), { path: `${path}.answer`, text: block.answer });
          if (block.check) out.push(...checkProse(block.check, `${path}.check`));
          break;
        case "check": out.push(...checkProse(block, path)); break;
        default: break;
      }
    }),
  );
  lesson.mistakes.forEach((text, i) => out.push({ path: `mistakes[${i}]`, text }));
  lesson.examTips.forEach((text, i) => out.push({ path: `examTips[${i}]`, text }));
  return out.filter((piece) => piece.text);
}

// ------------------------------------------------------------------------------------------------ glossary

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The term as whole words, any case, with an optional plural on the last word. */
const termPattern = (term) => {
  const words = term.trim().split(/\s+/).map(escape);
  words[words.length - 1] += "(?:s|es)?";
  return new RegExp(`(?<![A-Za-z])${words.join("\\s+")}(?![A-Za-z])`, "i");
};
const blank = (text, pattern) => text.replace(new RegExp(pattern.source, "gi"), (hit) => " ".repeat(hit.length));

/** Plan entries the lesson owns or uses. */
export const planTermsFor = (plan, item) => plan.filter((entry) => entry.owner === item || (entry.users ?? []).includes(item));

/**
 * For each glossary-plan term the lesson owns or uses, its first prose occurrence must be underlined: a [[id|…]] link
 * to that term (with any label) must come before any plain use of the words. Uses inside a longer plan term ("factor"
 * inside "highest common factor") are not uses of the shorter one. A definition block naming the term counts as its
 * first use.
 */
export function glossaryFirstUseErrors(lesson, plan) {
  const prose = proseInOrder(lesson);
  const errors = [];
  for (const entry of planTermsFor(plan, lesson.item)) {
    const own = termPattern(entry.term);
    const longer = plan.filter((other) => other.id !== entry.id && other.term.length > entry.term.length && own.test(other.term)).map((other) => termPattern(other.term));
    const plain = (text) => longer.reduce((acc, pattern) => blank(acc, pattern), text);
    let verdict = null;
    for (const piece of prose) {
      for (const token of tokens(piece.text)) {
        if (token.kind === "term" && token.id === entry.id) verdict = "ok";
        else if ((token.kind === "text" || token.kind === "term") && own.test(plain(token.value))) verdict = piece.defines ? "ok" : piece.path;
        if (verdict) break;
      }
      if (verdict) break;
    }
    if (verdict && verdict !== "ok") errors.push(`first use of the glossary term "${entry.term}" (${verdict}) is not underlined: write [[${entry.id}|…]] there`);
  }
  return errors;
}

/** Every entry in glossary/<item>.json is a term the plan gives to this item, filed under that item. */
export function glossaryOwnershipErrors(entries, plan, item) {
  const byId = new Map(plan.map((entry) => [entry.id, entry]));
  return entries.flatMap((entry) => {
    const planned = byId.get(entry.id);
    if (!planned) return [`glossary term ${entry.id} is not in the glossary plan; use a planned id or ask for it to be added`];
    if (planned.owner !== item) return [`glossary term ${entry.id} belongs to ${planned.owner} in the glossary plan, not ${item}: link to it, don't define it here`];
    if (entry.lesson !== item) return [`glossary term ${entry.id} must name its owner lesson ${item} (it says ${entry.lesson})`];
    return [];
  });
}

// ------------------------------------------------------------------------------------------------ reading time

/** Words a student reads in a string: plain words, one per $maths$ span, a glossary label's words, one per lesson link. */
export function wordCount(text) {
  return tokens(text).reduce((sum, token) => {
    if (token.kind === "math" || token.kind === "lesson") return sum + 1;
    return sum + (token.value.match(/[A-Za-z0-9][A-Za-z0-9'’.,%-]*/g) ?? []).length;
  }, 0);
}

/**
 * Computed reading time: every word shown on the page (summary, goals, checks and their options, headings, blocks,
 * one calculator model's keystrokes, mistakes, tips) / 150, plus 1 minute per worked example, rounded.
 * `calculatorSteps(block)` returns a calculator block's steps per model (snippets resolved); the first model counts.
 */
export function readingMinutes(lesson, calculatorSteps = (block) => block.steps ?? {}) {
  const strings = [lesson.summary, ...lesson.goals.map((goal) => goal.text)];
  const check = (c) => strings.push(c.prompt, c.hint, c.explain, ...(c.options ?? []).map((option) => option.text));
  lesson.before.forEach(check);
  let examples = 0;
  for (const section of lesson.sections) {
    strings.push(section.heading);
    for (const block of section.blocks) {
      switch (block.type) {
        case "text": case "hlNote": case "examTip": case "mistake": case "fact": strings.push(block.text); break;
        case "definition": strings.push(block.term, block.statement, block.plain); break;
        case "result": strings.push(block.statement, block.why); break;
        case "formula": strings.push("$x$"); break;
        case "figure": strings.push(block.caption ?? ""); break;
        case "example": examples++; strings.push(block.question, ...block.steps, block.answer); if (block.check) check(block.check); break;
        case "check": check(block); break;
        case "calculator": strings.push(...(Object.values(calculatorSteps(block) ?? {})[0] ?? [])); break;
        default: break;
      }
    }
  }
  strings.push(...lesson.mistakes, ...lesson.examTips);
  const words = strings.filter(Boolean).reduce((sum, text) => sum + wordCount(text), 0);
  return { words, examples, minutes: Math.round(words / 150 + examples) };
}

// ------------------------------------------------------------------------------------------------ cheat sheet

/** The same formula TeX or fact text flagged for the cheat sheet twice in one lesson (whitespace ignored). */
export function duplicateCheatSheetErrors(lesson) {
  const seen = new Map();
  const errors = [];
  lesson.sections.forEach((section, s) =>
    section.blocks.forEach((block, b) => {
      const key = block.type === "formula" && block.cheatSheet ? `formula ${block.tex}` : block.type === "fact" ? `fact ${block.text}` : null;
      if (!key) return;
      const path = `sections[${s}].blocks[${b}]`;
      const normal = key.replace(/\s+/g, "");
      if (seen.has(normal)) errors.push(`${path} flags the same ${key.split(" ")[0]} for the cheat sheet as ${seen.get(normal)}: flag it once`);
      else seen.set(normal, path);
    }),
  );
  return errors;
}

// ------------------------------------------------------------------------------------------------ number sets

const SUPERSCRIPT = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const IGNORED = new Set(["0", "1", "2", "10", "100", "1000"]);
export const NUMBER_SET_SIZE = 3;

/** The distinctive numbers in a question: 0, 1, 2, 10, 100, 1000 and years (1900-2099) are ignored. */
export function questionNumbers(text) {
  const cleaned = String(text)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^${[...run].map((ch) => SUPERSCRIPT[ch]).join("")} `)
    .replace(/\[Maximum mark:\s*\d+\]|\[\d+\]/gi, " ") // mark allocations in pack questions
    .replace(/^\s*\d+\s*[.)]\s/, " ") // the question number
    .replace(/\{,\}/g, "")
    .replace(/(?<=\d),(?=\d{3}(?!\d))/g, "");
  const numbers = new Set();
  for (const match of cleaned.matchAll(/(?<![\d.])\d+(?:\.\d+)?/g)) {
    const value = String(Number(match[0]));
    const year = /^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 2099;
    if (!IGNORED.has(value) && !year) numbers.add(value);
  }
  return numbers;
}

/**
 * A pack question as blocks: its stem joined with each lettered or roman part (the stem holds the set-up), so numbers
 * spread across the parts of a long question don't add up.
 */
export function questionParts(text) {
  const pieces = String(text ?? "").split(/(?=\((?:[a-h]|i{1,3}|iv|v|vi)\)\s)/).filter((piece) => piece.trim());
  if (pieces.length < 2) return pieces;
  const [first, ...rest] = pieces;
  return /^\s*\(/.test(first) ? pieces : rest.map((part) => `${first} ${part}`);
}

const packQuestions = (pack) => {
  const questions = pack?.questions;
  if (Array.isArray(questions)) return questions.map((question) => ({ ...question, tier: "" }));
  return Object.entries(questions ?? {}).flatMap(([tier, block]) => (Array.isArray(block?.questions) ? block.questions.map((question) => ({ ...question, tier })) : []));
};

/**
 * An example or check whose question shares 3 or more distinctive numbers with one block of a pack question (its stem
 * with one part) reuses that question's set-up: fail, naming both. Each lesson block's question (an example's question, a
 * check's prompt) is compared on its own. At least one shared number must be more than a single digit (11, 0.3, 24):
 * three of 3-9 alone are everywhere in maths questions and are not a set-up.
 */
export function numberSetErrors(lesson, pack) {
  const blocks = [];
  const addCheck = (check, path) => blocks.push({ id: check.id, path, text: check.prompt });
  lesson.before.forEach((check, c) => addCheck(check, `before[${c}]`));
  lesson.sections.forEach((section, s) =>
    section.blocks.forEach((block, b) => {
      const path = `sections[${s}].blocks[${b}]`;
      if (block.type === "example") {
        blocks.push({ id: block.id, path, text: block.question });
        if (block.check) addCheck(block.check, `${path}.check`);
      } else if (block.type === "check") addCheck(block, path);
    }),
  );
  const questions = packQuestions(pack).map((question) => ({ ...question, parts: questionParts(question.text).map(questionNumbers) }));
  const errors = [];
  for (const block of blocks) {
    const mine = questionNumbers(block.text);
    if (mine.size < NUMBER_SET_SIZE) continue;
    for (const question of questions) {
      const shared = question.parts.map((part) => [...mine].filter((number) => part.has(number))).find((common) => common.length >= NUMBER_SET_SIZE && common.some((number) => !/^[3-9]$/.test(number)));
      if (shared) errors.push(`${block.id} (${block.path}) shares the numbers ${shared.join(", ")} with pack question ${question.id}${question.tier ? ` (${question.tier})` : ""}: change the set-up`);
    }
  }
  return errors;
}
