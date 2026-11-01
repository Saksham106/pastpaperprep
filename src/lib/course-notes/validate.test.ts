import { describe, expect, it } from "vitest";
import { glossaryFixture, lessonFixture } from "./__fixtures__/lesson";
import { itemsFixture } from "./__fixtures__/items";
import type { Block, CheckBlock, Lesson } from "./types";
import { validateLesson } from "./validate";

const ctx = { items: itemsFixture, glossary: glossaryFixture, lessonItems: new Set(["2.5", "2.13"]) };
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
    expect(withBlock({ type: "check", id: "e1", prompt: "p", answer: { value: 1, tolerance: 0 }, explain: "x" })).toEqual([expect.stringContaining("duplicate id e1")]);
    const lesson = clone();
    lesson.before[0].id = "c1";
    expect(run(lesson)).toEqual([expect.stringContaining("duplicate id c1")]);
  });

  it("reports a check with neither options nor a numeric answer", () => {
    expect(withBlock({ type: "check", id: "c2", prompt: "p", explain: "x" })).toEqual([expect.stringContaining("needs options or a numeric answer")]);
  });

  it("rejects unknown interactive widgets", () => {
    const bad = { type: "interactive", widget: "nope", props: {}, alt: "a" } as unknown as Block;
    expect(withBlock(bad)).toEqual([expect.stringContaining("unknown interactive nope")]);
    expect(withBlock({ type: "interactive", widget: "parts-area", props: {}, alt: "a" })).toEqual([]);
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
    const one: CheckBlock = { type: "check", id: "m1", prompt: "p", explain: "x", options: [{ text: "a", correct: true }] };
    expect(withBlock(one)).toEqual([expect.stringContaining(msg)]);
    const none = { ...one, options: [{ text: "a", correct: false }, { text: "b", correct: false }] };
    expect(withBlock(none)).toEqual([expect.stringContaining(msg)]);
    const two = { ...one, options: [{ text: "a", correct: true }, { text: "b", correct: true }] };
    expect(withBlock(two)).toEqual([expect.stringContaining(msg)]);
  });

  it("requires a finite numeric value and non-negative tolerance", () => {
    const msg = "check needs options or a numeric answer with tolerance";
    const base: CheckBlock = { type: "check", id: "n1", prompt: "p", explain: "x" };
    expect(withBlock({ ...base, answer: { value: Number.NaN, tolerance: 0 } })).toEqual([expect.stringContaining(msg)]);
    expect(withBlock({ ...base, answer: { value: 1, tolerance: -1 } })).toEqual([expect.stringContaining(msg)]);
  });

  it("surfaces malformed markup with its location", () => {
    const lesson = clone();
    blocks(lesson)[0] = { type: "text", text: "A [[Discriminant|x]] and {{lesson:5}}" };
    expect(run(lesson)).toEqual([expect.stringMatching(/^2\.5 sections\[0\]\.blocks\[0\]: Malformed markup near "\[\[Discriminant/)]);
  });
});
