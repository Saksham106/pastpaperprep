import { describe, expect, it } from "vitest";
import { glossaryFixture, lessonFixture } from "./__fixtures__/lesson";
import { itemsFixture } from "./__fixtures__/items";
import type { Block, CalculatorSnippets, CheckBlock, ItemsFile, Lesson } from "./types";
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

describe("verify blocks", () => {
  const example = (verify: Record<string, unknown>) => ({ type: "example", id: "ev", question: "q", steps: ["s"], answer: "$12$", video: null, verify }) as Block;
  const numeric = (verify: Record<string, unknown>) => ({ type: "check", id: "cv", prompt: "p", hint: "h", answer: { value: 24, tolerance: 0 }, explain: "e", verify }) as Block;
  const choice = (verify: Record<string, unknown>) => ({ type: "check", id: "mv", prompt: "p", hint: "h", options: [{ text: "a", correct: true }, { text: "b", correct: false }], explain: "e", verify }) as Block;

  it("accepts known kinds with their required options", () => {
    expect(withBlock(example({ kind: "exact", truth: "gcd(24, 36)" }))).toEqual([]);
    expect(withBlock(example({ kind: "rounded", truth: "sqrt(74)", sf: 3 }))).toEqual([]);
    expect(withBlock(numeric({ kind: "numeric", truth: "lcm(6, 8)", sf: 2 }))).toEqual([]);
    expect(withBlock(choice({ kind: "choice", truth: "a" }))).toEqual([]);
    expect(withBlock(example({ kind: "time", truth: "155", form: "duration" }))).toEqual([]);
  });

  it("rejects an unknown kind, an empty truth, missing or unknown options", () => {
    expect(withBlock(example({ kind: "magic", truth: "1" }))).toEqual([expect.stringContaining("unknown verify kind magic")]);
    expect(withBlock(example({ kind: "exact", truth: " " }))).toEqual([expect.stringContaining("needs a non-empty truth")]);
    expect(withBlock(example({ kind: "rounded", truth: "1" }))).toEqual([expect.stringContaining("needs exactly one of sf / dp")]);
    expect(withBlock(example({ kind: "rounded", truth: "1", sf: 3, dp: 2 })).join()).toContain("give sf or dp, not both");
    expect(withBlock(example({ kind: "exact", truth: "1", sf: 3 }))).toEqual([expect.stringContaining("exact has no option sf")]);
    expect(withBlock(example({ kind: "time", truth: "60" }))).toEqual([expect.stringContaining("time needs form")]);
    expect(withBlock(example({ kind: "time", truth: "60", form: "noon" }))).toEqual([expect.stringContaining("time.form must be one of clock, duration")]);
    expect(withBlock(example({ kind: "rounded", truth: "1", sf: 0 }))).toEqual([expect.stringContaining("sf must be a whole number of at least 1")]);
  });

  it("takes the solutions kind on an example with sf or dp", () => {
    expect(withBlock(example({ kind: "solutions", truth: "solve([Eq(y, x + 2), Eq(x**2 + y**2, 34)], [x, y], dict=True)" }))).toEqual([]);
    expect(withBlock(example({ kind: "solutions", truth: "solve(x**2 - 2, x)", dp: 2 }))).toEqual([]);
    expect(withBlock(example({ kind: "solutions", truth: "solve(x**2 - 2, x)", unit: "cm" }))).toEqual([expect.stringContaining("solutions has no option unit")]);
  });

  it("rejects verify kind choice when an option is a plain number or expression", () => {
    const numbers = { type: "check", id: "mv", prompt: "p", hint: "h", options: [{ text: "0.5", correct: true }, { text: "1/2", correct: false }, { text: "2", correct: false }], explain: "e", verify: { kind: "choice", truth: "0.5" } } as Block;
    expect(withBlock(numbers)).toEqual([expect.stringContaining("verify kind choice is for word answers only")]);
    const words = { ...numbers, options: [{ text: "Similar but not congruent", correct: true }, { text: "increasing", correct: false }], verify: { kind: "choice", truth: "Similar but not congruent" } } as Block;
    expect(withBlock(words)).toEqual([]);
  });

  it("allows numeric verify.reading only for graph-reading prompts and within maxTolerance", () => {
    const reading = (prompt: string, tolerance: number, extra: Record<string, unknown> = { reading: true, maxTolerance: 2 }) => ({ type: "check", id: "mv", prompt, hint: "h", answer: { value: 56, tolerance }, explain: "e", verify: { kind: "numeric", truth: "56", dp: 0, ...extra } }) as Block;
    expect(withBlock(reading("Estimate the number from the curve.", 2))).toEqual([]);
    expect(withBlock(reading("How many runners?", 2))).toEqual([expect.stringContaining("verify.reading is for values read from a graph")]);
    expect(withBlock(reading("Estimate the number.", 3))).toEqual([expect.stringContaining("above verify.maxTolerance")]);
    expect(withBlock(reading("Estimate the number.", 2, { reading: true }))).toEqual([expect.stringContaining("needs maxTolerance")]);
  });

  it("allows verify kind choice only for word answers", () => {
    const maths = { type: "check", id: "mv", prompt: "p", hint: "h", options: [{ text: "$(3, 7)$", correct: true }, { text: "$(7, 3)$", correct: false }], explain: "e", verify: { kind: "choice", truth: "$(3, 7)$" } } as Block;
    expect(withBlock(maths)).toEqual([expect.stringContaining("verify kind choice is for word answers only")]);
    expect(withBlock({ ...maths, verify: { kind: "list", truth: "[1 + 2, 7]" } } as Block)).toEqual([]);
  });

  it("puts each kind only where it can be checked", () => {
    expect(withBlock(numeric({ kind: "exact", truth: "24" }))).toEqual([expect.stringContaining("cannot be used on a numeric check")]);
    expect(withBlock(example({ kind: "numeric", truth: "24", sf: 2 }))).toEqual([expect.stringContaining("cannot be used on an example")]);
    expect(withBlock(example({ kind: "choice", truth: "a" }))).toEqual([expect.stringContaining("cannot be used on an example")]);
    const before = clone();
    before.before[0].verify = { kind: "numeric", truth: "1", sf: 1 };
    expect(run(before)).toEqual([expect.stringContaining("before[0]: b1: verify kind numeric cannot be used on a multiple-choice check")]);
  });
});

