import { describe, expect, it } from "vitest";
import { duplicateCheatSheetErrors, glossaryFirstUseErrors, glossaryOwnershipErrors, numberSetErrors, questionNumbers, readingMinutes, tokens } from "./lints.mjs";

type AnyLesson = Record<string, unknown> & { sections: { id: string; heading: string; blocks: Record<string, unknown>[]; level?: string }[] };

const lesson = (blocks: Record<string, unknown>[], extra: Record<string, unknown> = {}): AnyLesson => ({
  item: "1.1",
  summary: "Types of number.",
  goals: [{ text: "Find the HCF.", bullets: [] }],
  before: [],
  sections: [{ id: "s", heading: "Factors", blocks }],
  mistakes: [],
  examTips: [],
  readingMinutes: 1,
  ...extra,
});

const plan = [
  { id: "factor", term: "factor", owner: "1.1", users: [] },
  { id: "highest-common-factor", term: "highest common factor", owner: "1.1", users: [] },
  { id: "prime-number", term: "prime number", owner: "1.1", users: [] },
  { id: "recurring-decimal", term: "recurring decimal", owner: "1.4", users: ["1.1"] },
  { id: "vector", term: "vector", owner: "7.4", users: [] },
];

describe("tokens", () => {
  it("splits maths, glossary links, lesson links and a literal dollar", () => {
    expect(tokens("A [[factor|factor]] of $12$ costs \\$5, see {{lesson:1.2}}.").map((t: { kind: string }) => t.kind)).toEqual(["text", "term", "text", "math", "text", "text", "text", "lesson", "text"]);
  });
});

describe("glossary first use", () => {
  it("passes when each owned or used term is underlined where it first appears", () => {
    const ok = lesson([{ type: "text", text: "A [[factor|factor]] divides exactly. Every factor of $12$ is small. The [[highest-common-factor|HCF]] is the highest common factor." }, { type: "text", text: "A [[recurring-decimal|recurring decimal]] repeats." }]);
    expect(glossaryFirstUseErrors(ok, plan)).toEqual([]);
  });

  it("fails a plain first use, naming where it is, including plurals and the summary", () => {
    const plain = lesson([{ type: "text", text: "Factors divide exactly. A [[factor|factor]] of $12$." }]);
    expect(glossaryFirstUseErrors(plain, plan)).toEqual([expect.stringContaining('"factor" (sections[0].blocks[0])')]);
    const summary = lesson([{ type: "text", text: "A [[recurring-decimal|recurring decimal]] repeats." }], { summary: "Recurring decimals and more." });
    expect(glossaryFirstUseErrors(summary, plan)).toEqual([expect.stringContaining('"recurring decimal" (summary)')]);
  });

  it("does not count a use inside a longer planned term, and counts a definition block as the first use", () => {
    const inside = lesson([{ type: "text", text: "The [[highest-common-factor|highest common factor]] of $6$ and $8$." }]);
    expect(glossaryFirstUseErrors(inside, plan)).toEqual([]);
    const defined = lesson([{ type: "definition", term: "Prime number", statement: "Exactly two factors.", plain: "p" }]);
    expect(glossaryFirstUseErrors(defined, plan).join()).not.toContain("prime number");
  });

  it("ignores terms the lesson neither owns nor uses, and maths", () => {
    expect(glossaryFirstUseErrors(lesson([{ type: "text", text: "A vector, and $\\text{factor}$." }]), plan)).toEqual([]);
  });
});

describe("glossary ownership", () => {
  it("accepts only terms the plan gives this item, filed under it", () => {
    expect(glossaryOwnershipErrors([{ id: "factor", term: "factor", definition: "d", lesson: "1.1" }], plan, "1.1")).toEqual([]);
    expect(glossaryOwnershipErrors([{ id: "recurring-decimal", term: "r", definition: "d", lesson: "1.1" }], plan, "1.1")).toEqual([expect.stringContaining("belongs to 1.4")]);
    expect(glossaryOwnershipErrors([{ id: "made-up", term: "m", definition: "d", lesson: "1.1" }], plan, "1.1")).toEqual([expect.stringContaining("not in the glossary plan")]);
    expect(glossaryOwnershipErrors([{ id: "factor", term: "factor", definition: "d", lesson: "1.2" }], plan, "1.1")).toEqual([expect.stringContaining("must name its owner lesson 1.1")]);
  });
});

