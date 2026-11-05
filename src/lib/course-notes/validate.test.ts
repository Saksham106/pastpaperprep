import { describe, expect, it } from "vitest";
import { glossaryFixture, lessonFixture } from "./__fixtures__/lesson";
import { itemsFixture } from "./__fixtures__/items";
import type { Block, CheckBlock, Lesson } from "./types";
import { validateLesson } from "./validate";

const ctx = { items: itemsFixture, glossary: glossaryFixture, lessonItems: new Set(["2.5", "2.13"]), levels: { base: "SL", extension: "AHL" } };
const clone = (): Lesson => structuredClone(lessonFixture);
const blocks = (lesson: Lesson) => lesson.sections[0].blocks;
const run = (lesson: Lesson) => validateLesson(lesson, ctx);
const withBlock = (block: Block) => {
  const lesson = clone();
  blocks(lesson).push(block);
  return run(lesson);
};

describe("validateLesson", () => {
  it("accepts the fixture lesson", () => expect(run(clone())).toEqual([]));

  it("reports KaTeX errors with a locating path", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: "Bad $\\frac{1}$ maths" };
    expect(run(lesson)).toEqual([expect.stringMatching(/^2\.5 sections\[0\]\.blocks\[0\]: KaTeX: /)]);
    const formula = clone();
    blocks(formula)[2] = { type: "formula", tex: "\\badmacro", tag: "learn" };
    expect(run(formula)).toEqual([expect.stringMatching(/blocks\[2\]: KaTeX: /)]);
  });

  it("reports an unclosed dollar", () => {
    const lesson = clone();
    lesson.summary = "costs $5";
    expect(run(lesson)).toEqual([expect.stringContaining("summary: Unclosed")]);
  });

  it("rejects glossary terms and lesson links inside check options, including before[]", () => {
    const option = (text: string) => ({ type: "check", id: "opt-x", prompt: "Pick", hint: "h", options: [{ text, correct: true }, { text: "b", correct: false }], explain: "e" }) as CheckBlock;
    const sections = withBlock(option("[[nope|x]]"));
    expect(sections).toContain("2.5 sections[0].blocks[" + (blocks(clone()).length) + "].options[0]: option text may contain only plain text and $maths$, no glossary terms or lesson links");
    const lesson = clone();
    lesson.before.push({ ...option("see {{lesson:2.13}}"), id: "opt-before" });
    expect(run(lesson)).toContain(`2.5 before[${lesson.before.length - 1}].options[0]: option text may contain only plain text and $maths$, no glossary terms or lesson links`);
    expect(withBlock(option("$x^2$ and plain"))).toEqual([]);
  });

  it("reports an unknown glossary id and an unknown lesson link", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: "[[nope|x]] and {{lesson:9.9}}" };
    expect(run(lesson)).toEqual([expect.stringContaining("unknown glossary term nope"), expect.stringContaining("unknown lesson link 9.9")]);
  });

  it("reports item and level disagreeing with items.json", () => {
    const level = clone();
    level.level = "AHL";
    expect(run(level).some((e) => e.includes("level"))).toBe(true);
    const item = clone();
    item.item = "7.7";
    expect(run(item)[0]).toContain("item not in items.json");
  });

  it("reports a bullet not covered by any goal", () => {
    const lesson = clone();
    lesson.goals[0].bullets = ["2.5.a"];
    expect(run(lesson)).toEqual(["2.5 goals: bullet 2.5.b not covered by any goal"]);
  });

  it("reports an SL lesson naming an AHL bullet", () => {
    const lesson = clone();
    lesson.goals[0].bullets.push("2.13.a");
    expect(run(lesson)).toEqual([expect.stringContaining("SL lesson names AHL bullet 2.13.a")]);
  });

  it("allows an AHL link only inside an hlNote", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: "See {{lesson:2.13}}." };
    expect(run(lesson)).toEqual([expect.stringContaining("outside an hlNote")]);
  });

  it("reports booklet tag and bookletId disagreements", () => {
    expect(withBlock({ type: "formula", tex: "a", tag: "booklet" })).toHaveLength(1);
    expect(withBlock({ type: "formula", tex: "a", tag: "booklet", bookletId: "missing" })).toHaveLength(1);
    expect(withBlock({ type: "formula", tex: "a", tag: "learn", bookletId: "2.5.quadratic-formula" })).toEqual([expect.stringContaining("must not have a bookletId")]);
  });

  it("accepts a booklet formula from a prerequisite item", () => {
    const lesson = clone();
    lesson.item = "2.13";
    lesson.level = "AHL";
    lesson.goals = [{ text: "g", bullets: ["2.13.a"] }];
    lesson.prerequisites = ["2.5"];
    expect(run(lesson)).toEqual([]);
  });

  it("reports duplicate example and check ids", () => {
    expect(withBlock({ type: "check", id: "e1", prompt: "p", hint: "h", answer: { value: 1, tolerance: 0 }, explain: "x" })).toEqual([expect.stringContaining("duplicate id e1")]);
    const lesson = clone();
    lesson.before[0].id = "c1";
    expect(run(lesson)).toEqual([expect.stringContaining("duplicate id c1")]);
  });

  it("reports a check with neither options nor a numeric answer", () => {
    expect(withBlock({ type: "check", id: "c2", prompt: "p", hint: "h", explain: "x" })).toEqual([expect.stringContaining("needs options or a numeric answer")]);
  });

  it("rejects a check with both options and a numeric answer", () => {
    const options = [{ text: "a", correct: true }, { text: "b", correct: false }];
    expect(withBlock({ type: "check", id: "c9", prompt: "p", hint: "h", options, answer: { value: 1, tolerance: 0 }, explain: "x" })).toEqual([expect.stringContaining("both options and an answer")]);
    expect(withBlock({ type: "check", id: "c9", prompt: "p", hint: "h", options, explain: "x" })).toEqual([]);
  });

  it("rejects duplicate section ids within a lesson", () => {
    const lesson = clone();
    lesson.sections.push({ ...structuredClone(lesson.sections[0]), blocks: [] });
    expect(run(lesson)).toEqual([expect.stringContaining(`duplicate section id ${lesson.sections[0].id}`)]);
    lesson.sections[1].id = "another-section";
    expect(run(lesson)).toEqual([]);
  });

  it("rejects an SL lesson with an AHL prerequisite, but allows an AHL lesson to have one", () => {
    const ahl = itemsFixture.items.find((entry) => entry.level === "AHL")!;
    const lesson = clone();
    lesson.prerequisites = [ahl.item];
    expect(run(lesson)).toEqual([expect.stringContaining(`SL lesson lists AHL item ${ahl.item} as a prerequisite`)]);
    lesson.level = "AHL";
    expect(run(lesson).filter((e) => e.includes("prerequisite"))).toEqual([]);
  });

  it("rejects unknown interactive widgets", () => {
    const bad = { type: "interactive", widget: "nope", props: {}, alt: "a" } as unknown as Block;
    expect(withBlock(bad)).toEqual([expect.stringContaining("unknown interactive nope")]);
    expect(withBlock({ type: "interactive", widget: "parts-area", props: {}, alt: "a" })).toEqual([]);
  });

  it("rejects $ in interactive and figure alt text", () => {
    expect(withBlock({ type: "interactive", widget: "parts-area", props: {}, alt: "Curve $v=u^2$" })).toEqual([expect.stringContaining("interactive alt must be plain words")]);
    expect(withBlock({ type: "figure", id: "fig-x", alt: "A $x$ graph" })).toEqual([expect.stringContaining("figure alt must be plain words")]);
    expect(withBlock({ type: "figure", id: "fig-x", alt: "A parabola" })).toEqual([]);
  });

  it("reports a topic mismatch", () => {
    const lesson = clone();
    lesson.topic = 3;
    expect(run(lesson)).toEqual(["2.5 topic: 3 disagrees with items.json (2)"]);
  });

  it("reports an unknown prerequisite", () => {
    const lesson = clone();
    lesson.prerequisites = ["9.9"];
    expect(run(lesson)).toEqual(["2.5 prerequisites: unknown item 9.9"]);
  });

  it("reports an unknown goal bullet", () => {
    const lesson = clone();
    lesson.goals[0].bullets.push("2.5.zzz");
    expect(run(lesson)).toEqual(["2.5 goals[0]: unknown bullet 2.5.zzz"]);
  });

  it("reports a goal bullet belonging to another item", () => {
    const lesson = clone();
    lesson.level = "AHL";
    lesson.goals[0].bullets.push("2.13.a");
    expect(run(lesson).filter((e) => e.includes("belongs to"))).toEqual(["2.5 goals[0]: bullet 2.13.a belongs to item 2.13"]);
  });

  it("reports an unknown hlNote lesson", () => {
    const lesson = clone();
    blocks(lesson)[5] = { type: "hlNote", text: "More later.", lesson: "9.9" };
    expect(run(lesson)).toEqual(["2.5 sections[0].blocks[5]: hlNote links to unknown lesson 9.9"]);
  });

  it("requires at least two options with exactly one correct", () => {
    const msg = "options need at least 2 entries and exactly one correct";
    const one: CheckBlock = { type: "check", id: "m1", prompt: "p", hint: "h", explain: "x", options: [{ text: "a", correct: true }] };
    expect(withBlock(one)).toEqual([expect.stringContaining(msg)]);
    const none = { ...one, options: [{ text: "a", correct: false }, { text: "b", correct: false }] };
    expect(withBlock(none)).toEqual([expect.stringContaining(msg)]);
    const two = { ...one, options: [{ text: "a", correct: true }, { text: "b", correct: true }] };
    expect(withBlock(two)).toEqual([expect.stringContaining(msg)]);
  });

  it("requires a finite numeric value and non-negative tolerance", () => {
    const msg = "check needs options or a numeric answer with tolerance";
    const base: CheckBlock = { type: "check", id: "n1", prompt: "p", hint: "h", explain: "x" };
    expect(withBlock({ ...base, answer: { value: Number.NaN, tolerance: 0 } })).toEqual([expect.stringContaining(msg)]);
    expect(withBlock({ ...base, answer: { value: 1, tolerance: -1 } })).toEqual([expect.stringContaining(msg)]);
  });

  it("surfaces malformed markup with its location", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: "A [[Discriminant|x]] and {{lesson:5}}" };
    expect(run(lesson)).toEqual([expect.stringMatching(/^2\.5 sections\[0\]\.blocks\[0\]: Malformed markup near "\[\[Discriminant/)]);
  });

  it("validates definition terms, figure captions and calculator steps like other inline text", () => {
    expect(withBlock({ type: "definition", term: "Root $\\frac{1}$", statement: "s", plain: "p" })).toEqual([expect.stringMatching(/blocks\[6\]: KaTeX: /)]);
    expect(withBlock({ type: "figure", id: "f", alt: "a triangle", caption: "See [[nope|this]]" })).toEqual([expect.stringContaining("unknown glossary term nope")]);
    expect(withBlock({ type: "calculator", steps: { ti84: ["Costs $5"], nspire: ["ok"], casio: ["ok"] } })).toEqual([expect.stringContaining("Unclosed $")]);
    expect(withBlock({ type: "calculator", steps: { ti84: ["Costs \\$5"], nspire: ["ok"], casio: ["see {{lesson:2.13}}"] } })).toEqual([expect.stringContaining("SL lesson links to AHL lesson 2.13 outside an hlNote")]);
    expect(withBlock({ type: "figure", id: "f", alt: "a triangle", caption: "The [[discriminant|discriminant]] is $\\Delta$." })).toEqual([]);
  });

  it("requires a hint on every check", () => {
    expect(withBlock({ type: "check", id: "nh", prompt: "p", hint: " ", answer: { value: 1, tolerance: 0 }, explain: "x" })).toEqual([expect.stringContaining("check needs a hint")]);
    const lesson = clone();
    delete (lesson.before[0] as Partial<CheckBlock>).hint;
    expect(run(lesson)).toEqual([expect.stringContaining("before[0]: check needs a hint")]);
  });

  it("rejects maths or markup inside a glossary label", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: "The [[discriminant|$\\Delta$]] decides." };
    expect(run(lesson)).toEqual([expect.stringContaining("glossary label must be plain words")]);
  });

  it("rejects a backslash before a quote in prose", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: 'On a \\"find\\" question, show working.' };
    expect(run(lesson)).toEqual([expect.stringContaining("stray backslash before a quote")]);
  });

  it("checks interactive props against the widget's allowed keys and values", () => {
    const widget = (props: Record<string, unknown>) => withBlock({ type: "interactive", widget: "discriminant-roots", props, alt: "a parabola" });
    expect(widget({ a: 1, b: -3, c: 2 })).toEqual([]);
    expect(widget({ d: 1 })).toEqual([expect.stringContaining("discriminant-roots has no prop d")]);
    expect(widget({ a: 9 })).toEqual([expect.stringContaining("prop a must be a number from -3 to 3")]);
    expect(withBlock({ type: "interactive", widget: "riemann-sums", props: { mode: "upper" }, alt: "rectangles" })).toEqual([expect.stringContaining("prop mode must be one of left, right, mid")]);
  });
});