describe("calculator blocks", () => {
  const snippets: CalculatorSnippets = {
    "pythagoras-hyp": { title: "Hypotenuse", steps: { "casio-classwiz": ["Press $\\sqrt{\\phantom{x}}$, type {a} $x^2$ + {b} $x^2$, press $\\text{=}$."], "ti-30xs": ["Press 2nd $x^2$, type {a} $x^2$ + {b} $x^2$, press enter."] } },
  };
  const ids = ["casio-classwiz", "ti-30xs"];
  const run0580 = (block: Block) => {
    const lesson = clone();
    blocks(lesson).push(block);
    return validateLesson(lesson, { ...ctx, calculators: ids, calculatorSnippets: snippets });
  };

  it("needs steps for exactly the course's calculators", () => {
    expect(withBlock({ type: "calculator", steps: { ti84: ["a"], nspire: ["b"], casio: ["c"] } })).toEqual([]);
    expect(withBlock({ type: "calculator", steps: { ti84: ["a"], casio: ["c"] } })).toEqual([expect.stringContaining("exactly ti84, nspire, casio")]);
    expect(run0580({ type: "calculator", steps: { ti84: ["a"], nspire: ["b"], casio: ["c"] } })).toEqual([expect.stringContaining("exactly casio-classwiz, ti-30xs")]);
    expect(run0580({ type: "calculator", steps: { "casio-classwiz": ["a"], "ti-30xs": [] } })).toEqual([expect.stringContaining("ti-30xs must be a non-empty list")]);
  });

  it("checks a snippet id and fills every placeholder", () => {
    expect(run0580({ type: "calculator", snippet: "pythagoras-hyp", values: { a: 5, b: 12 } })).toEqual([]);
    expect(run0580({ type: "calculator", snippet: "nope" })).toEqual([expect.stringContaining("unknown calculator snippet nope")]);
    expect(run0580({ type: "calculator", snippet: "pythagoras-hyp", values: { a: 5 } })).toEqual([expect.stringContaining("needs a value for {b}")]);
    expect(run0580({ type: "calculator", snippet: "pythagoras-hyp", values: { a: 5, b: 12, c: 1 } })).toEqual([expect.stringContaining("has no placeholder {c}")]);
    // Filled values are validated as inline text too.
    expect(run0580({ type: "calculator", snippet: "pythagoras-hyp", values: { a: "$5", b: 12 } }).join()).toContain("Unclosed $");
  });
});

