// Server/build-time only: imports katex. Never import this from a client component.
import katex from "katex";
import { parseInline } from "./inline";
import { INTERACTIVE_IDS, type Block, type CheckBlock, type GlossaryTerm, type ItemsFile, type Lesson } from "./types";

type Ctx = { items: ItemsFile; glossary: GlossaryTerm[]; lessonItems: Set<string> };
type Piece = { path: string; text: string; hl?: true };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function checkPieces(check: CheckBlock, path: string): Piece[] {
  return [
    { path, text: check.prompt },
    ...(check.hint ? [{ path, text: check.hint }] : []),
    ...(check.options ?? []).map((option) => ({ path, text: option.text })),
    { path, text: check.explain },
  ];
}

function blockPieces(block: Block, path: string): Piece[] {
  switch (block.type) {
    case "text": case "examTip": case "mistake": case "fact": return [{ path, text: block.text }];
    case "hlNote": return [{ path, text: block.text, hl: true }];
    case "definition": return [{ path, text: block.statement }, { path, text: block.plain }];
    case "result": return [{ path, text: block.statement }, { path, text: block.why }];
    case "example": return [{ path, text: block.question }, ...block.steps.map((text) => ({ path, text })), { path, text: block.answer }, ...(block.check ? checkPieces(block.check, path) : [])];
    case "check": return checkPieces(block, path);
    default: return [];
  }
}

export function validateLesson(lesson: Lesson, ctx: Ctx): string[] {
  const errors: string[] = [];
  const fail = (path: string, text: string) => errors.push(`${lesson.item} ${path}: ${text}`.replace(/ : /, ": "));
  const item = ctx.items.items.find((entry) => entry.item === lesson.item);
  const glossary = new Set(ctx.glossary.map((term) => term.id));
  const levelOf = new Map(ctx.items.items.map((entry) => [entry.item, entry.level]));
  const bulletItem = new Map(ctx.items.items.flatMap((entry) => entry.bullets.map((bullet) => [bullet.id, entry] as const)));

  if (!item) fail("", "item not in items.json");
  else {
    if (item.level !== lesson.level) fail("level", `${lesson.level} disagrees with items.json (${item.level})`);
    if (item.topic !== lesson.topic) fail("topic", `${lesson.topic} disagrees with items.json (${item.topic})`);
  }
  for (const prerequisite of lesson.prerequisites) if (!levelOf.has(prerequisite)) fail("prerequisites", `unknown item ${prerequisite}`);

  const goalBullets = new Set(lesson.goals.flatMap((goal) => goal.bullets));
  lesson.goals.forEach((goal, g) => goal.bullets.forEach((id) => {
    const owner = bulletItem.get(id);
    if (!owner) fail(`goals[${g}]`, `unknown bullet ${id}`);
    else if (lesson.level === "SL" && owner.level === "AHL") fail(`goals[${g}]`, `SL lesson names AHL bullet ${id}`);
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
    if (check.options) {
      if (check.options.length < 2 || check.options.filter((option) => option.correct).length !== 1) fail(path, "options need at least 2 entries and exactly one correct");
    } else if (!check.answer || !Number.isFinite(check.answer.value) || !(check.answer.tolerance >= 0)) fail(path, "check needs options or a numeric answer with tolerance");
  };
  lesson.before.forEach((check, b) => checkShape(check, `before[${b}]`));

  lesson.sections.forEach((section, s) => section.blocks.forEach((block, b) => {
    const path = `sections[${s}].blocks[${b}]`;
    pieces.push(...blockPieces(block, path));
    if (block.type === "check") checkShape(block, path);
    if (block.type === "example") {
      claim(block.id, path);
      if (block.check) checkShape(block.check, path);
    }
    if (block.type === "formula") {
      texes.push({ path, tex: block.tex });
      if (block.tag === "booklet" && !(block.bookletId && bookletOk.has(block.bookletId))) fail(path, `booklet formula needs a bookletId from items.json (got ${block.bookletId ?? "none"})`);
      if (block.tag === "learn" && block.bookletId) fail(path, "learn formula must not have a bookletId");
    }
    if (block.type === "interactive" && !(INTERACTIVE_IDS as readonly string[]).includes(block.widget)) fail(path, `unknown interactive ${block.widget}`);
    if (block.type === "hlNote" && !ctx.lessonItems.has(block.lesson)) fail(path, `hlNote links to unknown lesson ${block.lesson}`);
  }));

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
      else if (node.kind === "term" && !glossary.has(node.id)) fail(piece.path, `unknown glossary term ${node.id}`);
      else if (node.kind === "lesson") {
        if (!ctx.lessonItems.has(node.item)) fail(piece.path, `unknown lesson link ${node.item}`);
        else if (lesson.level === "SL" && levelOf.get(node.item) === "AHL" && !piece.hl) fail(piece.path, `SL lesson links to AHL lesson ${node.item} outside an hlNote`);
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
