// Server/build-time only: imports katex. Never import this from a client component.
import katex from "katex";
import "katex/contrib/mhchem"; // \ce{} and \pu{} in chemistry lessons, as render.ts loads it
import { AA_CALCULATOR_IDS, calculatorErrors, calculatorSteps } from "./calculators";
import { parseInline } from "./inline";
import { INTERACTIVE_IDS, INTERACTIVE_PROPS, type Block, type CalculatorSnippets, type CheckBlock, type CourseLevels, type GlossaryTerm, type ItemsFile, type Lesson, type Verify } from "./types";

/**
 * `levels` is the course's config: lessons and items store `levels.base` or `levels.extension` (AA: "SL" / "AHL").
 * `calculators` are the course's calculator ids (default AA's ti84 / nspire / casio) and `calculatorSnippets` its
 * calculator.json snippets.
 */
export type ValidationContext = {
  items: ItemsFile;
  glossary: GlossaryTerm[];
  lessonItems: Set<string>;
  levels: Pick<CourseLevels, "base" | "extension">;
  calculators?: readonly string[];
  calculatorSnippets?: CalculatorSnippets;
};
type Piece = { path: string; text: string; hl?: true };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The declarative answer kinds and their options. Mirrors KINDS in scripts/notes/verify_kinds.py (mathparse.test.ts
 * compares the two). `on`: where a kind may be used: "example", "choice" (multiple-choice check), "numeric" (numeric check).
 */
type KindSpec = { required?: string[]; oneOf?: string[]; optional?: string[]; on: ("example" | "choice" | "numeric")[] };
const ANSWER: KindSpec["on"] = ["example", "choice"];
const PRECISION = ["sf", "dp"];
export const VERIFY_KINDS: Record<string, KindSpec> = {
  exact: { optional: ["unit", "signed"], on: ANSWER },
  rounded: { oneOf: PRECISION, optional: ["unit", "signed"], on: ANSWER },
  numeric: { oneOf: PRECISION, optional: ["reading", "maxTolerance", "signed"], on: ["numeric"] },
  list: { optional: PRECISION, on: ANSWER },
  assignments: { on: ANSWER },
  solutions: { optional: PRECISION, on: ANSWER },
  point: { optional: PRECISION, on: ANSWER },
  vector: { on: ANSWER },
  equation: { on: ANSWER },
  inequality: { optional: ["var"], on: ANSWER },
  set: { optional: ["var"], on: ANSWER },
  ratio: { on: ANSWER },
  "standard-form": { optional: ["sf", "unit", "signed"], on: ANSWER },
  money: { optional: ["dp"], on: ANSWER },
  time: { required: ["form"], on: ANSWER },
  bearing: { optional: ["dp"], on: ANSWER },
  angle: { optional: PRECISION, on: ANSWER },
  fraction: { optional: ["simplest", "form"], on: ANSWER },
  expression: { optional: ["form", "scale"], on: ANSWER },
  antiderivative: { optional: ["var"], on: ANSWER },
  choice: { on: ["choice"] },
  // Chemistry: a balanced equation (the truth is the skeleton, balanced by the gate), a formula, and prose marking points.
  "chem-equation": { optional: ["states", "reversible", "allowMultiple", "fractions", "per", "aliases"], on: ANSWER },
  formula: { optional: ["match", "given"], on: ANSWER },
  explanation: { required: ["requires"], optional: ["forbids"], on: ["example"] },
};
export const VERIFY_ENUMS: Record<string, string[]> = {
  "time.form": ["clock", "duration"],
  "fraction.form": ["mixed", "improper"],
  "expression.form": ["factorised", "expanded", "simplified"],
  "formula.match": ["composition", "exact"],
};
export const VERIFY_BOOLEANS = [
  "expression.scale", "fraction.simplest", "exact.signed", "rounded.signed", "numeric.signed", "standard-form.signed",
  "chem-equation.states", "chem-equation.reversible", "chem-equation.allowMultiple", "chem-equation.fractions", "formula.given",
];
/** Options that are lists of phrases; an entry of `requires` may itself be a list of alternatives. */
export const VERIFY_ARRAYS = ["explanation.forbids", "explanation.requires"];
/** The truth helpers that build a formula (verify kind `formula`); formula("...") is the typed-in one. */
const FORMULA_HELPERS = ["empirical_formula", "molecular_formula", "ionic_formula", "formula"];

