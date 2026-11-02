import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findOverlaps, RUN_LENGTH, STOCK_PHRASES, words } from "./originality.mjs";

const fixtures = join(process.cwd(), "scripts/notes/__fixtures__");
const load = (name: string) => JSON.parse(readFileSync(join(fixtures, name), "utf8"));
const pack = load("originality-pack.json");
const script = join(process.cwd(), "scripts/notes/originality.mjs");
const run = (lesson: string) => spawnSync(process.execPath, [script, join(fixtures, lesson), join(fixtures, "originality-pack.json")], { encoding: "utf8" });

describe("originality words()", () => {
  it("keeps 'a', drops maths spans, numbers, single-letter variables, maths names and mark codes", () => {
    expect(words("A ball of mass $m$ has x = 2 and sin x (M1) A1 AG")).toEqual(["a", "ball", "of", "mass", "has", "and"]);
  });

  it("reads glossary markup as its label and drops lesson links", () => {
    expect(words("see [[geometric|geometric sequence]] in {{lesson:1.3}} now")).toEqual(["see", "geometric", "sequence", "in", "now"]);
  });
});

describe("originality findOverlaps()", () => {
  it("passes a lesson written in its own words", () => {
    expect(findOverlaps(load("originality-lesson-clean.json"), pack)).toEqual([]);
  });

  it("flags 8+ word runs shared with guide, question text and mistakes, ignoring maths in between", () => {
    const hits = findOverlaps(load("originality-lesson-copied.json"), pack);
    expect(hits.map((hit) => hit.path)).toEqual(["summary", "sections[0].blocks[0].text", "sections[0].blocks[1].text"]);
    expect(hits[0].source).toBe("guide.guidance[0]");
    expect(hits[0].phrase).toBe("that calculator or computer notation is not acceptable in written answers");
    expect(hits[1].source).toMatch(/^SL 2020-may-p1-tz1-q1 text$/);
    expect(hits[1].phrase).toContain("a ball is dropped from a height and bounces to a fraction of its previous height each time");
    expect(hits[2].source).toMatch(/^mistakes\[0\]/);
    for (const hit of hits) expect(hit.words).toBeGreaterThanOrEqual(RUN_LENGTH);
  });

  it("does not flag a 7-word shared run", () => {
    const lesson = { summary: "We know calculator or computer notation is not acceptable. Fine." };
    expect(findOverlaps(lesson, pack)).toEqual([]);
    expect(findOverlaps({ summary: "We know calculator or computer notation is not acceptable in exams." }, pack)).toHaveLength(1);
  });

  it("checks marked steps, and a short booklet label cannot reach 8 words", () => {
    expect(findOverlaps({ text: "Each bounce reaches a fixed fraction of the height before it lands" }, pack)[0]?.source).toMatch(/step 1$/);
    expect(findOverlaps({ text: "Recall the sum of an infinite geometric sequence formula" }, pack)).toEqual([]);
  });
});

describe("originality joined steps and stock phrases", () => {
  it("flags a run split across consecutive steps of one block", () => {
    const lesson = { sections: [{ blocks: [{ type: "example", steps: ["A ball is dropped from", "a height and bounces to a fraction"] }] }] };
    const hits = findOverlaps(lesson, pack);
    expect(hits).toHaveLength(1);
    expect(hits[0].path).toBe("sections[0].blocks[0].steps (joined)");
  });

  it("does not report a joined run already reported inside one step", () => {
    const lesson = { steps: ["A ball is dropped from a height and bounces to a fraction.", "Then it stops."] };
    expect(findOverlaps(lesson, pack).map((hit) => hit.path)).toEqual(["steps[0]"]);
  });

  it("ignores stock IB exam phrases on both sides", () => {
    const stock = { questions: { SL: { questions: [{ id: "q", text: "Find the equation of the tangent to the curve at the point where x = 2. Give your answer correct to three significant figures." }] } } };
    expect(STOCK_PHRASES.length).toBeGreaterThan(5);
    expect(findOverlaps({ text: "Find the equation of the tangent to the curve at the point where $x = 1$." }, stock)).toEqual([]);
    expect(findOverlaps({ text: "Give your answer correct to three significant figures, please." }, stock)).toEqual([]);
  });
});

describe("originality CLI", () => {
  it("exits 0 for a clean lesson and 1 with HIT lines for a copied one", () => {
    const clean = run("originality-lesson-clean.json");
    expect(clean.status).toBe(0);
    expect(clean.stdout).toMatch(/^OK/m);
    const copied = run("originality-lesson-copied.json");
    expect(copied.status).toBe(1);
    expect(copied.stdout.match(/^HIT /gm)).toHaveLength(3);
  });

  it("exits 2 on missing arguments", () => {
    expect(spawnSync(process.execPath, [script], { encoding: "utf8" }).status).toBe(2);
  });
});