describe("reading time", () => {
  it("is words / 150 plus one minute per worked example, with one calculator model counted", () => {
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    const base = lesson([{ type: "text", text: words(290) }, { type: "example", id: "e", question: "Find $x$.", steps: [], answer: "$x = 2$", video: null }], { summary: "", goals: [] });
    const { minutes, examples } = readingMinutes(base);
    expect(examples).toBe(1);
    expect(minutes).toBe(Math.round((290 + 1 + 2 + 1 + 1) / 150 + 1)); // heading "Factors", "Find", $x$, $x = 2$
    const calc = lesson([{ type: "calculator", steps: { a: [words(150)], b: [words(600)] } }], { summary: "", goals: [] });
    expect(readingMinutes(calc).minutes).toBe(1);
  });
});

describe("duplicate cheat-sheet flags", () => {
  it("fails the same formula or fact flagged twice, ignoring spacing", () => {
    const twice = lesson([
      { type: "formula", tex: "a^2 + b^2 = c^2", tag: "learn", cheatSheet: true },
      { type: "formula", tex: "a^2+b^2=c^2", tag: "learn", cheatSheet: true },
      { type: "fact", text: "Primes have two factors.", tag: "learn", cheatSheet: true },
      { type: "fact", text: "Primes have two factors.", tag: "learn", cheatSheet: true },
    ]);
    expect(duplicateCheatSheetErrors(twice)).toEqual([expect.stringContaining("sections[0].blocks[1] flags the same formula"), expect.stringContaining("sections[0].blocks[3] flags the same fact")]);
    expect(duplicateCheatSheetErrors(lesson([{ type: "formula", tex: "x", tag: "learn" }, { type: "formula", tex: "x", tag: "learn", cheatSheet: true }]))).toEqual([]);
  });
});

describe("number sets", () => {
  const pack = {
    questions: {
      label: "do not copy",
      Core: { questions: [{ id: "0580-q1", text: "1. [Maximum mark: 5] A shop sells 24 pens and 36 pencils in 2023. (a) Find the HCF of the two numbers. [2] (b) Find 15% of 60. [3]" }] },
      Extended: { questions: [{ id: "0580-q2", text: "(a) Work out 48 ÷ 12. (b) A triangle has sides 3, 4 and 5. (c) Find 15% of 60." }] },
    },
  };
  const ex = (question: string) => lesson([{ type: "example", id: "ex-1", question, steps: [], answer: "$1$", video: null }]);

  it("reads distinctive numbers, ignoring 0, 1, 2, 10, 100, 1000, years, marks and the question number", () => {
    expect([...questionNumbers("3. [Maximum mark: 4] In 2024, 1,250 people paid $\\$2.50$ each; 10 left. [2]")].sort()).toEqual(["1250", "2.5"]);
  });

  it("fails an example that shares 3+ numbers with one part of a pack question, naming both", () => {
    expect(numberSetErrors(ex("Find the HCF of $24$, $36$ and $60$."), pack)).toEqual([expect.stringMatching(/^ex-1 \(sections\[0\]\.blocks\[0\]\) shares the numbers 24, 36.* with pack question 0580-q1 \(Core\)/)]);
  });

  it("passes fresh numbers, numbers spread across different parts, and three single digits", () => {
    expect(numberSetErrors(ex("Find the HCF of $18$ and $30$."), pack)).toEqual([]);
    expect(numberSetErrors(ex("Use $48$, $15$ and $60$."), pack)).toEqual([]); // 48 is in (a), 15 and 60 in (c), no stem
    expect(numberSetErrors(ex("A triangle has sides $3$, $4$ and $5$ cm."), pack)).toEqual([]);
  });
});