describe("levels inside a lesson", () => {
  const levels0580 = { base: "Core", extension: "Extended" };
  const items0580: ItemsFile = {
    schemaVersion: 1,
    edition: "0580-2025",
    items: [{ item: "1.1", topic: 1, level: "Core", name: "Types of number", booklet: [], bullets: [{ id: "1.1.a", text: "Natural numbers" }, { id: "1.1.b", text: "Recurring decimals", level: "Extended" }] }],
  };
  const core = (): Lesson => ({
    ...clone(),
    edition: "0580-2025",
    item: "1.1",
    level: "Core",
    topic: 1,
    before: [],
    goals: [{ text: "Name types of number", bullets: ["1.1.a"] }, { text: "Convert recurring decimals", bullets: ["1.1.b"], level: "Extended" }],
    sections: [
      { id: "types", heading: "Types", blocks: [{ type: "text", text: "A natural number counts." }] },
      { id: "recurring", heading: "Recurring decimals", level: "Extended", blocks: [{ type: "text", text: "A recurring decimal repeats." }] },
    ],
    mistakes: [],
    examTips: [],
  });
  const check = (lesson: Lesson, items: ItemsFile = items0580) => validateLesson(lesson, { items, glossary: [], lessonItems: new Set(["1.1"]), levels: levels0580 });

  it("accepts an Extended bullet taught by an Extended goal and an Extended section", () => expect(check(core())).toEqual([]));

  it("accepts an Extended block or an hlNote as the Extended content", () => {
    const block = core();
    block.sections = [{ id: "types", heading: "Types", blocks: [{ type: "text", text: "Counting." }, { type: "text", text: "Recurring.", level: "Extended" }] }];
    expect(check(block)).toEqual([]);
    const note = core();
    note.sections = [{ id: "types", heading: "Types", blocks: [{ type: "text", text: "Counting." }, { type: "hlNote", text: "More.", lesson: "1.1" }] }];
    expect(check(note)).toEqual([]);
  });

  it("fails an Extended bullet with no Extended content", () => {
    const lesson = core();
    lesson.sections = [lesson.sections[0]];
    expect(check(lesson)).toEqual([expect.stringContaining("Extended bullet 1.1.b must be taught in Extended content")]);
  });

  it("fails an Extended bullet under a Core goal, and a Core bullet under an Extended goal", () => {
    const unmarked = core();
    delete unmarked.goals[1].level;
    expect(check(unmarked)).toEqual([expect.stringContaining('bullet 1.1.b is Extended: cover it with a goal marked "level": "Extended"')]);
    const mixed = core();
    mixed.goals = [{ text: "Everything", bullets: ["1.1.a", "1.1.b"], level: "Extended" }];
    expect(check(mixed)).toEqual([expect.stringContaining("bullet 1.1.a is Core, but the goal is marked Extended")]);
  });

  it("fails Core bullets when every section is Extended", () => {
    const lesson = core();
    lesson.sections[0].level = "Extended";
    expect(check(lesson)).toEqual([expect.stringContaining("Core bullet 1.1.a must be taught in Core content")]);
  });

  it("rejects unknown levels, levels on blocks that take none, and base content inside extension content", () => {
    const unknown = core();
    unknown.sections[1].level = "HL";
    expect(check(unknown).join()).toContain("level HL is not Core or Extended");
    const definition = core();
    definition.sections[0].blocks.push({ type: "definition", term: "t", statement: "s", plain: "p", level: "Extended" } as unknown as Block);
    expect(check(definition)).toEqual([expect.stringContaining("definition blocks take no level")]);
    const nested = core();
    nested.sections[1].blocks.push({ type: "text", text: "Core here?", level: "Core" });
    expect(check(nested)).toEqual([expect.stringContaining("Core block inside Extended content")]);
    const badBullet = structuredClone(items0580);
    badBullet.items[0].bullets[0].level = "HL";
    expect(check(core(), badBullet).join()).toContain("bullet 1.1.a has level HL");
  });

  it("leaves AA (no bullet, section or block levels) unchanged", () => expect(run(clone())).toEqual([]));
});