const phrase = (value: unknown) => typeof value === "string" && value.replace(/[\s$]/g, "") !== "";

const GRAPH_READING = /\b(estimate|from the graph|from your graph|from the curve|read)\b/i;

/**
 * True when a multiple-choice option (with $ removed) is a number, fraction, decimal, percentage, ratio, coordinate or
 * expression, not words. Hybridisation labels (sp, sp2, sp^2, sp^{3}, sp³) are words.
 */
export function numericLookingOption(option: string): boolean {
  const text = option.replace(/\$/g, "").trim();
  if (!text) return false;
  if (/^sp(?:\^?\{?[23]\}?|[²³])?$/.test(text)) return false;
  const words = text.replace(/\\[A-Za-z]+/g, " ");
  if (/[A-Za-z]{3,}/.test(words)) return false;
  return /\d/.test(text) || /\\[A-Za-z]+/.test(text) || /[+*/^=<>%:]/.test(text) || /\S-\S/.test(text);
}

/** Problems with a block's `verify` (kind known, required options present, truth non-empty), where it sits. */
export function verifyErrors(verify: Verify | undefined, on: "example" | "choice" | "numeric"): string[] {
  if (verify === undefined) return [];
  if (!verify || typeof verify !== "object") return ["verify must be an object { kind, truth, ...options }"];
  const spec = VERIFY_KINDS[verify.kind];
  if (!spec) return [`unknown verify kind ${String(verify.kind)} (expected one of ${Object.keys(VERIFY_KINDS).join(", ")})`];
  const errors: string[] = [];
  const { kind } = verify;
  if (typeof verify.truth !== "string" || !verify.truth.trim()) errors.push(`verify ${kind} needs a non-empty truth`);
  if (!spec.on.includes(on)) errors.push(`verify kind ${kind} cannot be used on ${on === "example" ? "an example" : on === "choice" ? "a multiple-choice check" : "a numeric check"} (use ${Object.entries(VERIFY_KINDS).filter(([, entry]) => entry.on.includes(on)).map(([name]) => name).join(", ")})`);
  const allowed = new Set([...(spec.required ?? []), ...(spec.oneOf ?? []), ...(spec.optional ?? [])]);
  const options = Object.keys(verify).filter((key) => key !== "kind" && key !== "truth");
  for (const key of options) if (!allowed.has(key)) errors.push(`verify ${kind} has no option ${key} (allowed: ${[...allowed].join(", ") || "none"})`);
  for (const key of spec.required ?? []) if (!(key in verify)) errors.push(`verify ${kind} needs ${key}`);
  if (spec.oneOf && spec.oneOf.filter((key) => key in verify).length !== 1) errors.push(`verify ${kind} needs exactly one of ${spec.oneOf.join(" / ")}`);
  if ("sf" in verify && "dp" in verify) errors.push(`verify ${kind}: give sf or dp, not both`);
  for (const key of PRECISION) {
    const value = verify[key];
    if (key in verify && !(Number.isInteger(value) && (value as number) >= (key === "sf" ? 1 : 0))) errors.push(`verify ${kind}: ${key} must be a whole number${key === "sf" ? " of at least 1" : ""}`);
  }
  for (const key of options) {
    const name = `${kind}.${key}`;
    if (VERIFY_ENUMS[name] && !VERIFY_ENUMS[name].includes(verify[key] as string)) errors.push(`verify ${name} must be one of ${VERIFY_ENUMS[name].join(", ")}`);
    if (VERIFY_BOOLEANS.includes(name) && typeof verify[key] !== "boolean") errors.push(`verify ${name} must be true or false`);
    if ((key === "unit" || key === "var" || key === "per") && !(typeof verify[key] === "string" && (verify[key] as string).trim())) errors.push(`verify ${name} must be non-empty text`);
    if (VERIFY_ARRAYS.includes(name)) {
      const value = verify[key];
      const alternatives = name === "explanation.requires";
      if (!Array.isArray(value) || !value.length) errors.push(`verify ${name} must be a non-empty list of phrases`);
      else if (!value.every((entry) => (alternatives && Array.isArray(entry) ? entry.length > 0 && entry.every(phrase) : phrase(entry)))) errors.push(`verify ${name}: every entry must be a non-empty phrase${alternatives ? " or a list of alternative phrases" : ""}`);
    }
  }
  if (kind === "explanation" && Array.isArray(verify.requires) && verify.requires.length < 2) errors.push("verify explanation.requires needs at least 2 phrases (the marking points)");
  if (kind === "chem-equation") {
    if (verify.allowMultiple && verify.fractions) errors.push("verify chem-equation: give allowMultiple or fractions, not both");
    if ("per" in verify && verify.fractions !== true) errors.push("verify chem-equation.per needs fractions: true");
    if ("aliases" in verify) {
      const value = verify.aliases as unknown;
      const ok = !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 && Object.values(value as Record<string, unknown>).every((list) => Array.isArray(list) && list.length > 0 && list.every(phrase));
      if (!ok) errors.push('verify chem-equation.aliases must map a formula to a list of other writings, e.g. {"CH3COOH": ["CH3CO2H"]}');
    }
  }
  if (kind === "formula" && typeof verify.truth === "string") {
    const helper = /^\s*([A-Za-z_]+)\s*\(/.exec(verify.truth)?.[1];
    if (!helper || !FORMULA_HELPERS.includes(helper)) errors.push(`verify formula truth must call ${FORMULA_HELPERS.join(", ")}`);
    else if (helper === "formula" && verify.given !== true) errors.push('verify formula: formula("...") types the formula in; use it only for a formula stated in the question, with given: true');
    else if (helper !== "formula" && "given" in verify) errors.push('verify formula.given is only for a formula("...") truth stated in the question');
  }
  if (kind === "numeric" && ("reading" in verify || "maxTolerance" in verify)) {
    if (verify.reading !== true) errors.push("verify numeric.reading must be true");
    if (!(typeof verify.maxTolerance === "number" && verify.maxTolerance > 0)) errors.push("verify numeric.reading needs maxTolerance, a positive number");
  }
  if (kind === "money" && "dp" in verify && verify.dp !== 2 && verify.dp !== 0) errors.push("verify money.dp must be 2 (or 0 for whole amounts)");
  return errors;
}

/** The levels a block may carry. */
const LEVELLED = new Set<Block["type"]>(["text", "formula", "example", "check", "figure", "calculator", "fact"]);
const blockLevel = (block: Block): string | undefined => (LEVELLED.has(block.type) ? (block as { level?: string }).level : undefined);

function checkPieces(check: CheckBlock, path: string): Piece[] {
  return [
    { path, text: check.prompt },
    ...(check.hint ? [{ path, text: check.hint }] : []),
    ...(check.options ?? []).map((option) => ({ path, text: option.text })),
    { path, text: check.explain },
  ];
}

function blockPieces(block: Block, path: string, ctx?: Pick<ValidationContext, "calculatorSnippets">): Piece[] {
  switch (block.type) {
    case "text": case "examTip": case "mistake": case "fact": return [{ path, text: block.text }];
    case "hlNote": return [{ path, text: block.text, hl: true }];
    case "definition": return [{ path, text: block.term }, { path, text: block.statement }, { path, text: block.plain }];
    case "figure": return block.caption ? [{ path, text: block.caption }] : [];
    case "calculator": return Object.values(calculatorSteps(block, ctx?.calculatorSnippets) ?? {}).flat().map((text) => ({ path, text }));
    case "result": return [{ path, text: block.statement }, { path, text: block.why }];
    case "example": return [{ path, text: block.question }, ...block.steps.map((text) => ({ path, text })), { path, text: block.answer }, ...(block.check ? checkPieces(block.check, path) : [])];
    case "check": return checkPieces(block, path);
    default: return [];
  }
}

export function validateLesson(lesson: Lesson, ctx: ValidationContext): string[] {
  const errors: string[] = [];
  const fail = (path: string, text: string) => errors.push(path ? `${lesson.item} ${path}: ${text}` : `${lesson.item}: ${text}`);
  const item = ctx.items.items.find((entry) => entry.item === lesson.item);
  const glossary = new Set(ctx.glossary.map((term) => term.id));
  const levelOf = new Map(ctx.items.items.map((entry) => [entry.item, entry.level]));
  const bulletItem = new Map(ctx.items.items.flatMap((entry) => entry.bullets.map((bullet) => [bullet.id, entry] as const)));
  const { base, extension } = ctx.levels;
  const isBase = lesson.level === base;

  if (lesson.level !== base && lesson.level !== extension) fail("level", `${lesson.level} is not a level of this course (${base} or ${extension})`);
  if (lesson.edition !== ctx.items.edition) fail("edition", `${lesson.edition} disagrees with items.json (${ctx.items.edition})`);
  if (!item) fail("", "item not in items.json");
  else {
    if (item.level !== lesson.level) fail("level", `${lesson.level} disagrees with items.json (${item.level})`);
    if (item.topic !== lesson.topic) fail("topic", `${lesson.topic} disagrees with items.json (${item.topic})`);
  }
  for (const prerequisite of lesson.prerequisites) {
    if (!levelOf.has(prerequisite)) fail("prerequisites", `unknown item ${prerequisite}`);
    else if (isBase && levelOf.get(prerequisite) === extension) fail("prerequisites", `${base} lesson lists ${extension} item ${prerequisite} as a prerequisite`);
  }
  const sectionIds = new Set<string>();
  lesson.sections.forEach((section, s) => {
    if (sectionIds.has(section.id)) fail(`sections[${s}]`, `duplicate section id ${section.id}`);
    sectionIds.add(section.id);
  });

  const goalBullets = new Set(lesson.goals.flatMap((goal) => goal.bullets));
  lesson.goals.forEach((goal, g) => goal.bullets.forEach((id) => {
    const owner = bulletItem.get(id);
    if (!owner) fail(`goals[${g}]`, `unknown bullet ${id}`);
    else if (isBase && owner.level === extension) fail(`goals[${g}]`, `${base} lesson names ${extension} bullet ${id}`);
    else if (owner.item !== lesson.item) fail(`goals[${g}]`, `bullet ${id} belongs to item ${owner.item}`);
  }));
  for (const bullet of item?.bullets ?? []) if (!goalBullets.has(bullet.id)) fail("goals", `bullet ${bullet.id} not covered by any goal`);

  const pieces: Piece[] = [
    { path: "summary", text: lesson.summary },
    ...lesson.goals.map((goal, g) => ({ path: `goals[${g}]`, text: goal.text })),
    ...lesson.before.flatMap((check, b) => checkPieces(check, `before[${b}]`)),
    ...lesson.mistakes.map((text, m) => ({ path: `mistakes[${m}]`, text })),
    ...lesson.examTips.map((text, t) => ({ path: `examTips[${t}]`, text })),
  ];
  const texes: { path: string; tex: string }[] = [];
  const ids = new Set<string>();
  const claim = (id: string, path: string) => {
    if (ids.has(id)) fail(path, `duplicate id ${id}`);
    ids.add(id);
  };
  const bookletOk = new Set([lesson.item, ...lesson.prerequisites].flatMap((code) => ctx.items.items.find((entry) => entry.item === code)?.booklet.map((entry) => entry.id) ?? []));
  const checkShape = (check: CheckBlock, path: string) => {
    claim(check.id, path);
    if (!check.hint?.trim()) fail(path, "check needs a hint");
    if (check.options && check.answer) fail(path, "check has both options and an answer; use one");
    if (check.options) {
      if (check.options.length < 2 || check.options.filter((option) => option.correct).length !== 1) fail(path, "options need at least 2 entries and exactly one correct");
      // Options render inside a <button>, so they may hold only text and maths, never a term or lesson link.
      check.options.forEach((option, o) => {
        let nodes;
        try {
          nodes = parseInline(option.text);
        } catch {
          return; // malformed markup is reported with the other pieces
        }
        if (nodes.some((node) => node.kind === "term" || node.kind === "lesson")) fail(`${path}.options[${o}]`, "option text may contain only plain text and $maths$, no glossary terms or lesson links");
      });
    } else if (!check.answer || !Number.isFinite(check.answer.value) || !(check.answer.tolerance >= 0)) fail(path, "check needs options or a numeric answer with tolerance");
    for (const error of verifyErrors(check.verify, check.options ? "choice" : "numeric")) fail(path, `${check.id}: ${error}`);
    if (check.verify?.kind === "choice" && check.options?.some((option) => numericLookingOption(option.text))) fail(path, `${check.id}: verify kind choice is for word answers only; an option is a number or expression, so use a maths kind (exact, list, solutions, ...) so the distractors are checked mathematically`);
    else if (check.verify?.kind === "choice" && check.options?.some((option) => option.text.includes("$"))) fail(path, `${check.id}: verify kind choice is for word answers only; options with $maths$ need a maths kind (exact, list, solutions, ...) so the distractors are checked mathematically`);
    if (check.verify?.reading === true) {
      if (!GRAPH_READING.test(check.prompt)) fail(path, `${check.id}: verify.reading is for values read from a graph; the prompt must say estimate, from the graph, from your graph, from the curve or read`);
      const cap = check.verify.maxTolerance;
      if (check.answer && typeof cap === "number" && check.answer.tolerance > cap) fail(path, `${check.id}: answer.tolerance ${check.answer.tolerance} is above verify.maxTolerance ${cap}`);
    }
  };
  lesson.before.forEach((check, b) => checkShape(check, `before[${b}]`));

  lesson.sections.forEach((section, s) => section.blocks.forEach((block, b) => {
    const path = `sections[${s}].blocks[${b}]`;
    pieces.push(...blockPieces(block, path, ctx));
    if (block.type === "check") checkShape(block, path);
    if (block.type === "example") {
      claim(block.id, path);
      for (const error of verifyErrors(block.verify, "example")) fail(path, `${block.id}: ${error}`);
      if (block.check) checkShape(block.check, path);
    }
    if (block.type === "calculator") for (const error of calculatorErrors(block, ctx.calculators ?? AA_CALCULATOR_IDS, ctx.calculatorSnippets)) fail(path, error);
    if (block.type === "formula") {
      texes.push({ path, tex: block.tex });
      if (block.tag === "booklet" && !(block.bookletId && bookletOk.has(block.bookletId))) fail(path, `booklet formula needs a bookletId from items.json (got ${block.bookletId ?? "none"})`);
      if (block.tag === "learn" && block.bookletId) fail(path, "learn formula must not have a bookletId");
    }
    if (block.type === "interactive") {
      if (!(INTERACTIVE_IDS as readonly string[]).includes(block.widget)) fail(path, `unknown interactive ${block.widget}`);
      else {
        const spec = INTERACTIVE_PROPS[block.widget];
        for (const [key, value] of Object.entries(block.props ?? {})) {
          const allowed = spec[key];
          if (!allowed) fail(path, `${block.widget} has no prop ${key} (allowed: ${Object.keys(spec).join(", ") || "none"})`);
          else if (typeof allowed[0] === "number") {
            const [min, max] = allowed as readonly [number, number];
            if (typeof value !== "number" || !(value >= min && value <= max)) fail(path, `prop ${key} must be a number from ${min} to ${max}`);
          } else if (!(allowed as readonly string[]).includes(value as string)) fail(path, `prop ${key} must be one of ${allowed.join(", ")}`);
        }
      }
    }
    if ((block.type === "interactive" || block.type === "figure") && block.alt.includes("$")) fail(path, `${block.type} alt must be plain words with no $ (it is the accessible name)`);
    if (block.type === "hlNote" && !ctx.lessonItems.has(block.lesson)) fail(path, `hlNote links to unknown lesson ${block.lesson}`);
  }));

  // Levels inside a lesson: extension content in a base lesson is hidden in the base view.
  const known = (level: string | undefined) => level === undefined || level === base || level === extension;
  lesson.goals.forEach((goal, g) => {
    if (!known(goal.level)) fail(`goals[${g}]`, `level ${goal.level} is not ${base} or ${extension}`);
    else if (!isBase && goal.level === base) fail(`goals[${g}]`, `a ${extension} lesson cannot hold a ${base} goal`);
  });
  lesson.sections.forEach((section, s) => {
    if (!known(section.level)) fail(`sections[${s}]`, `level ${section.level} is not ${base} or ${extension}`);
    else if (!isBase && section.level === base) fail(`sections[${s}]`, `a ${extension} lesson cannot hold a ${base} section`);
    section.blocks.forEach((block, b) => {
      const level = (block as { level?: string }).level;
      if (level === undefined) return;
      const path = `sections[${s}].blocks[${b}]`;
      if (!LEVELLED.has(block.type)) fail(path, `${block.type} blocks take no level (only ${[...LEVELLED].join(", ")})`);
      else if (!known(level)) fail(path, `level ${level} is not ${base} or ${extension}`);
      else if (level === base && (section.level ?? lesson.level) === extension) fail(path, `${base} block inside ${extension} content`);
    });
  });
  lesson.before.forEach((check, c) => {
    if (!known(check.level)) fail(`before[${c}]`, `level ${check.level} is not ${base} or ${extension}`);
    else if (!isBase && check.level === base) fail(`before[${c}]`, `a ${extension} lesson cannot hold a ${base} check`);
  });
  // A bullet is taught at its own level: an extension bullet of a base item by an extension goal and extension
  // content (an extension section or block, or an hlNote); a base bullet by a base goal and base content.
  if (isBase && item) {
    const bulletLevel = new Map(item.bullets.map((bullet) => [bullet.id, bullet.level ?? item.level]));
    item.bullets.forEach((bullet) => {
      if (!known(bullet.level)) fail("goals", `items.json bullet ${bullet.id} has level ${bullet.level}, not ${base} or ${extension}`);
    });
    const effective = lesson.sections.flatMap((section) => section.blocks.map((block) => (block.type === "hlNote" ? extension : blockLevel(block) ?? section.level ?? lesson.level)));
    const hasExtension = effective.includes(extension) || lesson.before.some((check) => check.level === extension);
    const hasBase = effective.includes(base);
    lesson.goals.forEach((goal, g) => {
      const goalLevel = goal.level ?? lesson.level;
      for (const id of goal.bullets) {
        const level = bulletLevel.get(id);
        if (level === extension && goalLevel !== extension) fail(`goals[${g}]`, `bullet ${id} is ${extension}: cover it with a goal marked "level": "${extension}"`);
        if (level === base && goalLevel === extension) fail(`goals[${g}]`, `bullet ${id} is ${base}, but the goal is marked ${extension}`);
      }
    });
    const extensionBullets = item.bullets.filter((bullet) => bulletLevel.get(bullet.id) === extension).map((bullet) => bullet.id);
    if (extensionBullets.length && !hasExtension) fail("sections", `${extension} bullet ${extensionBullets.join(", ")} must be taught in ${extension} content: a section or block with "level": "${extension}", or an hlNote`);
    const baseBullets = item.bullets.filter((bullet) => bulletLevel.get(bullet.id) === base).map((bullet) => bullet.id);
    if (baseBullets.length && !hasBase) fail("sections", `${base} bullet ${baseBullets.join(", ")} must be taught in ${base} content, but every section and block is ${extension}`);
  }

  for (const piece of pieces) {
    let nodes;
    try {
      nodes = parseInline(piece.text);
    } catch (error) {
      fail(piece.path, message(error));
      continue;
    }
    for (const node of nodes) {
      if (node.kind === "math") texes.push({ path: piece.path, tex: node.tex });
      else if (node.kind === "text" && /\\["']/.test(node.value)) fail(piece.path, `stray backslash before a quote: write " not \\"`);
      else if (node.kind === "term" && !glossary.has(node.id)) fail(piece.path, `unknown glossary term ${node.id}`);
      else if (node.kind === "term" && /[$\\]/.test(node.label)) fail(piece.path, `glossary label must be plain words, no maths (${node.label})`);
      else if (node.kind === "lesson") {
        if (!ctx.lessonItems.has(node.item)) fail(piece.path, `unknown lesson link ${node.item}`);
        else if (isBase && levelOf.get(node.item) === extension && !piece.hl) fail(piece.path, `${base} lesson links to ${extension} lesson ${node.item} outside an hlNote`);
      }
    }
  }
  for (const { path, tex } of texes) {
    try {
      katex.renderToString(tex, { throwOnError: true, output: "htmlAndMathml" });
    } catch (error) {
      fail(path, `KaTeX: ${message(error)}`);
    }
  }
  return errors;
}
